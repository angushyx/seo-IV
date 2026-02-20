// LLM Integration - Gemini Flash API for generating SEO planning reports

import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================
// Types
// ============================================================

export interface PlanningReport {
  title: string;
  outline: OutlineSection[];
  complianceNotes: string[];
  contentStrategy: string;
  riskWarnings: string[];
  disclaimer: string;
}

export interface OutlineSection {
  heading: string;
  description: string;
  source: 'serp_gap' | 'compliance' | 'seo_strategy';
}

// ============================================================
// Prompt Template
// ============================================================

function buildPrompt(keyword: string, serpAnalysis: string, ragDocs: string): string {
  return `你是一位資深 SEO 內容規劃師，專精於台灣金融科技領域。請綜合以下兩份資料，針對關鍵字「${keyword}」產出一份完整的 SEO 文章撰寫規劃建議書。

## 第一份資料：外部 SERP 競爭分析
${serpAnalysis}

## 第二份資料：公司內部合規手冊（相關段落）
${ragDocs}

## ⛔ 硬性合規約束（必須嚴格遵守）
1. **利率標註**：所有關於利率的描述，必須標註「需視個人信用條件而定」
2. **EEAT 法律差異**：必須提及「銀行」與「代書/民間」二胎的法律權益差異
3. **禁用語**：嚴禁出現「保證過件」、「全台最低利」、「保證核貸」、「零風險」等誇大字眼

## 你的任務
請產出一份 JSON 格式的「SEO 文章規劃建議書」，包含以下欄位：

{
  "title": "建議的 H1 標題（含主要關鍵字，但不過度堆砌）",
  "outline": [
    {
      "heading": "H2 段落標題",
      "description": "該段落應涵蓋的內容要點（2-3 句）",
      "source": "serp_gap 或 compliance 或 seo_strategy"
    }
  ],
  "contentStrategy": "整體內容策略說明（如何平衡搜尋意圖與合規要求）",
  "complianceNotes": ["合規注意事項清單"],
  "riskWarnings": ["必須包含的風險警語"],
  "disclaimer": "文末免責聲明"
}

## 規劃原則
1. **Content Gap 優先**：針對 SERP 分析中識別出的內容缺口，規劃至少 2 個獨家段落
2. **YMYL 合規**：所有利率數據必須標明來源，禁止使用上述禁用語
3. **E-E-A-T**：outline 中必須包含至少 1 個 source 為 "compliance" 的段落，涵蓋銀行與民間二胎的法律權益差異
4. **搜尋意圖**：標題和結構需滿足使用者的實際搜尋需求

請嚴格以 JSON 格式輸出，不要附加其他說明文字。`;
}

// ============================================================
// LLM Call
// ============================================================

// 模型優先順序：依序嘗試，第一個成功的就用
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

export async function generatePlanningReport(
  keyword: string,
  serpAnalysis: string,
  ragDocs: string
): Promise<PlanningReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildPrompt(keyword, serpAnalysis, ragDocs);
  const errors: string[] = [];

  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`[LLM] 嘗試模型: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 4096,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log(`[LLM] ✅ ${modelName} 生成成功`);

      // Parse JSON from response (handle possible markdown code blocks)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/);
      if (!jsonMatch || !jsonMatch[1]) {
        return {
          title: `${keyword} — SEO 撰寫規劃建議書`,
          outline: [{
            heading: '規劃內容',
            description: text,
            source: 'seo_strategy' as const,
          }],
          complianceNotes: ['請參考內部合規手冊'],
          contentStrategy: text,
          riskWarnings: ['本文僅供參考'],
          disclaimer: '本文僅供參考，不構成任何金融投資建議。',
        };
      }

      const parsed = JSON.parse(jsonMatch[1]) as PlanningReport;

      return {
        title: parsed.title || `${keyword} — SEO 撰寫規劃建議書`,
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
        complianceNotes: Array.isArray(parsed.complianceNotes) ? parsed.complianceNotes : [],
        contentStrategy: parsed.contentStrategy || '',
        riskWarnings: Array.isArray(parsed.riskWarnings) ? parsed.riskWarnings : [],
        disclaimer: parsed.disclaimer || '本文僅供參考，不構成任何金融投資建議。',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[LLM] ⚠️ ${modelName} 失敗: ${msg}`);
      errors.push(`${modelName}: ${msg}`);

      if (error instanceof Error && error.message.includes('API key')) {
        throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.');
      }
      // 繼續嘗試下一個模型
    }
  }

  throw new Error(`所有模型均失敗:\n${errors.join('\n')}`);
}
