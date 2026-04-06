'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { stopBreathDetection } from '@/lib/audio/breathDetector';
import { useBreathingStore } from '@/stores/breathingStore';
import ModeSelector from '@/components/breathing/ModeSelector';
import BreathVisualizer from '@/components/breathing/BreathVisualizer';
import BreathTimer from '@/components/breathing/BreathTimer';
import WeeklyChart from '@/components/breathing/WeeklyChart';
import styles from './breathing.module.css';

export default function BreathingPageClient() {
  const resetSession = useBreathingStore((s) => s.resetSession);

  // Cleanup on unmount: stop breath detection and reset session
  useEffect(() => {
    return () => {
      stopBreathDetection();
      resetSession();
    };
  }, [resetSession]);

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
              <Link href="/coaching" className={styles.headerLink}>코칭</Link>
              <Link href="/diagnosis" className={styles.headerLink}>진단</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.pageTitle}>호흡 트레이너</h1>
          <p className={styles.pageDesc}>
            호흡 훈련을 통해 보컬에 필요한 폐활량과 호흡 안정성을 키워보세요.
          </p>
          <div className={styles.layout}>
            <ModeSelector />
            <div className={styles.centerSection}>
              <BreathVisualizer />
              <BreathTimer />
            </div>
            <WeeklyChart />
          </div>
        </div>
      </main>
    </>
  );
}
