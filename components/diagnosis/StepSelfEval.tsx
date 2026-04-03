'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { SelfEvalScores } from '@/types';
import styles from './StepSelfEval.module.css';
import wizardStyles from './DiagnosisWizard.module.css';

const EVAL_ITEMS: { key: keyof SelfEvalScores; label: string; desc: string }[] = [
  { key: 'pitch', label: '음정 정확도', desc: '멜로디를 정확히 따라 부를 수 있나요?' },
  { key: 'breath', label: '호흡 안정성', desc: '긴 프레이즈에서 숨이 모자라지 않나요?' },
  { key: 'power', label: '성량 / 파워', desc: '충분한 볼륨으로 소리를 낼 수 있나요?' },
  { key: 'tone', label: '음색 만족도', desc: '자신의 목소리 톤에 만족하나요?' },
  { key: 'technique', label: '테크닉 숙련도', desc: '비브라토, 팔세토 등 기법을 구사할 수 있나요?' },
];

export default function StepSelfEval() {
  const { selfEval, setSelfEval, setStep } = useDiagnosisStore();

  return (
    <div className={wizardStyles.stepContent}>
      <h2 className={wizardStyles.stepTitle}>자기 평가를 해주세요</h2>
      <p className={wizardStyles.stepDesc}>각 항목에 대해 본인의 수준을 슬라이더로 평가해주세요.</p>

      <div className={styles.sliderList}>
        {EVAL_ITEMS.map((item) => (
          <div key={item.key} className={styles.sliderItem}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderLabel}>{item.label}</span>
              <span className={styles.sliderValue}>{selfEval[item.key]}</span>
            </div>
            <p className={styles.sliderDesc}>{item.desc}</p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={selfEval[item.key]}
              onChange={(e) => setSelfEval({ [item.key]: Number(e.target.value) })}
              className={styles.slider}
            />
            <div className={styles.sliderRange}>
              <span>부족</span>
              <span>보통</span>
              <span>능숙</span>
            </div>
          </div>
        ))}
      </div>

      <div className={wizardStyles.stepActions}>
        <button type="button" className="btn-outline" onClick={() => setStep(2)}>
          &larr; 이전
        </button>
        <button type="button" className="btn-primary" onClick={() => setStep(4)}>
          진단 결과 보기 &rarr;
        </button>
      </div>
    </div>
  );
}
