'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useWarmupStore } from '@/stores/warmupStore';
import { WarmupRoutine } from '@/types';
import ConditionForm from '@/components/warmup/ConditionForm';
import RoutineView from '@/components/warmup/RoutineView';
import ExercisePlayer from '@/components/warmup/ExercisePlayer';
import RoutineHistory from '@/components/warmup/RoutineHistory';
import styles from './warmup.module.css';

type Phase = 'input' | 'confirm' | 'exercise' | 'complete';

interface CompletionData {
  stagesCompleted: number[];
  elapsedSec: number;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

export default function WarmupPageClient() {
  const { routine, addRecord, resetRoutine, setCurrentStage } = useWarmupStore();
  const [phase, setPhase] = useState<Phase>('input');
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  const handleRoutineGenerated = useCallback((_routine: WarmupRoutine) => {
    setPhase('confirm');
  }, []);

  const handleStart = useCallback(() => {
    setCurrentStage(0);
    setPhase('exercise');
  }, [setCurrentStage]);

  const handleRegenerate = useCallback(() => {
    resetRoutine();
    setPhase('input');
  }, [resetRoutine]);

  const handleComplete = useCallback((stagesCompleted: number[], elapsedSec: number) => {
    if (routine) {
      addRecord({
        routineId: routine.id,
        completedAt: new Date().toISOString(),
        stagesCompleted,
      });
    }
    setCompletionData({ stagesCompleted, elapsedSec });
    setPhase('complete');
  }, [routine, addRecord]);

  const handleNewRoutine = useCallback(() => {
    resetRoutine();
    setCompletionData(null);
    setPhase('input');
  }, [resetRoutine]);

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
          {/* 입력 단계 */}
          {phase === 'input' && (
            <ConditionForm onRoutineGenerated={handleRoutineGenerated} />
          )}

          {/* 확인 단계 */}
          {phase === 'confirm' && routine && (
            <RoutineView
              routine={routine}
              onStart={handleStart}
              onRegenerate={handleRegenerate}
            />
          )}

          {/* 실행 단계 */}
          {phase === 'exercise' && routine && (
            <ExercisePlayer
              routine={routine}
              onComplete={handleComplete}
            />
          )}

          {/* 완료 단계 */}
          {phase === 'complete' && completionData && (
            <div className={styles.completionCard}>
              <div className={styles.completionIcon} aria-hidden="true">&#10004;</div>
              <h2 className={styles.completionTitle}>워밍업 완료</h2>
              <p className={styles.completionSub}>오늘도 수고하셨습니다. 꾸준한 연습이 실력을 만듭니다.</p>

              <div className={styles.completionStats}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{formatElapsed(completionData.elapsedSec)}</span>
                  <span className={styles.statLabel}>소요 시간</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{completionData.stagesCompleted.length}단계</span>
                  <span className={styles.statLabel}>완료</span>
                </div>
              </div>

              <div className={styles.completionActions}>
                <Link href="/practice" className={styles.primaryLink}>
                  곡 연습하러 가기
                </Link>
                <Link href="/coaching" className={styles.secondaryLink}>
                  코칭 받으러 가기
                </Link>
                <button
                  type="button"
                  className={styles.newRoutineBtn}
                  onClick={handleNewRoutine}
                >
                  새 루틴 생성하기
                </button>
              </div>
            </div>
          )}

          {/* 하단 기록 */}
          <RoutineHistory />
        </div>
      </main>
    </>
  );
}
