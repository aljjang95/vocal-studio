'use client';

import Link from 'next/link';
import DiagnosisWizard from '@/components/diagnosis/DiagnosisWizard';
import styles from './diagnosis.module.css';

export default function DiagnosisPageClient() {
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
            </nav>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className="container">
          <div className={styles.pageHead}>
            <div className="section-kicker">AI 보컬 진단</div>
            <h1 className="section-title">
              당신의 목소리를<br /><em>분석합니다</em>
            </h1>
            <p className="section-desc">
              4단계 설문을 완료하면 AI가 당신의 보컬 상태를 종합 진단하고 맞춤 커리큘럼을 추천해드립니다.
            </p>
          </div>
          <DiagnosisWizard />
        </div>
      </main>
    </>
  );
}
