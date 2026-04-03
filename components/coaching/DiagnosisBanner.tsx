'use client';

import Link from 'next/link';
import { useDiagnosisStore } from '@/stores/diagnosisStore';
import styles from './CoachingLayout.module.css';

export default function DiagnosisBanner() {
  const { result } = useDiagnosisStore();

  if (result) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.bannerIcon}>&#9432;</span>
      <p className={styles.bannerText}>
        먼저 <strong>보컬 진단</strong>을 받으면 맞춤 커리큘럼을 추천받을 수 있어요!
      </p>
      <Link href="/diagnosis" className={styles.bannerBtn}>
        진단 받으러 가기 &rarr;
      </Link>
    </div>
  );
}
