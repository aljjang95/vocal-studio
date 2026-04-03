import { IconLock, IconTarget, IconMic, IconChart } from '@/components/shared/Icons';
import styles from './HowItWorks.module.css';

const STEPS = [
  { icon: <IconLock size={26} />, num: '01', title: '무료 가입', desc: '신용카드 없이 7일 무료. 30초면 가입이 완료됩니다.' },
  { icon: <IconTarget size={26} />, num: '02', title: '목표 설정', desc: '현재 수준과 목표를 알려주면 AI가 맞춤 커리큘럼을 설계합니다.' },
  { icon: <IconMic size={26} />, num: '03', title: 'AI와 연습',  desc: '노래하면 AI가 실시간으로 분석하고 즉시 피드백을 전달합니다.' },
  { icon: <IconChart size={26} />, num: '04', title: '성장 확인',  desc: '매주 성장 리포트로 내 목소리가 얼마나 발전했는지 확인하세요.' },
];

export default function HowItWorks() {
  return (
    <section id="how" className={styles.how}>
      <div className="container">
        <div className="section-head center reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>사용 방법</div>
          <h2 className="section-title">4단계로 <em>시작하세요</em></h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            복잡한 설정 없이, 지금 당장 노래하면서 AI 코칭을 경험할 수 있습니다.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          {STEPS.map((step) => (
            <div key={step.num} className={`${styles.step} reveal`}>
              <div className={styles.stepNumWrap}>
                <div className={styles.stepEmoji}>{step.icon}</div>
                <div className={styles.stepN}>{step.num}</div>
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
