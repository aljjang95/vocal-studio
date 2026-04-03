'use client';

import { useEffect, useCallback } from 'react';
import { useDiagnosisStore } from '@/stores/diagnosisStore';
import StepBasicInfo from './StepBasicInfo';
import StepConcerns from './StepConcerns';
import StepGoals from './StepGoals';
import StepSelfEval from './StepSelfEval';
import DiagnosisResultView from './DiagnosisResult';
import styles from './DiagnosisWizard.module.css';

const STEP_LABELS = ['기본정보', '고민', '목표', '자기평가'];

export default function DiagnosisWizard() {
  const {
    step,
    basicInfo,
    concerns,
    goal,
    selfEval,
    isSubmitting,
    error,
    result,
    setStep,
    setSubmitting,
    setError,
    setResult,
    resetForm,
    resetAll,
  } = useDiagnosisStore();

  // step === 4에서 자동 제출
  const submitDiagnosis = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicInfo,
          concerns,
          goal,
          selfEval,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(msg);
      setStep(3); // 이전 단계로 복귀
    } finally {
      setSubmitting(false);
    }
  }, [basicInfo, concerns, goal, selfEval, setSubmitting, setError, setResult, setStep]);

  useEffect(() => {
    if (step === 4 && !result && !isSubmitting) {
      submitDiagnosis();
    }
  }, [step, result, isSubmitting, submitDiagnosis]);

  // 결과가 있으면 결과 화면
  if (result) {
    return (
      <div className={styles.wizard}>
        <DiagnosisResultView result={result} onRetry={resetAll} />
      </div>
    );
  }

  // 제출 중 로딩
  if (step === 4 && isSubmitting) {
    return (
      <div className={styles.wizard}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <h3 className={styles.loadingTitle}>AI가 보컬을 분석하고 있어요</h3>
          <p className={styles.loadingDesc}>잠시만 기다려주세요. 맞춤 진단 결과를 생성하고 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      {/* 진행 바 */}
      <div className={styles.progress}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`${styles.progressStep} ${i === step ? styles.progressActive : ''} ${i < step ? styles.progressDone : ''}`}
          >
            <div className={styles.progressDot}>
              {i < step ? <span>&#10003;</span> : <span>{i + 1}</span>}
            </div>
            <span className={styles.progressLabel}>{label}</span>
          </div>
        ))}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${(step / (STEP_LABELS.length - 1)) * 100}%` }} />
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className={styles.errorBanner}>
          <span>&#9888;</span> {error}
          <button type="button" onClick={() => setError(null)} className={styles.errorClose}>&#10005;</button>
        </div>
      )}

      {/* 단계별 콘텐츠 */}
      {step === 0 && <StepBasicInfo />}
      {step === 1 && <StepConcerns />}
      {step === 2 && <StepGoals />}
      {step === 3 && <StepSelfEval />}
    </div>
  );
}
