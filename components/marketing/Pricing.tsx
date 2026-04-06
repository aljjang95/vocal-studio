'use client';

import { useBillingStore } from '@/stores/billingStore';
import Button from '@/components/ds/Button';
import Card from '@/components/ds/Card';
import styles from './Pricing.module.css';

const PLANS = [
  {
    id: 'free',
    name: '무료',
    tagline: '가볍게 시작하기',
    monthlyPrice: 0,
    yearlyPrice: 0,
    isFeatured: false,
    ctaLabel: '무료로 시작',
    ctaVariant: 'secondary' as const,
    badge: null,
    features: [
      { label: '스케일 연습 5단계', included: true },
      { label: 'AI 코치 채팅 (하루 3회)', included: true },
      { label: '기본 긴장 감지', included: true },
      { label: '광고 포함', included: true, note: true },
      { label: '실시간 음성 분석', included: false },
      { label: '성장 리포트', included: false },
      { label: 'AI 커버', included: false },
    ],
  },
  {
    id: 'hobby',
    name: '취미반',
    tagline: '노래가 좋아서 시작하는 당신에게',
    monthlyPrice: 9900,
    yearlyPrice: 5900,
    isFeatured: false,
    ctaLabel: '취미반 시작',
    ctaVariant: 'secondary' as const,
    badge: null,
    features: [
      { label: '스케일 연습 전체 28단계', included: true },
      { label: 'AI 코치 채팅 (무제한)', included: true },
      { label: '실시간 긴장 감지 + 피드백', included: true },
      { label: '주간 성장 리포트', included: true },
      { label: '광고 없음', included: true },
      { label: 'AI 커버 (월 3곡)', included: true },
      { label: '1:1 맞춤 커리큘럼', included: false },
    ],
  },
  {
    id: 'pro',
    name: '발성전문반',
    tagline: '진지하게 목소리를 바꾸고 싶다면',
    monthlyPrice: 24900,
    yearlyPrice: 14900,
    isFeatured: true,
    ctaLabel: '전문반 시작',
    ctaVariant: 'accent' as const,
    badge: '추천',
    features: [
      { label: '스케일 연습 전체 + 고급 패턴', included: true },
      { label: 'AI 코치 (무제한 + 심화 분석)', included: true },
      { label: '4축 긴장 감지 (후두/혀뿌리/턱/성구)', included: true },
      { label: '일간 + 주간 성장 리포트', included: true },
      { label: '광고 없음', included: true },
      { label: 'AI 커버 (무제한)', included: true },
      { label: '1:1 맞춤 커리큘럼 + 루틴 설계', included: true },
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
        <div className={styles.head}>
          <div className="section-kicker" style={{ justifyContent: 'center' }}>요금제</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            사설 레슨 1회 비용으로<br />한 달 내내
          </h2>
          <p className={styles.subtitle}>
            보컬 레슨 1회 평균 5만원. 전문반도 월 24,900원.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className={styles.toggle}>
          <span className={`${styles.toggleLabel} ${!yearly ? styles.toggleActive : ''}`}>월간</span>
          <button
            className={`${styles.toggleSwitch} ${yearly ? styles.toggleOn : ''}`}
            onClick={toggle}
            type="button"
            role="switch"
            aria-checked={yearly}
            aria-label="연간 결제 전환"
          >
            <span className={styles.toggleKnob} />
          </button>
          <span className={`${styles.toggleLabel} ${yearly ? styles.toggleActive : ''}`}>연간</span>
          {yearly && <span className={styles.saveBadge}>40% 절약</span>}
        </div>

        {/* Plan Cards */}
        <div className={styles.grid}>
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <Card
                key={plan.id}
                variant={plan.isFeatured ? 'active' : 'default'}
                className={styles.planCard}
              >
                {plan.badge && <span className={styles.badge}>{plan.badge}</span>}

                <div className={styles.planName}>{plan.name}</div>
                <p className={styles.planTagline}>{plan.tagline}</p>

                <div className={styles.priceRow}>
                  {price === 0 ? (
                    <span className={styles.priceNum}>무료</span>
                  ) : (
                    <>
                      <span className={styles.priceCurrency}>₩</span>
                      <span className={styles.priceNum}>{formatPrice(price)}</span>
                    </>
                  )}
                </div>
                {price > 0 && (
                  <div className={styles.pricePeriod}>
                    / 월{yearly ? ' · 연간 결제' : ''}
                  </div>
                )}

                <div className={styles.divider} />

                <ul className={styles.featureList}>
                  {plan.features.map((feat) => (
                    <li
                      key={feat.label}
                      className={`${styles.featureItem} ${!feat.included ? styles.featureOff : ''}`}
                    >
                      {feat.included ? (
                        <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg className={styles.xIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      )}
                      <span className={(feat as { note?: boolean }).note ? styles.noteText : ''}>
                        {feat.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.ctaVariant}
                  fullWidth
                  onClick={() => window.location.href = '/auth/signup'}
                >
                  {plan.ctaLabel}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
