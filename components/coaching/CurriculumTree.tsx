'use client';

import { CURRICULUM } from '@/lib/curriculum';
import { useCoachingStore } from '@/stores/coachingStore';
import styles from './CurriculumTree.module.css';

export default function CurriculumTree() {
  const {
    currentCategoryId,
    currentLessonId,
    completedLessons,
    setCurrentCategory,
    setCurrentLesson,
    clearMessages,
  } = useCoachingStore();

  const handleLessonClick = (categoryId: string, lessonId: string) => {
    setCurrentCategory(categoryId);
    setCurrentLesson(lessonId);
    clearMessages();
  };

  return (
    <aside className={styles.tree}>
      <div className={styles.treeHeader}>
        <h3 className={styles.treeTitle}>커리큘럼</h3>
        <span className={styles.treeStat}>
          {completedLessons.length}/{CURRICULUM.reduce((a, c) => a + c.lessons.length, 0)} 완료
        </span>
      </div>
      <nav className={styles.treeNav}>
        {CURRICULUM.map((cat) => {
          const isExpanded = cat.id === currentCategoryId;
          const catCompleted = cat.lessons.filter((l) => completedLessons.includes(l.id)).length;

          return (
            <div key={cat.id} className={styles.category}>
              <button
                type="button"
                className={`${styles.catBtn} ${isExpanded ? styles.catExpanded : ''}`}
                onClick={() => setCurrentCategory(isExpanded ? '' : cat.id)}
              >
                <span className={styles.catIcon}>{cat.icon}</span>
                <span className={styles.catName}>{cat.title}</span>
                <span className={styles.catCount}>{catCompleted}/{cat.lessons.length}</span>
              </button>
              {isExpanded && (
                <ul className={styles.lessonList}>
                  {cat.lessons.map((lesson) => {
                    const isActive = lesson.id === currentLessonId;
                    const isDone = completedLessons.includes(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          className={`${styles.lessonBtn} ${isActive ? styles.lessonActive : ''} ${isDone ? styles.lessonDone : ''}`}
                          onClick={() => handleLessonClick(cat.id, lesson.id)}
                        >
                          <span className={styles.lessonDot}>
                            {isDone ? '&#10003;' : ''}
                          </span>
                          <span className={styles.lessonName}>{lesson.title}</span>
                          <span className={styles.lessonDur}>{lesson.durationMin}분</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
