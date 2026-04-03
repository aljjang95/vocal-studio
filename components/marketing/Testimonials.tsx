import { IconMic, IconTheater, IconMusic, IconGuitar, IconSax, IconSheet } from '@/components/shared/Icons';
import styles from './Testimonials.module.css';

const TESTIMONIALS = [
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '3개월 만에 음역대가 1.5옥타브 늘었어요. 선생님한테 배우는 것 같은 느낌인데 24시간 언제든 물어볼 수 있다는 게 진짜 신기해요.',
    name: '김지은',
    role: '팝 보컬 연습생',
    ava: <IconMic size={15} />,
    avaBg: 'rgba(59,130,246,0.18)',
  },
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '오디션 2주 전에 시작했는데 합격했어요! AI가 제 약점을 정확히 짚어주고 매일 연습 루틴을 짜줘서 집중 훈련이 가능했어요.',
    name: '박민준',
    role: '뮤지컬 지망생',
    ava: <IconTheater size={15} />,
    avaBg: 'rgba(59,130,246,0.14)',
  },
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '호흡 문제로 고음을 못 냈는데 AI 코치가 정확히 뭐가 문제인지 설명해줬어요. 1달 만에 확실히 달라진 걸 느꼈습니다.',
    name: '이수아',
    role: 'R&B 싱어송라이터',
    ava: <IconMusic size={15} />,
    avaBg: 'rgba(34,197,94,0.18)',
  },
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '사설 레슨은 너무 비싸서 엄두도 못 냈는데, HLB 보컬스튜디오로 비슷한 수준의 피드백을 훨씬 저렴하게 받고 있어요. 정말 강추!',
    name: '최현우',
    role: '취미 가수',
    ava: <IconGuitar size={15} />,
    avaBg: 'rgba(244,63,94,0.15)',
  },
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '발음이 부정확해서 노래할 때 자신감이 없었는데, 발음 교정 루틴을 2주 동안 따라 했더니 확연히 달라졌어요.',
    name: '정다빈',
    role: '재즈 보컬 입문자',
    ava: <IconSax size={15} />,
    avaBg: 'rgba(59,130,246,0.18)',
  },
  {
    stars: '\u2605\u2605\u2605\u2605\u2605',
    quote: '복식호흡부터 차근차근 가르쳐줘서 기초부터 탄탄하게 쌓을 수 있었어요. AI인데 정말 전문가 같아서 깜짝 놀랐습니다.',
    name: '한도윤',
    role: '클래식 발성 학습자',
    ava: <IconSheet size={15} />,
    avaBg: 'rgba(59,130,246,0.14)',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className={styles.testimonials}>
      <div className="container">
        <div className="section-head center reveal">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>사용자 후기</div>
          <h2 className="section-title">
            실제로 <em>성장한</em> 이야기
          </h2>
          <p className="section-desc" style={{ textAlign: 'center' }}>
            HLB 보컬스튜디오와 함께 목소리를 키운 수강생들의 생생한 후기입니다.
          </p>
        </div>

        <div className={styles.testiGrid}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className={`${styles.testiCard} reveal`}>
              <div className={styles.testiStars}>{t.stars}</div>
              <p className={styles.testiQuote}>&ldquo;{t.quote}&rdquo;</p>
              <div className={styles.testiAuthor}>
                <div className={styles.testiAva} style={{ background: t.avaBg }}>
                  {t.ava}
                </div>
                <div>
                  <div className={styles.testiName}>{t.name}</div>
                  <div className={styles.testiRole}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
