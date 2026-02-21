'use client';
// ExportPanel.tsx — Markdown export button + saved reports history panel

import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, SavedReport } from '@/lib/types';
import { buildMarkdown } from '@/lib/utils/buildMarkdown';

// ============================================================
// Helpers
// ============================================================

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================
// ExportButton — appears in result view
// ============================================================

interface ExportButtonProps {
  result: AnalysisResult;
}

export function ExportButton({ result }: ExportButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleExport = async () => {
    setSaving(true);
    const md = buildMarkdown(result);
    const date = new Date().toISOString().split('T')[0];
    const safeKw = result.keyword.replace(/[^\w\u4e00-\u9fff]/g, '_').slice(0, 20);
    const filename = `${date}_${safeKw}.md`;

    // 1. Trigger local download
    downloadMarkdown(md, filename);

    // 2. Also save to server outputs/
    try {
      await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: md, keyword: result.keyword, filename }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Download already succeeded; server save is best-effort
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={saving}
      title="下載 Markdown 並儲存到 outputs/ 目錄"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        background: saved ? 'rgba(52,211,153,0.1)' : 'var(--bg-secondary)',
        color: saved ? 'var(--success)' : 'var(--text-secondary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!saving && !saved) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-start)';
          (e.currentTarget as HTMLElement).style.color = 'var(--accent-end)';
        }
      }}
      onMouseLeave={(e) => {
        if (!saved) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      {saving ? '⏳' : saved ? '✅' : '💾'}
      {saving ? '匯出中…' : saved ? '已儲存！' : 'Export .md'}
    </button>
  );
}

// ============================================================
// ReportsHistory — collapsible history panel
// ============================================================

export function ReportsHistory() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export');
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchReports();
  }, [open, fetchReports]);

  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    try {
      await fetch(`/api/exports/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.filename !== filename));
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (filename: string) => {
    const res = await fetch(`/api/exports/${encodeURIComponent(filename)}`);
    const text = await res.text();
    downloadMarkdown(text, filename);
  };

  return (
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 700 }}>
          📂 已儲存報告
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {reports.length > 0 && (
            <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-end)', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              {reports.length}
            </span>
          )}
          <span style={{ fontSize: '16px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
            ⌄
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <div className="spinner" />
            </div>
          ) : reports.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              尚無儲存的報告
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {reports.map((r) => (
                <div key={r.filename} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(r.createdAt)} · {formatSize(r.size)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleDownload(r.filename)}
                      title="下載"
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.15s',
                      }}
                    >⬇️</button>
                    <button
                      onClick={() => handleDelete(r.filename)}
                      disabled={deleting === r.filename}
                      title="刪除"
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(248,113,113,0.3)',
                        background: 'rgba(248,113,113,0.08)',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '13px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {deleting === r.filename ? '…' : '🗑'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={fetchReports}
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '7px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            🔄 重新整理
          </button>
        </div>
      )}
    </div>
  );
}
