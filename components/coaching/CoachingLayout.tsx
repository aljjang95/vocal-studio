'use client';

import CurriculumTree from './CurriculumTree';
import CoachingChat from './CoachingChat';
import SessionInfo from './SessionInfo';
import DiagnosisBanner from './DiagnosisBanner';
import styles from './CoachingLayout.module.css';

export default function CoachingLayout() {
  return (
    <div className={styles.coachingRoot}>
      <DiagnosisBanner />
      <div className={styles.grid}>
        <CurriculumTree />
        <CoachingChat />
        <SessionInfo />
      </div>
    </div>
  );
}
