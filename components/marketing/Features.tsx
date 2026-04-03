import { FeatMiniWaveform } from '@/components/shared/Waveform';
import { IconMic, IconChart, IconBot, IconCalendar, IconMusic } from '@/components/shared/Icons';
import styles from './Features.module.css';

export default function Features() {
  return (
    <section id="features" className={styles.features}>
      <div className="container">
        <div className={`${styles.sectionHead} reveal`}>
          <div>
            <div className="section-kicker">핵심 기능</div>
            <h2 className="section-title">
              트레이너의 노하우,<br />
              <em>AI로 언제든</em>
            </h2>
          </div>
          <p className="section-desc">
            단순한 음정 체크가 아닙니다. 7년간 수천 명을 지도한 보컬 트레이너의 피드백 방식 그대로,
            AI가 매 순간 당신의 목소리를 분석하고 개선합니다.
          </p>
        </div>

        <div className={styles.featuresWrap}>
          <div className={`${styles.featCard} ${styles.gv} reveal`}>
            <div className={`${styles.featIcon} ${styles.fiV}`}><IconMic size={24} /></div>
            <h3>실시간 음성 분석</h3>
            <p>노래하는 순간, AI가 음정·호흡·발성을 동시에 분석합니다. 틀린 부분을 즉시 감지하고 수정 방법을 제안합니다.</p>
            <span className={`${styles.featTag} ${styles.tagV}`}>실시간 처리</span>
          </div>

          <div className={`${styles.featCard} ${styles.gg} reveal`}>
            <div className={`${styles.featIcon} ${styles.fiG}`}><IconChart size={24} /></div>
            <h3>맞춤형 성장 리포트</h3>
            <p>매 세션마다 음역대, 음정 정확도, 호흡 안정성 변화를 추적합니다. 내 성장 곡선을 눈으로 확인하세요.</p>
            <span className={`${styles.featTag} ${styles.tagG}`}>데이터 기반</span>
          </div>

          <div className={`${styles.featCard} ${styles.wide} ${styles.gt} reveal`}>
            <div>
              <div className={`${styles.featIcon} ${styles.fiT}`}><IconBot size={24} /></div>
              <h3>7년 노하우가 담긴 AI 코치</h3>
              <p>실제 보컬 트레이너가 수천 명을 지도하면서 쌓은 커리큘럼이 그대로 AI 안에 담겨 있습니다. 고음 개선, 호흡 훈련, 발음 교정까지 — 사설 레슨과 동일한 수준의 지도를 24시간 받을 수 있습니다.</p>
              <span className={`${styles.featTag} ${styles.tagT}`}>전문가 수준</span>
            </div>
            <div className={styles.featMiniVisual}>
              <FeatMiniWaveform />
              <div className={styles.featMiniLabel}>이번 주 음정 정확도</div>
              <div className={styles.featMiniScore}>94 / 100</div>
            </div>
          </div>

          <div className={`${styles.featCard} ${styles.gt} reveal`}>
            <div className={`${styles.featIcon} ${styles.fiT}`}><IconCalendar size={24} /></div>
            <h3>개인 맞춤 루틴</h3>
            <p>목표(오디션, 음역대 확장, 음정 개선)와 연습 가능 시간을 입력하면 AI가 주간 루틴을 자동으로 설계합니다.</p>
            <span className={`${styles.featTag} ${styles.tagT}`}>자동 설계</span>
          </div>

          <div className={`${styles.featCard} ${styles.gr} reveal`}>
            <div className={`${styles.featIcon} ${styles.fiR}`}><IconMusic size={24} /></div>
            <h3>장르별 트레이닝</h3>
            <p>팝, R&B, 클래식, 록, 재즈 등 장르별 발성법과 스타일 분석. 원하는 장르에 최적화된 보이싱을 습득하세요.</p>
            <span className={`${styles.featTag} ${styles.tagV}`}>장르 특화</span>
          </div>
        </div>
      </div>
    </section>
  );
}
