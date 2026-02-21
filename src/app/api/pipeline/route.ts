// API Route: POST /api/pipeline
// Executes a custom ordered sequence of skills + RAG + LLM

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import skillRegistry from '@/lib/skills/registry';
import ragPipeline from '@/lib/rag/pipeline';
import { generatePlanningReport } from '@/lib/llm/generator';
import { formatSerpAnalysis, SerpAnalysisResult } from '@/lib/skills/serpAnalyzer';

let manualLoaded = false;

async function ensureRAGInitialized(): Promise<void> {
  if (manualLoaded && ragPipeline.initialized) return;
  const manualPath = path.join(process.cwd(), 'data', 'Manual.txt');
  const manualText = await fs.readFile(manualPath, 'utf-8');
  await ragPipeline.initialize(manualText);
  manualLoaded = true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword = body.keyword?.trim();
    const steps: string[] = Array.isArray(body.steps) ? body.steps : ['serp-analyzer'];

    if (!keyword) {
      return NextResponse.json({ error: '請輸入關鍵字' }, { status: 400 });
    }

    // Validate all requested skills exist
    const available = skillRegistry.list().map((s) => s.name);
    const invalid = steps.filter((s) => !available.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `未知 Skill：${invalid.join(', ')}。可用：${available.join(', ')}` },
        { status: 400 }
      );
    }

    const skillResults: Record<string, unknown> = {};
    let serpFormatted = '';

    // Execute skills in order
    for (const skillName of steps) {
      const result = await skillRegistry.execute(skillName);
      skillResults[skillName] = result.rawData;

      // Capture SERP formatted output for LLM
      if (skillName === 'serp-analyzer') {
        serpFormatted = formatSerpAnalysis(result.rawData as SerpAnalysisResult);
      }
      if (skillName === 'content-gap-generator' && result.formattedOutput) {
        serpFormatted += '\n\n' + result.formattedOutput;
      }
    }

    // RAG retrieval
    await ensureRAGInitialized();
    const retrievedDocs = await ragPipeline.retrieve(keyword, 3);
    const ragFormatted = ragPipeline.formatRetrievedDocs(retrievedDocs.docs);

    // LLM generation
    const planningReport = await generatePlanningReport(keyword, serpFormatted, ragFormatted);

    return NextResponse.json({
      success: true,
      keyword,
      executedSteps: steps,
      skillResults,
      ragRetrieval: { documents: retrievedDocs },
      planningReport,
      metadata: {
        timestamp: new Date().toISOString(),
        stepsExecuted: steps.length,
        ragChunksRetrieved: retrievedDocs.docs.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Pipeline 執行失敗：${message}` }, { status: 500 });
  }
}
