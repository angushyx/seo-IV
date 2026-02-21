'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ExportButton, ReportsHistory } from '@/components/ExportPanel';

const PipelineBuilder = dynamic(() => import('@/components/PipelineBuilder'), {
  ssr: false,
  loading: () => <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>載入 Pipeline Builder...</div>,
});

// ============================================================
// Types
// ============================================================

interface OutlineSection {
  heading: string;
  description: string;
  source: 'serp_gap' | 'compliance' | 'seo_strategy';
}

interface PlanningReport {
  title: string;
  outline: OutlineSection[];
  complianceNotes: string[];
  contentStrategy: string;
  riskWarnings: string[];
  disclaimer: string;
  isFallback?: boolean;
}

interface ContentGap {
  topic: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

interface KeywordFrequency {
  keyword: string;
  count: number;
  appearsIn: number[];
}

interface HeadingAnalysis {
  rank: number;
  title: string;
  h1: string;
  h2List: string[];
  source_authority: string;
}

interface SerpAnalysisData {
  headingStructure: HeadingAnalysis[];
  keywordDistribution: KeywordFrequency[];
  contentGaps: ContentGap[];
  competitorCount: number;
}

interface RetrievedDocument {
  content: string;
  chapter: string;
  score: number;
  source: string;
}

interface AnalysisResult {
  success: boolean;
  keyword: string;
  serpAnalysis: {
    summary: string;
    data: SerpAnalysisData;
  };
  ragRetrieval: {
    summary: string;
    documents: RetrievedDocument[];
  };
  planningReport: PlanningReport;
  metadata: {
    timestamp: string;
    skillsUsed: string[];
    ragChunksRetrieved: number;
  };
}

type ProcessStep = 'idle' | 'serp' | 'rag' | 'llm' | 'done' | 'error';

// Authority 等級顏色對應
function getAuthorityStyle(authority: string): { className: string; color: string; bg: string } {
  if (authority.includes('High')) return { className: 'badge-low', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
  if (authority.includes('Medium')) return { className: 'badge-medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { className: 'badge-high', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

// ============================================================
// Icons (inline SVG for zero dependencies)
// ============================================================

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

// ============================================================
// Sub-Components
// ============================================================

// Animated progress bar for each pipeline step
function StepProgressBar({ status }: { status: string }) {
  const pct = status === 'done' ? 100 : status === 'active' ? 60 : 0;
  return (
    <div style={{
      height: '3px',
      background: 'var(--bg-primary)',
      borderRadius: '999px',
      overflow: 'hidden',
      marginTop: '8px',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: status === 'done'
          ? 'linear-gradient(90deg, var(--success), #86efac)'
          : status === 'active'
          ? 'linear-gradient(90deg, var(--accent-start), var(--accent-end))'
          : 'transparent',
        borderRadius: '999px',
        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: status === 'active' ? 'progressPulse 1.8s ease-in-out infinite' : 'none',
      }} />
    </div>
  );
}

function ProcessSteps({ current, stepOutputs }: { current: ProcessStep; stepOutputs: Record<string, string> }) {
  const steps = [
    { key: 'serp', label: 'SERP 分析 Skill', desc: '標題結構 → 關鍵字分布 → Content Gap', emoji: '🔍' },
    { key: 'rag', label: 'RAG 合規檢索', desc: '向量嵌入 → Cosine Similarity → Top-K 文件', emoji: '🛡️' },
    { key: 'llm', label: 'AI 建議書生成', desc: 'Gemini Flash 融合分析 → 結構化輸出', emoji: '✨' },
  ];

  const getStatus = (stepKey: string) => {
    const order = ['serp', 'rag', 'llm', 'done'];
    const currentIdx = order.indexOf(current);
    const stepIdx = order.indexOf(stepKey);
    if (current === 'error') return stepIdx <= currentIdx ? 'error' : 'pending';
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
          Pipeline 進度
        </h3>
        {current === 'done' && (
          <span className="badge badge-low" style={{ fontSize: '11px' }}>✓ 完成</span>
        )}
        {current === 'error' && (
          <span className="badge badge-high" style={{ fontSize: '11px' }}>✗ 失敗</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {steps.map((step, idx) => {
          const status = getStatus(step.key);
          const output = stepOutputs[step.key];
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.key}>
              <div style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: status === 'active'
                  ? 'rgba(99,102,241,0.08)'
                  : status === 'done'
                  ? 'rgba(52,211,153,0.05)'
                  : 'transparent',
                border: `1px solid ${
                  status === 'active' ? 'rgba(99,102,241,0.25)'
                  : status === 'done' ? 'rgba(52,211,153,0.2)'
                  : 'transparent'
                }`,
                transition: 'all 0.4s ease',
              }}>
                {/* Step number / status icon */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  background: status === 'active'
                    ? 'linear-gradient(135deg, var(--accent-start), var(--accent-end))'
                    : status === 'done'
                    ? 'rgba(52,211,153,0.15)'
                    : 'var(--bg-primary)',
                  border: `1px solid ${
                    status === 'active' ? 'transparent'
                    : status === 'done' ? 'rgba(52,211,153,0.3)'
                    : 'var(--border-subtle)'
                  }`,
                  boxShadow: status === 'active' ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
                  transition: 'all 0.4s ease',
                }}>
                  {status === 'done' ? '✓' : status === 'active' ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : step.emoji}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: status === 'active' ? 'var(--text-primary)'
                        : status === 'done' ? 'var(--success)'
                        : 'var(--text-muted)',
                      transition: 'color 0.3s',
                    }}>{step.label}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{step.desc}</div>
                  {/* Progress bar */}
                  <StepProgressBar status={status} />
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div style={{
                  marginLeft: '28px',
                  width: '2px',
                  height: '8px',
                  background: status === 'done'
                    ? 'linear-gradient(180deg, rgba(52,211,153,0.5), rgba(52,211,153,0.1))'
                    : 'var(--border-subtle)',
                  transition: 'background 0.4s',
                }} />
              )}

              {/* Output preview */}
              {output && (
                <div className="animate-fade-in" style={{
                  marginLeft: '44px',
                  marginTop: '4px',
                  marginBottom: '4px',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '2px solid var(--accent-start)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  maxHeight: '80px',
                  overflow: 'hidden',
                }}>
                  {output}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SerpAnalysisPanel({ data }: { data: SerpAnalysisData }) {
  return (
    <div className="animate-fade-in">
      {/* Heading Structure */}
      <div className="report-section">
        <h3><ChartIcon /> 競爭對手標題結構</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.headingStructure.map((entry) => (
            <div key={entry.rank} className="accent-border-left" style={{ paddingLeft: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--accent-end)', fontWeight: 600 }}>
                  #{entry.rank}
                </span>
                <span className={`badge ${getAuthorityStyle(entry.source_authority).className}`} style={{
                  fontSize: '11px',
                  border: `1px solid ${getAuthorityStyle(entry.source_authority).color}`,
                  background: getAuthorityStyle(entry.source_authority).bg,
                  color: getAuthorityStyle(entry.source_authority).color,
                }}>{entry.source_authority}</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{entry.h1}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {entry.h2List.map((h2, i) => (
                  <span key={i} style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                  }}>
                    H2: {h2}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keyword Distribution */}
      <div className="report-section">
        <h3><SearchIcon /> 關鍵字分布</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {data.keywordDistribution.slice(0, 15).map((kw) => (
            <div key={kw.keyword} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-primary)',
              borderRadius: '8px',
              fontSize: '13px',
            }}>
              <span style={{ color: 'var(--text-primary)' }}>{kw.keyword}</span>
              <span style={{
                background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
                color: 'white',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {kw.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content Gaps */}
      <div className="report-section">
        <h3><AlertIcon /> 內容缺口 (Content Gap)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.contentGaps.map((gap, i) => (
            <div key={i} style={{
              padding: '14px 16px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${gap.priority === 'high' ? 'var(--danger)' : gap.priority === 'medium' ? 'var(--warning)' : 'var(--success)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className={`badge badge-${gap.priority}`}>{gap.priority}</span>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{gap.topic}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {gap.reasoning}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RAGRetrievalPanel({ documents, skipped, threshold }: {
  documents: RetrievedDocument[];
  skipped?: RetrievedDocument[];
  threshold?: number;
}) {
  const thresholdPct = threshold ? (threshold * 100).toFixed(0) : '65';
  return (
    <div className="animate-fade-in">
      <div className="report-section">
        <h3><ShieldIcon /> 合規手冊檢索結果</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          以下為根據輸入關鍵字，從公司內部撰寫手冊中向量檢索出的相關段落（相似度閾值：{thresholdPct}%）
        </p>

        {/* 通過閾值的文件 */}
        {documents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {documents.map((doc, i) => (
              <div key={i} className="accent-border-left" style={{
                paddingLeft: '16px',
                padding: '16px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-end)' }}>
                    引用 #{i + 1} — {doc.chapter.split('：')[0]}
                  </span>
                  <span className="badge badge-info">
                    ✓ {(doc.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {doc.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            ⚠️ 無合規文件超過相似度閾值，LLM 將依內建知識產出建議書。
          </p>
        )}

        {/* 被過濾的文件 */}
        {skipped && skipped.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
              🚫 低相似度段落（已過濾，低於 {thresholdPct}% 閾值）
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {skipped.map((doc, i) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: 0.6,
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {doc.chapter.split('：')[0]}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(239,68,68,0.15)',
                    color: '#ef4444',
                    fontWeight: 600,
                  }}>
                    ✗ {(doc.score * 100).toFixed(1)}% &lt; {thresholdPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanningReportPanel({ report }: { report: PlanningReport }) {
  return (
    <div className="animate-fade-in">
      {/* Fallback Warning */}
      {report.isFallback && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#f59e0b',
        }}>
          ⚠️ <strong>JSON 解析失敗</strong>：LLM 回傳的格式不完整，目前顯示防徹資料。建議稍後再試一次。
        </div>
      )}
      {/* Title */}
      <div className="report-section" style={{ borderLeft: '4px solid var(--accent-start)' }}>
        <h3><SparklesIcon /> 建議文章標題</h3>
        <p style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.4 }}>{report.title}</p>
      </div>

      {/* Content Strategy */}
      <div className="report-section">
        <h3><ChartIcon /> 內容策略</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {report.contentStrategy}
        </p>
      </div>

      {/* Outline */}
      <div className="report-section">
        <h3><FileTextIcon /> 文章大綱</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {report.outline.map((section, i) => (
            <div key={i} style={{
              padding: '14px 16px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${
                section.source === 'serp_gap' ? 'var(--warning)' :
                section.source === 'compliance' ? 'var(--success)' :
                'var(--info)'
              }`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>H2: {section.heading}</span>
                <span className={`badge ${
                  section.source === 'serp_gap' ? 'badge-medium' :
                  section.source === 'compliance' ? 'badge-low' :
                  'badge-info'
                }`} style={{ fontSize: '10px' }}>
                  {section.source === 'serp_gap' ? '缺口策略' :
                   section.source === 'compliance' ? '合規要求' : 'SEO 策略'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance & Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="report-section">
          <h3><ShieldIcon /> 合規注意事項</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.complianceNotes.map((note, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
                {note}
              </li>
            ))}
          </ul>
        </div>

        <div className="report-section">
          <h3 style={{ color: 'var(--warning)' }}><AlertIcon /> 風險警語</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.riskWarnings.map((warning, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--warning)', flexShrink: 0 }}>⚠</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '16px',
        background: 'rgba(248, 113, 113, 0.08)',
        border: '1px solid rgba(248, 113, 113, 0.2)',
        borderRadius: 'var(--radius-sm)',
        marginTop: '16px',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--danger)' }}>免責聲明：</strong>{report.disclaimer}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function Home() {
  const [keyword, setKeyword] = useState('\u623f\u5c4b\u4e8c\u80ce\u5229\u7387');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<ProcessStep>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'serp' | 'rag' | 'report'>('report');
  const [stepOutputs, setStepOutputs] = useState<Record<string, string>>({});
  const [pipelineSteps, setPipelineSteps] = useState<string[]>(['serp-analyzer']);
  const [showPipeline, setShowPipeline] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStepOutputs({});
    setStep('serp');

    try {
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.hint
          ? `${data.error}\n💡 ${data.hint}`
          : data.error || '分析失敗';
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('無法建立串流連線');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.step) setStep(event.step as ProcessStep);
              if (event.output) {
                setStepOutputs(prev => ({ ...prev, [event.step]: event.output }));
              }
              if (event.result) {
                setResult(event.result);
                setStep('done');
                setActiveTab('report');
              }
              if (event.error) {
                const errorMsg = event.hint
                  ? `${event.error}\n💡 ${event.hint}`
                  : event.error;
                throw new Error(errorMsg);
              }
            } catch (e) {
              if (e instanceof Error && e.message.includes('💡')) throw e;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleAnalyze();
    }
  };

  const suggestedKeywords = ['房屋二胎利率', '二胎房貸風險', '房屋二胎申請', '二胎房貸比較'];

  return (
    <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '24px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <SparklesIcon />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700 }}>SEO RAG Planner</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SERP 分析 × RAG 合規 × AI 規劃</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge-info">Gemini Flash</span>
          <span className="badge badge-low">RAG Enabled</span>
        </div>
      </header>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px',
        display: 'grid',
        gridTemplateColumns: result ? '320px 1fr' : '1fr',
        gap: '32px',
        transition: 'all 0.5s',
      }}>
        {/* Left Sidebar / Input Section */}
        <div>
          {/* Search Card */}
          <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
              <span className="gradient-text">輸入 SEO 關鍵字</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              透過 SERP Skill 分析競爭對手，以 RAG 檢索合規規範，產出客製建議書
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <input
                id="keyword-input"
                type="text"
                className="input-field"
                placeholder="例如：房屋二胎利率"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                id="analyze-btn"
                className="btn-primary"
                onClick={handleAnalyze}
                disabled={loading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <SearchIcon />
                    開始分析
                  </>
                )}
              </button>
            </div>

            {/* Suggested Keywords */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {suggestedKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  disabled={loading}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-start)';
                    e.currentTarget.style.color = 'var(--accent-end)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {kw}
                </button>
              ))}
            </div>

            {/* Pipeline toggle */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <button
                onClick={() => setShowPipeline((v) => !v)}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  🔧 Pipeline 設定
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '11px',
                    background: 'rgba(99,102,241,0.15)',
                    color: 'var(--accent-end)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}>
                    {pipelineSteps.length} Skills
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: showPipeline ? 'rotate(180deg)' : 'none' }}>⌄</span>
                </div>
              </button>

              {showPipeline && (
                <div className="animate-fade-in" style={{ marginTop: '14px' }}>
                  <PipelineBuilder
                    onPipelineChange={setPipelineSteps}
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Process Steps */}
          {step !== 'idle' && <ProcessSteps current={step} stepOutputs={stepOutputs} />}

          {/* Error Display */}
          {error && (
            <div className="animate-fade-in" style={{
              padding: '16px',
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--danger)', fontWeight: 600, marginBottom: '4px' }}>
                ⚠ 分析失敗
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{error}</p>
            </div>
          )}

          {/* System Architecture - animated showcase */}
          {!result && step === 'idle' && (
            <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                  系統架構
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3-Stage Pipeline</span>
              </div>

              {([
                {
                  icon: <ChartIcon />,
                  emoji: '🔍',
                  name: 'SERP Analyzer Skill',
                  desc: '解析競爭對手 H1/H2 標題結構、識別關鍵字分布、找出 Content Gap',
                  stats: [{ label: 'H1/H2 提取', pct: 100 }, { label: '關鍵字分析', pct: 85 }, { label: 'Gap 識別', pct: 72 }],
                  color: 'var(--info)',
                  glow: 'rgba(96,165,250,0.2)',
                },
                {
                  icon: <ShieldIcon />,
                  emoji: '🛡️',
                  name: 'RAG 合規檢索',
                  desc: 'Gemini Embedding → Cosine Similarity → 精準取出合規手冊相關段落',
                  stats: [{ label: 'Embedding', pct: 95 }, { label: '相似度比對', pct: 88 }, { label: '合規覆蓋', pct: 100 }],
                  color: 'var(--success)',
                  glow: 'rgba(52,211,153,0.2)',
                },
                {
                  icon: <SparklesIcon />,
                  emoji: '✨',
                  name: 'Gemini Flash AI',
                  desc: '融合 SERP Gap + 合規手冊，輸出 YMYL 合規的 SEO 規劃建議書',
                  stats: [{ label: 'SERP 融合', pct: 90 }, { label: 'YMYL 合規', pct: 95 }, { label: '建議書生成', pct: 100 }],
                  color: 'var(--accent-end)',
                  glow: 'rgba(167,139,250,0.2)',
                },
              ] as const).map((item, i) => (
                <div key={i}>
                  <div style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)',
                    border: `1px solid rgba(255,255,255,0.06)`,
                    marginBottom: i < 2 ? '8px' : '0',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = item.glow.replace('0.2', '0.5');
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${item.glow}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                  >
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div style={{
                        width: '30px', height: '30px',
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${item.glow.replace('0.2','0.6')}, transparent)`,
                        border: `1px solid ${item.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.color,
                        flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>{item.desc}</div>
                      </div>
                    </div>

                    {/* Animated progress bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {item.stats.map((stat, si) => (
                        <div key={si}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stat.label}</span>
                            <span style={{ fontSize: '10px', color: item.color, fontWeight: 600 }}>{stat.pct}%</span>
                          </div>
                          <div style={
                            { height: '4px', background: 'var(--bg-secondary)', borderRadius: '999px', overflow: 'hidden' }
                          }>
                            <div style={{
                              height: '100%',
                              width: `${stat.pct}%`,
                              background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                              borderRadius: '999px',
                              animation: `fillBar${si + 1} 1.2s ${0.1 * (i * 3 + si)}s cubic-bezier(0.4,0,0.2,1) both`,
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flow arrow between cards */}
                  {i < 2 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16px', marginBottom: '0' }}>
                      <div style={{
                        width: '1px',
                        height: '12px',
                        background: 'linear-gradient(180deg, var(--border-subtle), var(--accent-start))',
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Reports History — always visible below sidebar content */}
          <div style={{ marginTop: '16px' }}>
            <ReportsHistory />
          </div>
        </div>

        {/* Right Content: Results */}
        {result && (
          <div className="animate-fade-in">
            {/* Tab Navigation */}
            <div className="tab-container">
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <SparklesIcon /> SEO 規劃建議書
              </button>
              <button
                className={`tab-btn ${activeTab === 'serp' ? 'active' : ''}`}
                onClick={() => setActiveTab('serp')}
              >
                <ChartIcon /> SERP 分析
              </button>
              <button
                className={`tab-btn ${activeTab === 'rag' ? 'active' : ''}`}
                onClick={() => setActiveTab('rag')}
              >
                <ShieldIcon /> 合規檢索
              </button>
            </div>

            {/* Metadata Bar + Export Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px',
              padding: '10px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>🔑 <strong style={{ color: 'var(--text-primary)' }}>{result.keyword}</strong></span>
                <span>📊 {result.serpAnalysis.data.competitorCount} 競爭對手</span>
                <span>📄 {result.metadata.ragChunksRetrieved} 段合規引用</span>
                <span>⏱ {new Date(result.metadata.timestamp).toLocaleString('zh-TW')}</span>
              </div>
              <ExportButton result={result} />
            </div>

            {/* Tab Content */}
            {activeTab === 'report' && <PlanningReportPanel report={result.planningReport} />}
            {activeTab === 'serp' && <SerpAnalysisPanel data={result.serpAnalysis.data} />}
            {activeTab === 'rag' && <RAGRetrievalPanel
              documents={result.ragRetrieval.documents}
              skipped={(result.ragRetrieval as unknown as { skipped?: RetrievedDocument[] }).skipped}
              threshold={(result.ragRetrieval as unknown as { threshold?: number }).threshold}
            />}
          </div>
        )}
      </div>
    </main>
  );
}
