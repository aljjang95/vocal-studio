'use client';

import Link from 'next/link';
import CoachingLayout from '@/components/coaching/CoachingLayout';
import styles from './coaching.module.css';

export default function CoachingPageClient() {
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
              <Link href="/diagnosis" className={styles.headerLink}>진단</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.container}>
          <CoachingLayout />
        </div>
      </main>
    </>
  );
}
