// SERP Analyzer Skill - Custom Skill for analyzing SERP data
// Architecture: 1 Skill → 3 Agents
//   Agent 1: Heading Structure Extractor (靜態演算法)
//   Agent 2: Keyword Distribution Analyzer (靜態演算法)
//   Agent 3: Content Gap Generator (LLM 動態分析)

import serpData from '../../../data/SERP_Data.json';
import { generateContentGaps } from './contentGapGenerator';

// ============================================================
// Types
// ============================================================

export interface SerpEntry {
  rank: number;
  title: string;
  h2: string[];
  snippet: string;
  source_authority: string;
}

export interface HeadingAnalysis {
  rank: number;
  title: string;
  h1: string;
  h2List: string[];
  source_authority: string;
}

export interface KeywordFrequency {
  keyword: string;
  count: number;
  appearsIn: number[]; // ranks of entries containing this keyword
}

export interface ContentGap {
  topic: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SerpAnalysisResult {
  headingStructure: HeadingAnalysis[];
  keywordDistribution: KeywordFrequency[];
  contentGaps: ContentGap[];
  competitorCount: number;
  analysisTimestamp: string;
  agentResults: {
    headingAgent: string;
    keywordAgent: string;
    contentGapAgent: string;
  };
}

// ============================================================
// Agent 1: Heading Structure Extractor
// 提取競爭對手的 H1/H2 標題結構
// ============================================================

function agentExtractHeadingStructure(data: SerpEntry[]): HeadingAnalysis[] {
  console.log('[Agent-1] 提取標題結構...');

  const result = data.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid SERP entry at rank ${(entry as unknown as SerpEntry)?.rank ?? 'unknown'}`);
    }

    return {
      rank: entry.rank,
      title: entry.title || '(無標題)',
      h1: entry.title || '(無標題)', // H1 is typically the page title
      h2List: Array.isArray(entry.h2) ? entry.h2.filter(Boolean) : [],
      source_authority: entry.source_authority || 'Unknown',
    };
  });

  const totalH2 = result.reduce((sum, r) => sum + r.h2List.length, 0);
  console.log(`[Agent-1] ✅ 完成：${result.length} 位競爭對手、${totalH2} 個 H2 標籤`);
  return result;
}

// ============================================================
// Agent 2: Keyword Distribution Analyzer
// 識別關鍵字在 SERP 中的分布情況
// ============================================================

function agentAnalyzeKeywordDistribution(data: SerpEntry[]): KeywordFrequency[] {
  console.log('[Agent-2] 分析關鍵字分布...');

  // 金融不動產領域關鍵字詞庫
  const targetKeywords = [
    '房屋二胎', '二胎房貸', '利率', '銀行', '民間',
    '申請', '風險', '額度', '撥款', '流程',
    '信用', '法律', '試算', '比較', '核貸',
    '代書', '陷阱', '案例', '費用', '合約',
    '法拍', '鑑價', '轉增貸', '手續費', '代辦',
  ];

  const keywordMap = new Map<string, { count: number; appearsIn: Set<number> }>();

  data.forEach((entry) => {
    const textContent = [
      entry.title || '',
      ...(Array.isArray(entry.h2) ? entry.h2 : []),
      entry.snippet || '',
    ].join(' ');

    targetKeywords.forEach((keyword) => {
      const regex = new RegExp(keyword, 'g');
      const matches = textContent.match(regex);

      if (matches && matches.length > 0) {
        const existing = keywordMap.get(keyword) || { count: 0, appearsIn: new Set<number>() };
        existing.count += matches.length;
        existing.appearsIn.add(entry.rank);
        keywordMap.set(keyword, existing);
      }
    });
  });

  const result = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      appearsIn: Array.from(data.appearsIn).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count);

  console.log(`[Agent-2] ✅ 完成：追蹤 ${targetKeywords.length} 個關鍵字，${result.length} 個有出現`);
  return result;
}

// ============================================================
// Agent 3: Content Gap Generator (LLM-Powered)
// 使用 Gemini LLM 動態識別內容缺口
// ============================================================

async function agentGenerateContentGaps(data: SerpEntry[]): Promise<{ gaps: ContentGap[]; method: string }> {
  console.log('[Agent-3] LLM 分析內容缺口...');

  try {
    const result = await generateContentGaps(data);
    console.log(`[Agent-3] ✅ 完成：識別出 ${result.gaps.length} 個內容缺口（${result.analysisMethod}）`);
    return {
      gaps: result.gaps,
      method: result.analysisMethod,
    };
  } catch (error) {
    console.warn(`[Agent-3] ⚠️ LLM 分析失敗，退回靜態分析:`, error);
    // Fallback：靜態比對
    const gaps = staticContentGapFallback(data);
    return {
      gaps,
      method: '靜態比對（LLM 降級）',
    };
  }
}

/**
 * 靜態 Content Gap 分析（當 LLM 不可用時的降級方案）
 */
function staticContentGapFallback(data: SerpEntry[]): ContentGap[] {
  const allText = data.map((e) =>
    [e.title, ...(e.h2 || []), e.snippet].join(' ')
  ).join(' ');

  const potentialTopics: { topic: string; keywords: string[]; reasoning: string; priority: 'high' | 'medium' | 'low' }[] = [
    {
      topic: '房屋二胎對個人信用評分的長期影響',
      keywords: ['信用評分', '聯徵', '信用報告'],
      reasoning: '使用者申辦二胎後，對信用的長期影響是重要考量，但目前 SERP 缺乏深入探討',
      priority: 'high',
    },
    {
      topic: '二胎還款壓力與家庭財務規劃建議',
      keywords: ['還款計劃', '財務規劃', '家庭支出'],
      reasoning: '多數文章只談申辦流程，忽略了還款對家庭財務的實際影響',
      priority: 'high',
    },
    {
      topic: '房屋二胎 vs 其他融資管道橫向比較',
      keywords: ['信貸', '保單借款', '融資比較'],
      reasoning: '使用者通常有多種融資選擇，橫向比較有助於決策',
      priority: 'medium',
    },
    {
      topic: '二胎房貸的稅務影響',
      keywords: ['稅務', '房地合一', '節稅'],
      reasoning: '稅務是房屋交易的重要面向，但目前 SERP 幾乎沒有提及',
      priority: 'medium',
    },
    {
      topic: '具體拒貸案例分析與改善方案',
      keywords: ['拒貸', '被拒', '條件不足'],
      reasoning: '目前只有成功案例分享，缺乏拒貸案例的學習機會',
      priority: 'high',
    },
  ];

  return potentialTopics.filter((potential) => {
    const isCovered = potential.keywords.some((kw) => allText.includes(kw));
    return !isCovered;
  }).map(({ topic, reasoning, priority }) => ({ topic, reasoning, priority }));
}

// ============================================================
// Main Skill Orchestrator
// 1 Skill → 3 Agents → 1 Unified Result
// ============================================================

export interface AgentProgressCallback {
  (agent: string, status: string): void;
}

/**
 * SERP Analyzer Skill — orchestrates 3 agents:
 *   1. Heading Structure Agent (靜態)
 *   2. Keyword Distribution Agent (靜態)
 *   3. Content Gap Agent (LLM 動態)
 */
export async function analyzeSERP(
  customData?: SerpEntry[],
  onProgress?: AgentProgressCallback,
): Promise<SerpAnalysisResult> {
  const data = customData || (serpData as SerpEntry[]);

  // Validate input
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('SERP data must be a non-empty array');
  }

  data.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid entry at index ${index}: must be an object`);
    }
    if (typeof entry.rank !== 'number') {
      throw new Error(`Invalid entry at index ${index}: missing or invalid 'rank'`);
    }
  });

  // Agent 1: Heading Structure
  onProgress?.('heading', '正在提取標題結構...');
  const headingStructure = agentExtractHeadingStructure(data);
  const totalH2 = headingStructure.reduce((sum, r) => sum + r.h2List.length, 0);
  onProgress?.('heading', `✅ ${data.length} 位競爭對手、${totalH2} 個 H2 標籤`);

  // Agent 2: Keyword Distribution
  onProgress?.('keyword', '正在分析關鍵字分布...');
  const keywordDistribution = agentAnalyzeKeywordDistribution(data);
  onProgress?.('keyword', `✅ ${keywordDistribution.length} 個關鍵字識別完成`);

  // Agent 3: Content Gap (LLM)
  onProgress?.('gap', '正在使用 LLM 智能分析內容缺口...');
  const gapResult = await agentGenerateContentGaps(data);
  onProgress?.('gap', `✅ ${gapResult.method}：${gapResult.gaps.length} 個內容缺口`);

  return {
    headingStructure,
    keywordDistribution,
    contentGaps: gapResult.gaps,
    competitorCount: data.length,
    analysisTimestamp: new Date().toISOString(),
    agentResults: {
      headingAgent: `${data.length} entries, ${totalH2} H2 tags`,
      keywordAgent: `${keywordDistribution.length} keywords tracked`,
      contentGapAgent: `${gapResult.gaps.length} gaps (${gapResult.method})`,
    },
  };
}

/**
 * Format SERP analysis result into a readable string for LLM consumption
 */
export function formatSerpAnalysis(result: SerpAnalysisResult): string {
  let output = '=== SERP 競爭分析報告 ===\n\n';

  // Heading Structure
  output += '【競爭對手標題結構】\n';
  result.headingStructure.forEach((h) => {
    output += `\n排名 #${h.rank}（權威度：${h.source_authority}）\n`;
    output += `  H1: ${h.h1}\n`;
    h.h2List.forEach((h2, i) => {
      output += `  H2-${i + 1}: ${h2}\n`;
    });
  });

  // Keyword Distribution
  output += '\n【關鍵字分布分析】\n';
  result.keywordDistribution.slice(0, 15).forEach((kw) => {
    output += `  「${kw.keyword}」出現 ${kw.count} 次（見於排名 #${kw.appearsIn.join(', #')}）\n`;
  });

  // Content Gaps
  output += '\n【內容缺口（Content Gap）】\n';
  result.contentGaps.forEach((gap, i) => {
    output += `\n${i + 1}. [${gap.priority.toUpperCase()}] ${gap.topic}\n`;
    output += `   原因：${gap.reasoning}\n`;
  });

  return output;
}
