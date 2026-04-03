'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { VoiceType, ExperienceLevel } from '@/types';
import styles from './DiagnosisWizard.module.css';

const VOICE_TYPES: VoiceType[] = ['저음', '중음', '고음'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['초보', '중급', '고급'];
const GENRES = ['팝', 'R&B', '발라드', '록', '재즈', '뮤지컬', '클래식', '힙합', '인디'];

export default function StepBasicInfo() {
  const { basicInfo, setBasicInfo, setStep } = useDiagnosisStore();

  const canProceed =
    basicInfo.nickname.trim().length >= 1 &&
    basicInfo.nickname.trim().length <= 20;

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>기본 정보를 알려주세요</h2>
      <p className={styles.stepDesc}>당신에게 맞는 진단을 위해 기본적인 정보가 필요해요.</p>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>닉네임</label>
        <input
          type="text"
          className={styles.formInput}
          placeholder="불러드릴 이름을 입력하세요"
          value={basicInfo.nickname}
          onChange={(e) => setBasicInfo({ nickname: e.target.value.slice(0, 20) })}
          maxLength={20}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>음역대</label>
        <div className={styles.chipGroup}>
          {VOICE_TYPES.map((vt) => (
            <button
              key={vt}
              type="button"
              className={`${styles.chip} ${basicInfo.voiceType === vt ? styles.chipActive : ''}`}
              onClick={() => setBasicInfo({ voiceType: vt })}
            >
              {vt}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>경험 수준</label>
        <div className={styles.chipGroup}>
          {EXPERIENCE_LEVELS.map((exp) => (
            <button
              key={exp}
              type="button"
              className={`${styles.chip} ${basicInfo.experience === exp ? styles.chipActive : ''}`}
              onClick={() => setBasicInfo({ experience: exp })}
            >
              {exp}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>선호 장르 (선택)</label>
        <div className={styles.chipGroup}>
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              className={`${styles.chip} ${basicInfo.genre === g ? styles.chipActive : ''}`}
              onClick={() => setBasicInfo({ genre: basicInfo.genre === g ? '' : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stepActions}>
        <div />
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(1)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
