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
    const ragResult = await ragPipeline.retrieve(keyword, 3);
    const { docs: retrievedDocs, skipped: skippedDocs, threshold } = ragResult;
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
        skipped: skippedDocs,
        threshold,
      },
      planningReport,
      metadata: {
        timestamp: new Date().toISOString(),
        skillsUsed: ['serp-analyzer'],
        ragChunksRetrieved: retrievedDocs.length,
        ragChunksSkipped: skippedDocs.length,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // 分類錯誤，給前端清楚的訊息
    if (message.includes('GEMINI_API_KEY')) {
      return NextResponse.json({
        error: '❌ Gemini API Key 未設定',
        errorType: 'api_key',
        hint: '請在 .env.local 中設定 GEMINI_API_KEY，然後執行 docker restart rag-system',
      }, { status: 500 });
    }

    if (message.includes('429') || message.includes('quota') || message.includes('Too Many Requests')) {
      return NextResponse.json({
        error: '⏳ Gemini API 免費額度已用完',
        errorType: 'quota',
        hint: '請等待幾分鐘後重試，或到 Google AI Studio 查看額度狀態',
      }, { status: 429 });
    }

    if (message.includes('Qdrant')) {
      return NextResponse.json({
        error: '🗄️ Qdrant Cloud 連線失敗',
        errorType: 'qdrant',
        hint: '請確認 .env.local 中的 QDRANT_URL 和 QDRANT_API_KEY 是否正確',
      }, { status: 500 });
    }

    if (message.includes('RAG') || message.includes('Manual.txt')) {
      return NextResponse.json({
        error: '📄 RAG 初始化失敗',
        errorType: 'rag_init',
        hint: '請確認 data/Manual.txt 存在且 Gemini Embedding API 可正常運作',
      }, { status: 500 });
    }

    if (message.includes('所有模型均失敗')) {
      return NextResponse.json({
        error: '🤖 LLM 生成失敗（所有模型都無法使用）',
        errorType: 'llm',
        hint: '可能是 API 額度不足或網路問題，請稍後重試',
      }, { status: 500 });
    }

    return NextResponse.json({
      error: `❌ 分析失敗：${message}`,
      errorType: 'unknown',
      hint: '請查看 Docker 日誌取得更多資訊：docker logs rag-system',
    }, { status: 500 });
  }
}
