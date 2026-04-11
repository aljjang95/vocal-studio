'use client';

import Link from 'next/link';
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
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* 상단 네비 */}
      <nav className="sticky top-0 z-[100] bg-[var(--glass-bg)] backdrop-blur-[20px] border-b border-[var(--border)] flex items-center justify-between px-5 h-[52px]">
        <Link href="/" className="font-bold text-[15px] text-[var(--text-primary)] no-underline">
          HLB 보컬스튜디오
        </Link>
        <div className="app-nav-links">
          <Link href="/scale-practice" className="text-[13px] text-[var(--text-muted)] no-underline px-2.5 py-1.5 rounded-md">스케일</Link>
          <Link href="/coach" className="text-[13px] text-[var(--text-muted)] no-underline px-2.5 py-1.5 rounded-md">AI 코치</Link>
          <Link href="/dashboard" className="text-[13px] text-[var(--text-muted)] no-underline px-2.5 py-1.5 rounded-md">대시보드</Link>
        </div>
      </nav>

      <div className="max-w-[640px] mx-auto px-5 pb-[60px]">
        <header className="pt-8 pb-6">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-[var(--text-primary)] font-bold tracking-tight text-[26px]">소리의 길</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5">
            {completedCount}개 완료 · 전체 {hlbCurriculum.length}단계
          </p>
        </header>

        <div className="flex flex-col gap-8">
          {Object.entries(blocks).map(([blockName, stages]) => (
            <section key={blockName}>
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2.5 pl-0.5">
                {blockName}
              </h2>
              <div className="flex flex-col gap-2">
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
