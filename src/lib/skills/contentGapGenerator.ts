// Content Gap Generator Skill - Uses LLM to dynamically identify content gaps
// Instead of hardcoded topics, this skill analyzes SERP data with Gemini
// to discover gaps that competitors are NOT covering

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SerpEntry } from './serpAnalyzer';

// ============================================================
// Types
// ============================================================

export interface ContentGap {
  topic: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ContentGapResult {
  gaps: ContentGap[];
  analysisMethod: string;
  timestamp: string;
}

// ============================================================
// LLM-Powered Gap Analysis
// ============================================================

function buildGapPrompt(serpEntries: SerpEntry[]): string {
  const now = new Date();
  const currentDate = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;

  const serpSummary = serpEntries.map((entry) => {
    const h2s = Array.isArray(entry.h2) ? entry.h2.join('、') : '';
    return `排名 #${entry.rank}（${entry.source_authority}）\n標題：${entry.title}\nH2：${h2s}\n摘要：${entry.snippet}`;
  }).join('\n\n');

  return `你是一位資深 SEO 內容策略師，專精於台灣金融不動產領域。目前為 ${currentDate}。

以下是「房屋二胎」相關關鍵字的 Google SERP 前 ${serpEntries.length} 名競爭對手資料：

${serpSummary}

## 你的任務
請分析以上 SERP 資料，找出 **5-7 個競爭對手尚未充分覆蓋的內容缺口（Content Gap）**。

要求：
1. 從使用者搜尋意圖出發，找出他們真正關心但 SERP 沒有好好回答的問題
2. 每個缺口需標註優先級：high（高搜尋量且競爭低）、medium（有潛力）、low（長尾）
3. 說明為什麼這是缺口（哪些面向被忽略了）
4. 不要重複 SERP 中已有的主題

請以以下 JSON 格式輸出（外層必須是物件，不要直接回傳陣列）：
{
  "gaps": [
    {
      "topic": "內容缺口主題（中文，20 字以內）",
      "reasoning": "為什麼這是缺口（中文，50 字以內）",
      "priority": "high 或 medium 或 low"
    }
  ]
}

重要要求：
- 回傳純淨 JSON，不加任何說明文字
- topic 限制 20 字以內
- reasoning 限制 50 字以內，簡潔指出缺口原因即可
- priority 只能填 high、medium、low
- 共輸出 5 個缺口`;
}

// 模型清單（與 generator.ts 同步）
const MODEL_FALLBACKS = ['gemini-3-flash', 'gemini-3-pro', 'gemini-3.1-pro', 'gemini-2.5-pro', 'gemini-2.5-flash'];

export async function generateContentGaps(serpEntries: SerpEntry[]): Promise<ContentGapResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildGapPrompt(serpEntries);
  const errors: string[] = [];

  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`[ContentGap] 嘗試模型: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[ContentGap] ✅ ${modelName} 回應成功`);

      // 解析 JSON 陣列
      const gaps = parseGapResponse(text);

      if (gaps.length > 0) {
        console.log(`[ContentGap] ✅ 識別出 ${gaps.length} 個內容缺口`);
        return {
          gaps,
          analysisMethod: `LLM 動態分析 (${modelName})`,
          timestamp: new Date().toISOString(),
        };
      } else {
        console.warn(`[ContentGap] ⚠️ 解析後缺口為空，原始回應前 200 字：`, text.slice(0, 200));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[ContentGap] ⚠️ ${modelName} 失敗: ${msg}`);
      errors.push(`${modelName}: ${msg}`);

      if (error instanceof Error && error.message.includes('API key')) {
        throw error;
      }
    }
  }

  // 所有模型都失敗，回傳空結果
  console.warn(`[ContentGap] 所有模型失敗，回傳空結果`);
  return {
    gaps: [],
    analysisMethod: '分析失敗',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// JSON 解析（容錯）
// ============================================================

function parseGapResponse(text: string): ContentGap[] {
  let json = text.trim();

  // 移除 markdown code block
  const codeMatch = json.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeMatch) json = codeMatch[1].trim();

  // 清除換行（避免 string value 中的未跳脫換行）
  json = json.replace(/[\r\n]+/g, ' ').replace(/\t/g, ' ');

  console.log('[ContentGap] 解析中，前 300 字：', json.slice(0, 300));

  try {
    const parsed = JSON.parse(json);
    const arr = extractGapsArray(parsed);
    if (arr.length > 0) return arr;
  } catch (e1) {
    console.warn('[ContentGap] 第一次 parse 失敗:', e1 instanceof Error ? e1.message : e1);

    // 嘗試修復 trailing comma
    try {
      const fixed = json.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
      const parsed = JSON.parse(fixed);
      const arr = extractGapsArray(parsed);
      if (arr.length > 0) return arr;
    } catch { /* 繼續 ↓ */ }

    // 最後手段：從截斷的 JSON 中救出完整的 gap 物件
    const recovered = recoverPartialGaps(json);
    if (recovered.length > 0) {
      console.log(`[ContentGap] ✅ 部分復原成功，救出 ${recovered.length} 個缺口`);
      return recovered;
    }

    console.error('[ContentGap] JSON 解析全數失敗');
  }

  return [];
}

/** 支援 { gaps: [...] } 或直接 [...] */
function extractGapsArray(parsed: unknown): ContentGap[] {
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.gaps)
      ? (parsed as Record<string, unknown>).gaps as ContentGap[]
      : [];

  return (raw as ContentGap[])
    .filter((item) => item?.topic && item?.reasoning && item?.priority)
    .map((item) => ({
      topic: String(item.topic).slice(0, 50),
      reasoning: String(item.reasoning).slice(0, 150),
      priority: (['high', 'medium', 'low'].includes(item.priority)
        ? item.priority
        : 'medium') as 'high' | 'medium' | 'low',
    }));
}

/** 從截斷的 JSON 中捕捉完整的 gap 物件 */
function recoverPartialGaps(json: string): ContentGap[] {
  const recovered: ContentGap[] = [];
  // 找所有完整的 { "topic":"...", "reasoning":"...", "priority":"..." } 物件
  const pattern = /\{\s*"topic"\s*:\s*"([^"]+)"\s*,\s*"reasoning"\s*:\s*"([^"]+)"\s*,\s*"priority"\s*:\s*"(high|medium|low)"\s*\}/g;
  let match;
  while ((match = pattern.exec(json)) !== null) {
    recovered.push({
      topic: match[1].slice(0, 50),
      reasoning: match[2].slice(0, 150),
      priority: match[3] as 'high' | 'medium' | 'low',
    });
  }
  return recovered;
}
