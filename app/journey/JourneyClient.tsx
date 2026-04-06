'use client';

import { useRouter } from 'next/navigation';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { useJourneyStore } from '@/stores/journeyStore';
import StageCard from '@/components/journey/StageCard';

export default function JourneyClient() {
  const router = useRouter();
  const { getStageStatus, progress } = useJourneyStore();

  const blocks = hlbCurriculum.reduce<Record<string, typeof hlbCurriculum>>((acc, stage) => {
    const key = stage.block;
    if (!acc[key]) acc[key] = [];
    acc[key].push(stage);
    return acc;
  }, {});

  const completedCount = Object.values(progress).filter((p) => p?.passedAt).length;

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      color: 'var(--text-primary)', padding: '0 20px 60px',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <header style={{ padding: '40px 0 24px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>소리의 길</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            {completedCount}개 완료 · 전체 {hlbCurriculum.length}단계
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(blocks).map(([blockName, stages]) => (
            <section key={blockName}>
              <h2 style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: '0.03em', marginBottom: 10, paddingLeft: 2,
              }}>
                {blockName}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stages.map((stage) => {
                  const status = getStageStatus(stage.id);
                  const prog = progress[stage.id];
                  return (
                    <StageCard
                      key={stage.id}
                      stage={stage}
                      status={status}
                      bestScore={prog?.bestScore ?? 0}
                      onClick={() => router.push(`/journey/${stage.id}`)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
