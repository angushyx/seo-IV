// API Route: POST /api/analyze
// Orchestrates SERP Skill + RAG + LLM to generate SEO planning report

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import skillRegistry from '@/lib/skills/registry';
import ragPipeline from '@/lib/rag/pipeline';
import { generatePlanningReport } from '@/lib/llm/generator';
import { SerpAnalysisResult, formatSerpAnalysis } from '@/lib/skills/serpAnalyzer';

// ============================================================
// Manual text loading & RAG init
// ============================================================

let manualLoaded = false;

async function ensureRAGInitialized(): Promise<void> {
  if (manualLoaded && ragPipeline.initialized) return;

  const manualPath = path.join(process.cwd(), 'data', 'Manual.txt');
  try {
    const manualText = await fs.readFile(manualPath, 'utf-8');
    await ragPipeline.initialize(manualText);
    manualLoaded = true;
    console.log('[RAG] Pipeline initialized successfully');
  } catch (error) {
    console.error('[RAG] Failed to initialize:', error);
    throw new Error('Failed to load Manual.txt for RAG pipeline');
  }
}

// ============================================================
// API Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword = body.keyword?.trim();

    if (!keyword) {
      return NextResponse.json(
        { error: '請輸入關鍵字' },
        { status: 400 }
      );
    }

    // Step 1: Execute SERP Analyzer Skill
    console.log(`[API] Analyzing keyword: "${keyword}"`);
    const serpResult = await skillRegistry.execute('serp-analyzer');
    const serpRawData = serpResult.rawData as SerpAnalysisResult;
    const serpFormatted = formatSerpAnalysis(serpRawData);

    // Step 2: RAG Retrieval
    console.log('[API] Initializing RAG pipeline...');
    await ensureRAGInitialized();
    const retrievedDocs = await ragPipeline.retrieve(keyword, 3);
    const ragFormatted = ragPipeline.formatRetrievedDocs(retrievedDocs);

    // Step 3: Generate Planning Report via LLM
    console.log('[API] Generating planning report via Gemini...');
    const planningReport = await generatePlanningReport(keyword, serpFormatted, ragFormatted);

    // Step 4: Return combined result
    return NextResponse.json({
      success: true,
      keyword,
      serpAnalysis: {
        summary: serpResult.formattedOutput,
        data: serpRawData,
      },
      ragRetrieval: {
        summary: ragFormatted,
        documents: retrievedDocs,
      },
      planningReport,
      metadata: {
        timestamp: new Date().toISOString(),
        skillsUsed: ['serp-analyzer'],
        ragChunksRetrieved: retrievedDocs.length,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages
    if (message.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        {
          error: 'Gemini API Key 未設定。請在 .env.local 中設定 GEMINI_API_KEY。',
          hint: '前往 https://aistudio.google.com/apikey 取得 API Key',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `分析失敗：${message}` },
      { status: 500 }
    );
  }
}
