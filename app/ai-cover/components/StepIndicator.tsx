'use client';

import type { AiCoverStep } from '@/types';
import styles from './StepIndicator.module.css';

const STEPS: { key: AiCoverStep; label: string }[] = [
  { key: 'record', label: '녹음' },
  { key: 'model', label: '모델' },
  { key: 'convert', label: '변환' },
  { key: 'result', label: '결과' },
];

function stepIndex(step: AiCoverStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

interface StepIndicatorProps {
  currentStep: AiCoverStep;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIdx = stepIndex(currentStep);

  return (
    <div className={styles.container}>
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className={styles.stepItem}>
            <div
              className={[
                styles.circle,
                isCompleted ? styles.completed : '',
                isCurrent ? styles.current : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span
              className={[
                styles.label,
                isCurrent ? styles.labelCurrent : '',
                isCompleted ? styles.labelCompleted : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  styles.connector,
                  idx < currentIdx ? styles.connectorDone : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
