import ChatBox from '@/components/coach/ChatBox';
import { IconMic, IconChat, IconZap, IconTarget } from '@/components/shared/Icons';
import styles from './Demo.module.css';

const DEMO_ROWS = [
  {
    icon: <IconMic size={20} />,
    bg: 'rgba(59,130,246,0.12)',
    title: '실제 AI가 답합니다',
    desc: '미리 만든 답변이 아닙니다. 7년 트레이너 커리큘럼을 학습한 AI가 당신의 질문에 맞춤 답변을 생성합니다.',
  },
  {
    icon: <IconChat size={20} />,
    bg: 'rgba(59,130,246,0.08)',
    title: '어떤 질문이든 OK',
    desc: '고음 내는 법, 호흡 조절, 발음 교정, 오디션 곡 선정까지 — 보컬에 관한 모든 고민을 해결해 드립니다.',
  },
  {
    icon: <IconZap size={20} />,
    bg: 'rgba(34,197,94,0.12)',
    title: '즉각적인 피드백',
    desc: '레슨 예약도, 대기도 없습니다. 지금 이 순간 궁금한 것을 바로 물어보고 전문가 수준의 답변을 받으세요.',
  },
];

export default function Demo() {
  return (
    <section id="demo" className={styles.demo}>
      <div className="container">
        <div className={styles.demoInner}>

          {/* Chat */}
          <div>
            <div className="section-head reveal">
              <div className="section-kicker">AI 코치 직접 체험</div>
              <h2 className="section-title">지금 바로<br /><em>물어보세요</em></h2>
              <p className="section-desc">
                고음, 호흡, 발성, 오디션 준비 — 보컬에 관한 무엇이든 실제 AI 코치가 답해드립니다.
              </p>
            </div>
            <ChatBox />
          </div>

          {/* Description rows */}
          <div className={`${styles.demoDesc} reveal`}>
            {DEMO_ROWS.map((row) => (
              <div key={row.title} className={styles.demoRow}>
                <div className={styles.demoRowIcon} style={{ background: row.bg }}>
                  {row.icon}
                </div>
                <div>
                  <div className={styles.demoRowTitle}>{row.title}</div>
                  <div className={styles.demoRowDesc}>{row.desc}</div>
                </div>
              </div>
            ))}
            <div className={styles.demoCta}>
              <a href="/diagnosis" className="btn-primary">
                <IconTarget size={18} /> AI 보컬 진단 받기
              </a>
              <p className={styles.demoCtaSub}>
                4단계 설문으로 나만의 보컬 리포트를 받아보세요
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
