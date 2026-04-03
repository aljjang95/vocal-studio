'use client';

import Link from 'next/link';
import { useCoachStore } from '@/stores/coachStore';
import LessonHome from '@/components/coach/LessonHome';
import ConditionCheck from '@/components/coach/ConditionCheck';
import LessonPlayer from '@/components/coach/LessonPlayer';
import JudgmentResult from '@/components/coach/JudgmentResult';
import SessionSummary from '@/components/coach/SessionSummary';
import styles from './coach.module.css';

export default function CoachPageClient() {
  const phase = useCoachStore((s) => s.phase);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <Link href="/" className={styles.backLink}>
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className={styles.headerNav}>
              <Link href="/practice" className={styles.headerLink}>연습실</Link>
              <Link href="/warmup" className={styles.headerLink}>워밍업</Link>
              <Link href="/breathing" className={styles.headerLink}>호흡</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {phase === 'home' && <LessonHome />}
          {phase === 'condition' && <ConditionCheck />}
          {phase === 'lesson' && <LessonPlayer />}
          {phase === 'judgment' && <JudgmentResult />}
          {phase === 'summary' && <SessionSummary />}
        </div>
      </main>
    </>
  );
}
