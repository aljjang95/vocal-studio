'use client';

import Link from 'next/link';
import { DiagnosisResult as DiagnosisResultType } from '@/types';
import BarChart from './BarChart';
import styles from './DiagnosisResult.module.css';

interface DiagnosisResultProps {
  result: DiagnosisResultType;
  onRetry: () => void;
}

export default function DiagnosisResultView({ result, onRetry }: DiagnosisResultProps) {
  return (
    <div className={styles.result}>
      <div className={styles.resultHeader}>
        <div className={styles.scoreCircle}>
          <span className={styles.scoreNum}>{result.overallScore}</span>
          <span className={styles.scoreLabel}>종합 점수</span>
        </div>
        <div className={styles.headerText}>
          <h2 className={styles.resultTitle}>
            {result.nickname}님의 보컬 진단 결과
          </h2>
          <p className={styles.resultSummary}>{result.summary}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>항목별 점수</h3>
        <BarChart scores={result.scores} />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.iconBadge} style={{ background: 'rgba(20,184,166,0.12)' }}>&#10003;</span>
            강점
          </h3>
          <ul className={styles.list}>
            {result.strengths.map((s, i) => (
              <li key={i} className={styles.listItem}>{s}</li>
            ))}
          </ul>
        </div>
        <div className={styles.column}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.iconBadge} style={{ background: 'rgba(244,63,94,0.12)' }}>!</span>
            개선점
          </h3>
          <ul className={styles.list}>
            {result.weaknesses.map((w, i) => (
              <li key={i} className={styles.listItem}>{w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>맞춤 추천</h3>
        <div className={styles.recList}>
          {result.recommendations.map((r, i) => (
            <div key={i} className={styles.recCard}>
              <span className={styles.recNum}>{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.resultActions}>
        <Link href="/coaching" className="btn-primary">
          맞춤 코칭 시작하기 &rarr;
        </Link>
        <button type="button" className="btn-outline" onClick={onRetry}>
          다시 진단하기
        </button>
      </div>
    </div>
  );
}
