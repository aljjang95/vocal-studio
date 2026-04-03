'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { ConcernKey } from '@/types';
import { IconRocket, IconWind, IconTarget, IconFrown, IconSparkle, IconChat, IconNervous, IconChart, IconVibrato } from '@/components/shared/Icons';
import styles from './DiagnosisWizard.module.css';

const CONCERN_OPTIONS: { key: ConcernKey; label: string; icon: React.ReactNode }[] = [
  { key: 'high_notes', label: '고음이 어려워요', icon: <IconRocket size={22} /> },
  { key: 'breath_control', label: '호흡이 부족해요', icon: <IconWind size={22} /> },
  { key: 'pitch_accuracy', label: '음정이 불안정해요', icon: <IconTarget size={22} /> },
  { key: 'vocal_fatigue', label: '성대가 쉽게 피로해요', icon: <IconFrown size={22} /> },
  { key: 'tone_quality', label: '음색이 마음에 안 들어요', icon: <IconSparkle size={22} /> },
  { key: 'diction', label: '발음이 불명확해요', icon: <IconChat size={22} /> },
  { key: 'stage_fear', label: '무대에서 긴장돼요', icon: <IconNervous size={22} /> },
  { key: 'range_expand', label: '음역대를 넓히고 싶어요', icon: <IconChart size={22} /> },
  { key: 'vibrato', label: '비브라토를 배우고 싶어요', icon: <IconVibrato size={22} /> },
];

const MAX_CONCERNS = 3;

export default function StepConcerns() {
  const { concerns, setConcerns, setStep } = useDiagnosisStore();

  const toggleConcern = (key: ConcernKey) => {
    if (concerns.includes(key)) {
      setConcerns(concerns.filter((c) => c !== key));
    } else if (concerns.length < MAX_CONCERNS) {
      setConcerns([...concerns, key]);
    }
  };

  const canProceed = concerns.length >= 1;

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>현재 가장 큰 고민은?</h2>
      <p className={styles.stepDesc}>최대 {MAX_CONCERNS}개까지 선택할 수 있어요.</p>

      <div className={styles.concernGrid}>
        {CONCERN_OPTIONS.map((opt) => {
          const isSelected = concerns.includes(opt.key);
          const isDisabled = !isSelected && concerns.length >= MAX_CONCERNS;
          return (
            <button
              key={opt.key}
              type="button"
              className={`${styles.concernCard} ${isSelected ? styles.concernActive : ''} ${isDisabled ? styles.concernDisabled : ''}`}
              onClick={() => !isDisabled && toggleConcern(opt.key)}
              disabled={isDisabled}
            >
              <span className={styles.concernIcon}>{opt.icon}</span>
              <span className={styles.concernLabel}>{opt.label}</span>
              {isSelected && <span className={styles.concernCheck}>&#10003;</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.stepActions}>
        <button type="button" className="btn-outline" onClick={() => setStep(0)}>
          &larr; 이전
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(2)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
