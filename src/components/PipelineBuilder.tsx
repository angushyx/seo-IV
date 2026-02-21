'use client';
// PipelineBuilder.tsx — Drag-and-drop visual pipeline builder
// Uses HTML5 native DnD (no external library)

import { useState, useRef } from 'react';
import type { SkillDefinition } from '@/lib/types';

// ============================================================
// Types
// ============================================================

export interface PipelineBuilderProps {
  onPipelineChange: (steps: string[]) => void;
  disabled?: boolean;
}

// ============================================================
// Available Skills catalogue (shown in left panel)
// ============================================================

const SKILL_CATALOGUE: SkillDefinition[] = [
  {
    id: 'serp-analyzer',
    name: 'SERP Analyzer',
    description: '提取競爭對手 H1/H2 結構與關鍵字分布',
    icon: '🔍',
    color: '#60a5fa',
  },
  {
    id: 'content-gap-generator',
    name: 'Content Gap AI',
    description: 'LLM 動態分析競爭對手未涵蓋的內容缺口',
    icon: '💡',
    color: '#f59e0b',
  },
  {
    id: 'rag-checker',
    name: 'RAG 合規檢索',
    description: '向量語意檢索合規手冊，確保 YMYL',
    icon: '🛡️',
    color: '#34d399',
  },
];

// ============================================================
// Drag state helpers
// ============================================================

type DragSource = { from: 'catalogue'; skillId: string } | { from: 'canvas'; index: number };

// ============================================================
// SkillCard — used in both catalogue and canvas
// ============================================================

function SkillCard({
  skill,
  inCanvas = false,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  disabled,
}: {
  skill: SkillDefinition;
  inCanvas?: boolean;
  index?: number;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: isDragOver ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${isDragOver ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)'}`,
        cursor: disabled ? 'not-allowed' : 'grab',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        minWidth: 0,
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isDragOver) {
          (e.currentTarget as HTMLElement).style.borderColor = skill.color + '88';
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${skill.color}33`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* Icon */}
      <div style={{
        width: '32px',
        height: '32px',
        flexShrink: 0,
        borderRadius: '8px',
        background: skill.color + '22',
        border: `1px solid ${skill.color}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
      }}>
        {skill.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {skill.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {skill.description}
        </div>
      </div>

      {/* Canvas controls */}
      {inCanvas && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {typeof index === 'number' && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: skill.color,
              background: skill.color + '22',
              borderRadius: '6px',
              padding: '2px 8px',
            }}>
              Step {index + 1}
            </span>
          )}
          <button
            onClick={onRemove}
            disabled={disabled}
            style={{
              width: '22px', height: '22px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(248,113,113,0.15)',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.15)';
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main PipelineBuilder Component
// ============================================================

export default function PipelineBuilder({ onPipelineChange, disabled }: PipelineBuilderProps) {
  const [canvasSteps, setCanvasSteps] = useState<SkillDefinition[]>([
    SKILL_CATALOGUE[0], // Default: SERP Analyzer
  ]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSource = useRef<DragSource | null>(null);

  const notifyChange = (steps: SkillDefinition[]) => {
    onPipelineChange(steps.map((s) => s.id));
  };

  // ── Catalogue → Canvas ──
  const handleCatalogueDragStart = (e: React.DragEvent, skillId: string) => {
    dragSource.current = { from: 'catalogue', skillId };
    e.dataTransfer.effectAllowed = 'copy';
  };

  // ── Canvas reorder ──
  const handleCanvasDragStart = (e: React.DragEvent, index: number) => {
    dragSource.current = { from: 'canvas', index };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const src = dragSource.current;
    if (!src) return;

    if (src.from === 'catalogue') {
      // Add new skill from catalogue at drop position
      const skill = SKILL_CATALOGUE.find((s) => s.id === src.skillId);
      if (!skill) return;
      const next = [...canvasSteps];
      next.splice(dropIndex, 0, { ...skill });
      setCanvasSteps(next);
      notifyChange(next);
    } else {
      // Reorder within canvas
      const { index: fromIndex } = src;
      if (fromIndex === dropIndex) return;
      const next = [...canvasSteps];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(dropIndex, 0, moved);
      setCanvasSteps(next);
      notifyChange(next);
    }
    dragSource.current = null;
  };

  // Drop into empty canvas
  const handleCanvasDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragSource.current;
    if (!src || src.from !== 'catalogue') return;
    const skill = SKILL_CATALOGUE.find((s) => s.id === src.skillId);
    if (!skill) return;
    const next = [...canvasSteps, { ...skill }];
    setCanvasSteps(next);
    notifyChange(next);
    dragSource.current = null;
  };

  const removeFromCanvas = (index: number) => {
    const next = canvasSteps.filter((_, i) => i !== index);
    setCanvasSteps(next);
    notifyChange(next);
  };

  const addFromCatalogue = (skill: SkillDefinition) => {
    const next = [...canvasSteps, { ...skill }];
    setCanvasSteps(next);
    notifyChange(next);
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {/* ── Left: Skill Catalogue ── */}
      <div style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--bg-primary)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        padding: '12px',
      }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', fontWeight: 600 }}>
          Skill 庫
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SKILL_CATALOGUE.map((skill) => (
            <div key={skill.id}>
              <SkillCard
                skill={skill}
                disabled={disabled}
                onDragStart={(e) => handleCatalogueDragStart(e, skill.id)}
              />
              <button
                onClick={() => !disabled && addFromCatalogue(skill)}
                disabled={disabled}
                style={{
                  width: '100%',
                  marginTop: '3px',
                  padding: '3px',
                  background: 'transparent',
                  border: 'none',
                  color: skill.color,
                  fontSize: '11px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderRadius: '4px',
                  opacity: disabled ? 0.4 : 0.7,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = disabled ? '0.4' : '0.7'; }}
              >
                + 加入 Pipeline
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
          💡 拖曳 Skill 到右側畫布，或點擊「加入 Pipeline」
        </p>
      </div>

      {/* ── Right: Pipeline Canvas ── */}
      <div
        style={{ flex: 1, minHeight: '160px' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDropZone}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            Pipeline 畫布
          </p>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {canvasSteps.length} 個 Skill
          </span>
        </div>

        {canvasSteps.length === 0 ? (
          <div style={{
            height: '120px',
            border: '2px dashed var(--border-subtle)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}>
            將 Skill 拖曳到這裡
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {canvasSteps.map((skill, i) => (
              <div key={`${skill.id}-${i}`}>
                <SkillCard
                  skill={skill}
                  inCanvas
                  index={i}
                  disabled={disabled}
                  isDragOver={dragOverIndex === i}
                  onDragStart={(e) => handleCanvasDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onRemove={() => removeFromCanvas(i)}
                />
                {/* Flow connector */}
                {i < canvasSteps.length - 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '22px',
                    height: '20px',
                    gap: '6px',
                  }}>
                    <div style={{
                      width: '1px',
                      height: '100%',
                      background: 'linear-gradient(180deg, var(--border-subtle), var(--accent-start))',
                    }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>↓</span>
                  </div>
                )}
              </div>
            ))}

            {/* Always-on RAG + LLM tail */}
            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.06)', border: '1px dashed rgba(99,102,241,0.25)' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                ↓ 固定接續：<span style={{ color: 'var(--success)' }}>RAG 合規檢索</span> → <span style={{ color: 'var(--accent-end)' }}>Gemini Flash AI 生成</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
