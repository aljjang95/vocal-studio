'use client';

import { useEffect, useState } from 'react';
import Waveform from '@/components/shared/Waveform';
import { IconMic, IconMusic, IconChart, IconTrophy } from '@/components/shared/Icons';
import styles from './Hero.module.css';

const SCORE_SEQUENCES = {
  s1: [85, 90, 92, 95, 88, 92],
  s2: [82, 86, 88, 91, 85, 88],
  s3: [74, 78, 79, 82, 76, 79],
};

export default function Hero() {
  const [scores, setScores] = useState({ s1: 92, s2: 88, s3: 79 });
  const [indices, setIndices] = useState({ s1: 0, s2: 0, s3: 0 });

  const [bgIndex, setBgIndex] = useState(0);

  // 배경 이미지 슬라이드쇼 (6초 간격)
  useEffect(() => {
    const bgTimer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(bgTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndices((prev) => {
        const next = {
          s1: (prev.s1 + 1) % SCORE_SEQUENCES.s1.length,
          s2: (prev.s2 + 1) % SCORE_SEQUENCES.s2.length,
          s3: (prev.s3 + 1) % SCORE_SEQUENCES.s3.length,
        };
        setScores({
          s1: SCORE_SEQUENCES.s1[next.s1],
          s2: SCORE_SEQUENCES.s2[next.s2],
          s3: SCORE_SEQUENCES.s3[next.s3],
        });
        return next;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="hero" className={styles.hero}>
      {/* 배경 이미지 슬라이드쇼 */}
      <div className={styles.heroBg} aria-hidden="true">
        <div className={`${styles.heroBgImg} ${styles.heroBgImg1}`} style={{ opacity: bgIndex === 0 ? 1 : 0 }} />
        <div className={`${styles.heroBgImg} ${styles.heroBgImg2}`} style={{ opacity: bgIndex === 1 ? 1 : 0 }} />
        <div className={`${styles.heroBgImg} ${styles.heroBgImg3}`} style={{ opacity: bgIndex === 2 ? 1 : 0 }} />
        <div className={styles.heroBgOverlay} />
        <div className={styles.heroBgGlow} />
        <div className={styles.heroBgBlur} />
      </div>

      <div className="container">
        <div className={styles.heroInner}>

          {/* LEFT */}
          <div className={styles.heroLeft}>
            <div className={styles.heroEyebrow}>
              <div className={styles.eyebrowDot} />
              7년 경력 보컬 트레이너 커리큘럼 탑재
            </div>

            <h1 className={styles.heroTitle}>
              <span className={`${styles.line} ${styles.line1}`}>당신의 목소리,</span>
              <span className={`${styles.line} ${styles.line2}`}><em>AI와 함께</em></span>
              <span className={`${styles.line} ${styles.line3}`}>새롭게 깨어납니다</span>
            </h1>

            <p className={styles.heroSub}>
              단순한 앱이 아닙니다.<br />
              <strong>실제 보컬 트레이너의 7년 노하우</strong>가 AI 안에 담겨,<br />
              24시간 당신만을 위한 맞춤 코칭을 제공합니다.
            </p>

            <div className={styles.heroCta}>
              <a href="/diagnosis" className={`btn-primary ${styles.ctaPrimary}`}>
                <IconMic size={18} /> 무료로 시작하기
              </a>
              <a href="#demo" className="btn-outline">
                AI 코치 체험 →
              </a>
            </div>

            <div className={styles.heroTrust}>
              <div className={styles.trustStat}>
                <span className={styles.trustNum}>7년+</span>
                <span className={styles.trustLabel}>보컬 트레이닝 경력</span>
              </div>
              <div className={styles.trustDivider} />
              <div className={styles.trustStat}>
                <span className={styles.trustNum}>95%</span>
                <span className={styles.trustLabel}>수강생 만족도</span>
              </div>
              <div className={styles.trustDivider} />
              <div className={styles.trustStat}>
                <span className={styles.trustNum}>24/7</span>
                <span className={styles.trustLabel}>AI 코칭 서비스</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Visual Card */}
          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.visCard}>
              <div className={styles.visHeader}>
                <div className={styles.visAvatar}><IconMusic size={20} /></div>
                <div className={styles.visLabel}>
                  <div className={styles.visName}>실시간 AI 음성 분석</div>
                  <div className={styles.visSub}>녹음 후 즉시 피드백 제공</div>
                </div>
                <div className={styles.statusLive}>
                  <div className={styles.liveDot} />
                  분석 중
                </div>
              </div>

              <Waveform count={40} animated />

              <div className={styles.scoreRow}>
                {[
                  { id: 's1', val: scores.s1, label: '음정 정확도' },
                  { id: 's2', val: scores.s2, label: '호흡 안정성' },
                  { id: 's3', val: scores.s3, label: '발음 명료도' },
                ].map((s) => (
                  <div key={s.id} className={styles.scoreChip}>
                    <div className={styles.scoreVal}>{s.val}</div>
                    <div className={styles.scoreLbl}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className={styles.chatPreview}>
                <div className={`${styles.cpMsg} ${styles.cpAi}`}>
                  호흡 지지점을 배꼽 2cm 아래에 고정하면 고음 안정성이 크게 향상될 거예요!
                </div>
                <div className={`${styles.cpMsg} ${styles.cpUser}`}>
                  와, 확실히 다르네요
                </div>
              </div>
            </div>

            <div className={`${styles.floatBadge} ${styles.fb1}`}>
              <div className={styles.fbInner}>
                <div className={styles.fbIcon}><IconChart size={20} /></div>
                <div>
                  <div className={styles.fbStrong}>음역대 +1.5옥타브</div>
                  <div className={styles.fbSub}>3개월 만에 달성</div>
                </div>
              </div>
            </div>

            <div className={`${styles.floatBadge} ${styles.fb2}`}>
              <div className={styles.fbInner}>
                <div className={styles.fbIcon}><IconTrophy size={20} /></div>
                <div>
                  <div className={styles.fbStrong}>오디션 합격</div>
                  <div className={styles.fbSub}>2주 집중 트레이닝 후</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
