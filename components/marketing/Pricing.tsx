'use client';

import { useBillingStore } from '@/stores/billingStore';
import styles from './Pricing.module.css';

const PLANS = [
  {
    id: 'free',
    name: 'FREE',
    tagline: '부담 없이 시작하고 싶다면',
    monthlyPrice: 0,
    yearlyPrice: 0,
    isFeatured: false,
    ctaLabel: '무료로 시작하기',
    ctaVariant: 'sec',
    features: [
      { label: 'AI 코치 채팅 (하루 5회)', included: true },
      { label: '기본 음정 피드백', included: true },
      { label: '7일 무료 체험', included: true },
      { label: '맞춤형 성장 리포트', included: false },
      { label: '개인 루틴 설계', included: false },
      { label: '무제한 AI 코칭', included: false },
    ],
  },
  {
    id: 'basic',
    name: 'BASIC',
    tagline: '꾸준히 연습하는 보컬 트레이니',
    monthlyPrice: 12900,
    yearlyPrice: 7900,
    isFeatured: false,
    ctaLabel: '베이직 시작하기',
    ctaVariant: 'sec',
    features: [
      { label: 'AI 코치 채팅 (무제한)', included: true },
      { label: '실시간 음성 분석', included: true },
      { label: '주간 성장 리포트', included: true },
      { label: '개인 맞춤 루틴', included: true },
      { label: '장르별 트레이닝', included: false },
      { label: '오디션 전략 코칭', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    tagline: '진지하게 성장하고 싶은 당신에게',
    monthlyPrice: 29900,
    yearlyPrice: 17900,
    isFeatured: true,
    ctaLabel: '프로 시작하기',
    ctaVariant: 'prim',
    features: [
      { label: 'AI 코치 채팅 (무제한)', included: true },
      { label: '실시간 음성 분석 (고급)', included: true },
      { label: '일간·주간 성장 리포트', included: true },
      { label: '개인 맞춤 루틴 (매일 업데이트)', included: true },
      { label: '장르별 트레이닝', included: true },
      { label: '오디션 전략 코칭', included: true },
    ],
  },
];

function formatPrice(price: number): string {
  if (price === 0) return '무료';
  return price.toLocaleString('ko-KR');
}

export default function Pricing() {
  const { yearly, toggle } = useBillingStore();

  return (
    <section id="pricing" className={styles.pricing}>
      <div className="container">
        <div className="section-head center reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>요금제</div>
          <h2 className="section-title">
            내 목소리에 <em>투자하세요</em>
          </h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            사설 보컬 레슨 1회 비용으로, 한 달 내내 AI 코치와 함께하세요.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className={styles.billingToggle}>
          <span className={`${styles.btl} ${!yearly ? styles.active : ''}`}>월간 결제</span>
          <div
            className={`${styles.toggleSw} ${yearly ? styles.on : ''}`}
            onClick={toggle}
            role="switch"
            aria-checked={yearly}
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
            aria-label="연간 결제 전환"
          >
            <div className={styles.toggleKnob} />
          </div>
          <span className={`${styles.btl} ${yearly ? styles.active : ''}`}>연간 결제</span>
          <span className={styles.saveTag}>38% 절약</span>
        </div>

        {/* Plan Cards */}
        <div className={styles.pricingGrid}>
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const period = yearly ? '/ 월 · 연간 결제 시' : '/ 월 · 언제든 취소 가능';

            return (
              <div
                key={plan.id}
                className={`${styles.priceCard} ${plan.isFeatured ? styles.featured : ''} reveal`}
              >
                {plan.isFeatured && <span className={styles.popularTag}>인기</span>}

                <div className={styles.planName}>{plan.name}</div>
                <div className={styles.planPrice}>
                  {plan.monthlyPrice === 0 ? (
                    '무료'
                  ) : (
                    <>
                      <sup>₩</sup>
                      {formatPrice(price)}
                    </>
                  )}
                </div>
                {plan.monthlyPrice > 0 && (
                  <div className={styles.planPeriod}>{period}</div>
                )}
                <p className={styles.planTagline}>{plan.tagline}</p>

                <div className={styles.planDiv} />

                <ul className={styles.planFeats}>
                  {plan.features.map((feat) => (
                    <li key={feat.label} className={`${styles.pf} ${!feat.included ? styles.off : ''}`}>
                      <span className={`${styles.pfck} ${feat.included ? styles.y : styles.n}`}>
                        {feat.included ? '✓' : '✕'}
                      </span>
                      {feat.label}
                    </li>
                  ))}
                </ul>

                <button
                  className={`${styles.planBtn} ${plan.ctaVariant === 'prim' ? styles.prim : styles.sec}`}
                  type="button"
                  onClick={() => {
                    document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {plan.ctaLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
