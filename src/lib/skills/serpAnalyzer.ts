// SERP Analyzer Skill - Custom Skill for analyzing SERP data
// Extracts heading structure, keyword distribution, and identifies content gaps

import serpData from '../../../data/SERP_Data.json';

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
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Extract heading structure (H1/H2) from all SERP entries
 */
function extractHeadingStructure(data: SerpEntry[]): HeadingAnalysis[] {
  return data.map((entry) => {
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
}

/**
 * Analyze keyword distribution across all SERP entries
 * Segments Chinese text and counts keyword frequency
 */
function analyzeKeywordDistribution(data: SerpEntry[]): KeywordFrequency[] {
  // Define key financial/real-estate terms to track
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

  return Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      appearsIn: Array.from(data.appearsIn).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Identify content gaps - topics that top-ranking pages are NOT covering
 */
function identifyContentGaps(data: SerpEntry[]): ContentGap[] {
  // Collect all existing H2 topics
  const allH2Topics = data.flatMap((entry) =>
    Array.isArray(entry.h2) ? entry.h2 : []
  );
  const allText = data.map((e) =>
    [e.title, ...(e.h2 || []), e.snippet].join(' ')
  ).join(' ');

  // Define potential user pain points that may be missing
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
      topic: '房屋二胎 vs 其他融資管道橫向比較（信貸、保單借款、股票質借）',
      keywords: ['信貸', '保單借款', '融資比較'],
      reasoning: '使用者通常有多種融資選擇，橫向比較有助於決策',
      priority: 'medium',
    },
    {
      topic: '二胎房貸的稅務影響（房地合一稅、房屋稅）',
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
    {
      topic: '不同地區房屋二胎成數與利率差異（都會 vs 偏鄉）',
      keywords: ['地區差異', '台北', '偏鄉', '成數'],
      reasoning: '房屋所在地對二胎核貸條件影響很大，但缺乏地區層面的分析',
      priority: 'medium',
    },
    {
      topic: '房屋二胎結清後的注意事項（塗銷設定、權狀歸還）',
      keywords: ['塗銷', '結清', '設定塗銷'],
      reasoning: '結清後的後續處理是容易被忽略的重要環節',
      priority: 'low',
    },
  ];

  // Check which topics are genuinely missing
  return potentialTopics.filter((potential) => {
    const isCovered = potential.keywords.some((kw) =>
      allH2Topics.some((h2) => h2.includes(kw)) || allText.includes(kw)
    );
    return !isCovered;
  }).map(({ topic, reasoning, priority }) => ({
    topic,
    reasoning,
    priority,
  }));
}

// ============================================================
// Main Skill Function
// ============================================================

/**
 * SERP Analyzer Skill - Main entry point
 * Analyzes the provided SERP data and returns structured insights
 */
export function analyzeSERP(customData?: SerpEntry[]): SerpAnalysisResult {
  const data = customData || (serpData as SerpEntry[]);

  // Validate input
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('SERP data must be a non-empty array');
  }

  // Validate each entry
  data.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid entry at index ${index}: must be an object`);
    }
    if (typeof entry.rank !== 'number') {
      throw new Error(`Invalid entry at index ${index}: missing or invalid 'rank'`);
    }
  });

  try {
    const headingStructure = extractHeadingStructure(data);
    const keywordDistribution = analyzeKeywordDistribution(data);
    const contentGaps = identifyContentGaps(data);

    return {
      headingStructure,
      keywordDistribution,
      contentGaps,
      competitorCount: data.length,
      analysisTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(
      `SERP analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
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
