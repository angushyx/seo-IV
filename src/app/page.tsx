'use client';

import { useState } from 'react';

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

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ============================================================
// Sub-Components
// ============================================================

function ProcessSteps({ current }: { current: ProcessStep }) {
  const steps = [
    { key: 'serp', label: 'SERP 分析', desc: '解析競爭對手標題結構與關鍵字' },
    { key: 'rag', label: 'RAG 檢索', desc: '查詢內部合規手冊相關段落' },
    { key: 'llm', label: 'AI 生成', desc: '融合分析結果產出規劃建議書' },
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
      <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        處理進度
      </h3>
      {steps.map((step) => {
        const status = getStatus(step.key);
        return (
          <div key={step.key} className={`step-item ${status}`}>
            <div className={`step-dot ${status}`} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {step.label}
                {status === 'done' && <span style={{ color: 'var(--success)' }}><CheckIcon /></span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{step.desc}</div>
            </div>
          </div>
        );
      })}
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
                <span className="badge badge-info" style={{ fontSize: '11px' }}>{entry.source_authority}</span>
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

function RAGRetrievalPanel({ documents }: { documents: RetrievedDocument[] }) {
  return (
    <div className="animate-fade-in">
      <div className="report-section">
        <h3><ShieldIcon /> 合規手冊檢索結果</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          以下為根據輸入關鍵字，從公司內部撰寫手冊中向量檢索出的相關段落
        </p>
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
                  引用 #{i + 1} — {doc.chapter}
                </span>
                <span className="badge badge-info">
                  相似度: {(doc.score * 100).toFixed(1)}%
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {doc.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanningReportPanel({ report }: { report: PlanningReport }) {
  return (
    <div className="animate-fade-in">
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
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<ProcessStep>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'serp' | 'rag' | 'report'>('report');

  const handleAnalyze = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStep('serp');

    try {
      // Simulate step progression for UX
      setTimeout(() => setStep('rag'), 1000);
      setTimeout(() => setStep('llm'), 2500);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析失敗');
      }

      setResult(data);
      setStep('done');
      setActiveTab('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
              <span className="gradient-text">輸入 SEO 關鍵字</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              系統將自動分析 SERP 競爭態勢、檢索合規規範，並產出文章規劃建議書
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
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
                disabled={loading || !keyword.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <SearchIcon />
                    分析
                  </>
                )}
              </button>
            </div>

            {/* Suggested Keywords */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {suggestedKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
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
          </div>

          {/* Process Steps */}
          {step !== 'idle' && <ProcessSteps current={step} />}

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
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          )}

          {/* System Info - only when no results */}
          {!result && step === 'idle' && (
            <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                系統架構
              </h3>
              {[
                { icon: <ChartIcon />, name: 'SERP Analyzer Skill', desc: '解析競爭對手 H1/H2 標題結構與關鍵字分布' },
                { icon: <ShieldIcon />, name: 'RAG 合規檢索', desc: '向量檢索內部撰寫手冊，確保 YMYL 合規' },
                { icon: <SparklesIcon />, name: 'Gemini Flash AI', desc: '融合外部競爭數據與內部規範，產出規劃建議書' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div style={{ color: 'var(--accent-end)', flexShrink: 0, marginTop: '2px' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

            {/* Metadata Bar */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '24px',
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              <span>🔑 關鍵字：<strong style={{ color: 'var(--text-primary)' }}>{result.keyword}</strong></span>
              <span>📊 競爭對手：{result.serpAnalysis.data.competitorCount}</span>
              <span>📄 合規引用：{result.metadata.ragChunksRetrieved} 段</span>
              <span>⏱ {new Date(result.metadata.timestamp).toLocaleString('zh-TW')}</span>
            </div>

            {/* Tab Content */}
            {activeTab === 'report' && <PlanningReportPanel report={result.planningReport} />}
            {activeTab === 'serp' && <SerpAnalysisPanel data={result.serpAnalysis.data} />}
            {activeTab === 'rag' && <RAGRetrievalPanel documents={result.ragRetrieval.documents} />}
          </div>
        )}
      </div>
    </main>
  );
}
