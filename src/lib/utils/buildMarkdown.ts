// buildMarkdown.ts — Converts analysis result to Markdown format
// Used for both client-side download and server-side storage

import type { AnalysisResult, HeadingAnalysis, KeywordFrequency, ContentGap, RetrievedDocument, OutlineSection } from '@/lib/types';

export function buildMarkdown(result: AnalysisResult): string {
  const ts = new Date(result.metadata.timestamp).toLocaleString('zh-TW');
  const lines: string[] = [];

  // ── Header ──
  lines.push(`# SEO 文章規劃建議書：${result.keyword}`);
  lines.push('');
  lines.push(`> 生成時間：${ts} | 競爭對手：${result.serpAnalysis.data.competitorCount} 家 | 合規引用：${result.metadata.ragChunksRetrieved} 段`);
  lines.push(`> Skills 使用：${result.metadata.skillsUsed.join(', ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── SERP Analysis ──
  lines.push('## 📊 SERP 競爭分析');
  lines.push('');
  lines.push('### 競爭對手標題結構');
  lines.push('');
  result.serpAnalysis.data.headingStructure.forEach((entry: HeadingAnalysis) => {
    lines.push(`**#${entry.rank}** （${entry.source_authority}）`);
    lines.push(`- H1: ${entry.h1}`);
    entry.h2List.forEach((h2: string) => lines.push(`  - H2: ${h2}`));
    lines.push('');
  });

  lines.push('### 關鍵字分布（Top 10）');
  lines.push('');
  lines.push('| 關鍵字 | 出現次數 | 見於排名 |');
  lines.push('|--------|---------|---------|');
  result.serpAnalysis.data.keywordDistribution.slice(0, 10).forEach((kw: KeywordFrequency) => {
    lines.push(`| ${kw.keyword} | ${kw.count} | #${kw.appearsIn.join(', #')} |`);
  });
  lines.push('');

  lines.push('### ⚡ 內容缺口（Content Gap）');
  lines.push('');
  result.serpAnalysis.data.contentGaps.forEach((gap: ContentGap, i: number) => {
    const badge = gap.priority === 'high' ? '🔴 HIGH' : gap.priority === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';
    lines.push(`${i + 1}. **[${badge}]** ${gap.topic}`);
    lines.push(`   > ${gap.reasoning}`);
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // ── RAG Compliance ──
  lines.push('## 🛡️ 合規手冊引用');
  lines.push('');
  if (result.ragRetrieval.documents.length > 0) {
    result.ragRetrieval.documents.forEach((doc: RetrievedDocument, i: number) => {
      lines.push(`### 引用 #${i + 1} — ${doc.chapter}`);
      lines.push('');
      lines.push(`> 相似度：${(doc.score * 100).toFixed(1)}% | 來源：${doc.source}`);
      lines.push('');
      lines.push(doc.content.trim().split('\n').map((l: string) => `> ${l}`).join('\n'));
      lines.push('');
    });
  } else {
    lines.push('> 無相關合規文件被檢索到。');
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── Planning Report ──
  lines.push('## 📝 文章規劃建議書');
  lines.push('');
  lines.push(`### H1：${result.planningReport.title}`);
  lines.push('');

  lines.push('**整體內容策略**');
  lines.push('');
  lines.push(result.planningReport.contentStrategy);
  lines.push('');

  lines.push('### 文章大綱');
  lines.push('');
  result.planningReport.outline.forEach((section: OutlineSection, i: number) => {
    const srcBadge =
      section.source === 'serp_gap' ? '[缺口策略]' :
      section.source === 'compliance' ? '[合規要求]' : '[SEO策略]';
    lines.push(`#### ${i + 1}. H2: ${section.heading} \`${srcBadge}\``);
    lines.push('');
    lines.push(section.description);
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // ── Compliance + Risk ──
  lines.push('## ⚠️ 合規注意事項');
  lines.push('');
  result.planningReport.complianceNotes.forEach((note: string) => lines.push(`- ✅ ${note}`));
  lines.push('');

  lines.push('## 🚨 風險警語');
  lines.push('');
  result.planningReport.riskWarnings.forEach((w: string) => lines.push(`- ⚠️ ${w}`));
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 免責聲明');
  lines.push('');
  lines.push(`> ${result.planningReport.disclaimer}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*本文件由 SEO RAG Planner 自動生成，生成時間：${ts}*`);

  return lines.join('\n');
}
