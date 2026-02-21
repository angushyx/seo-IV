// API Route: POST /api/analyze/stream
// SSE Streaming — 1 Skill (3 Agents) + RAG + LLM, step-by-step real-time output

import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import skillRegistry from '@/lib/skills/registry';
import ragPipeline from '@/lib/rag/pipeline';
import { generatePlanningReport } from '@/lib/llm/generator';
import { SerpAnalysisResult, formatSerpAnalysis } from '@/lib/skills/serpAnalyzer';

let manualLoaded = false;

async function ensureRAGInitialized(): Promise<void> {
  if (manualLoaded && ragPipeline.initialized) return;

  const manualPath = path.join(process.cwd(), 'data', 'Manual.txt');
  const manualText = await fs.readFile(manualPath, 'utf-8');
  await ragPipeline.initialize(manualText);
  manualLoaded = true;
  console.log('[RAG] Pipeline initialized successfully');
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const keyword = body.keyword?.trim();

        if (!keyword) {
          send({ error: '請輸入關鍵字' });
          controller.close();
          return;
        }

        console.log(`[API-SSE] Analyzing keyword: "${keyword}"`);

        // ============================================================
        // Step 1: SERP Analyzer Skill (3 Agents)
        // ============================================================
        send({ step: 'serp', output: '正在啟動 SERP 分析 Skill（3 個 Agent）...' });

        // Agent progress callback → SSE
        const onProgress = (agent: string, status: string) => {
          const agentLabels: Record<string, string> = {
            heading: '🏗️ Agent-1 標題結構',
            keyword: '🔑 Agent-2 關鍵字分布',
            gap: '🧠 Agent-3 Content Gap (LLM)',
          };
          const label = agentLabels[agent] || agent;
          send({ step: 'serp', output: `${label}：${status}` });
        };

        const serpResult = await skillRegistry.execute('serp-analyzer', { onProgress });
        const serpRawData = serpResult.rawData as SerpAnalysisResult;
        const serpFormatted = formatSerpAnalysis(serpRawData);

        // 最終 SERP 摘要
        send({
          step: 'serp',
          output: [
            `✅ SERP 分析完成（3 Agent 全部成功）`,
            `   📊 ${serpRawData.competitorCount} 位競爭對手`,
            `   🏗️ ${serpRawData.headingStructure.reduce((s, r) => s + r.h2List.length, 0)} 個 H2 標籤`,
            `   🔑 ${serpRawData.keywordDistribution.length} 個關鍵字追蹤`,
            `   🧠 ${serpRawData.contentGaps.length} 個內容缺口（${serpRawData.agentResults.contentGapAgent}）`,
          ].join('\n'),
        });

        // ============================================================
        // ============================================================
        // Step 2: RAG Retrieval
        // ============================================================
        send({ step: 'rag', output: '正在初始化向量資料庫並檢索合規文件...' });

        await ensureRAGInitialized();
        const ragResult = await ragPipeline.retrieve(keyword, 3);
        const { docs: retrievedDocs, skipped: skippedDocs, threshold } = ragResult;
        const ragFormatted = ragPipeline.formatRetrievedDocs(retrievedDocs);

        // 已通過閾值的文件
        const docDetails = retrievedDocs.length > 0
          ? retrievedDocs.map((doc, i) =>
              `📌 引用#${i + 1}（${doc.chapter.split('：')[0]}，相似度 ${(doc.score * 100).toFixed(1)}%）\n${doc.content.slice(0, 200)}${doc.content.length > 200 ? '...' : ''}`
            ).join('\n\n')
          : '⚠️ 無相關合規文件超過相似度閾值';

        // 被過濾的文件
        const skippedDetails = skippedDocs.length > 0
          ? `\n\n🚫 已過濾（低於 ${(threshold * 100).toFixed(0)}% 閾值）：\n` +
            skippedDocs.map(doc =>
              `  ✗ ${doc.chapter.split('：')[0]}（${(doc.score * 100).toFixed(1)}%）`
            ).join('\n')
          : '';

        send({
          step: 'rag',
          output: `✅ 檢索完成（${ragPipeline.storeType}，閾值 ${(threshold * 100).toFixed(0)}%）\n` +
            `   ✓ 通過：${retrievedDocs.length} 段　✗ 過濾：${skippedDocs.length} 段\n\n` +
            docDetails + skippedDetails,
        });

        // ============================================================
        // Step 3: LLM Report Generation
        // ============================================================
        send({ step: 'llm', output: '正在使用 Gemini 融合 SERP + RAG 產出建議書...' });

        const planningReport = await generatePlanningReport(keyword, serpFormatted, ragFormatted);

        send({
          step: 'llm',
          output: `✅ 建議書生成完成：「${planningReport.title}」`,
        });

        // ============================================================
        // Final Result
        // ============================================================
        send({
          step: 'done',
          result: {
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
              agents: serpRawData.agentResults,
              ragChunksRetrieved: retrievedDocs.length,
              ragChunksSkipped: skippedDocs.length,
            },
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API-SSE] Error:', error);

        let errorMsg = `❌ 分析失敗：${message}`;
        let hint = '請查看 Docker 日誌取得更多資訊';

        if (message.includes('429') || message.includes('quota')) {
          errorMsg = '⏳ Gemini API 免費額度已用完';
          hint = '請等待幾分鐘後重試';
        } else if (message.includes('Qdrant')) {
          errorMsg = '🗄️ Qdrant Cloud 連線失敗';
          hint = '請確認 QDRANT_URL 和 QDRANT_API_KEY';
        } else if (message.includes('RAG') || message.includes('Manual')) {
          errorMsg = '📄 RAG 初始化失敗';
          hint = '請確認 data/Manual.txt 存在';
        }

        send({ error: errorMsg, hint });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
