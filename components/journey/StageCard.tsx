'use client';

import Card from '@/components/ds/Card';
import type { HLBCurriculumStage, StageStatus } from '@/types';

interface StageCardProps {
  stage: HLBCurriculumStage;
  status: StageStatus;
  bestScore: number;
  onClick: () => void;
}

export default function StageCard({ stage, status, bestScore, onClick }: StageCardProps) {
  const variant = status === 'locked' ? 'locked'
    : (status === 'available' || status === 'in_progress') ? 'active'
    : 'default';

  return (
    <Card
      variant={variant}
      interactive={status !== 'locked'}
      onClick={status !== 'locked' ? onClick : undefined}
      style={{ cursor: status === 'locked' ? 'default' : 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13, fontWeight: 600,
          color: 'var(--text-muted)',
          width: 28, textAlign: 'right' as const, flexShrink: 0,
        }}>
          {String(stage.id).padStart(2, '0')}
        </span>

        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: status === 'passed' ? 'var(--success)'
            : status === 'available' || status === 'in_progress' ? 'var(--accent)'
            : 'var(--bg-elevated)',
          boxShadow: status === 'available' || status === 'in_progress'
            ? '0 0 8px var(--accent-glow)' : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {stage.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {stage.pronunciation} · {stage.scaleType || stage.block}
          </div>
        </div>

        {bestScore > 0 && (
          <div style={{ textAlign: 'right' as const }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
            }}>{bestScore}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>점</div>
          </div>
        )}

        {status === 'locked' && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        )}

        {status !== 'locked' && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </Card>
  );
}
