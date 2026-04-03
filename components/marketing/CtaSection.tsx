import { IconMic } from '@/components/shared/Icons';
import styles from './CtaSection.module.css';

export default function CtaSection() {
  return (
    <section id="cta" className={styles.cta}>
      <div className={styles.ctaGlow} aria-hidden="true" />
      <div className="container">
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            지금 바로<br />
            <em>당신의 목소리를</em><br />
            깨워보세요
          </h2>
          <p className={styles.ctaSub}>
            7일 무료 체험으로 시작하세요. 신용카드 없이, 언제든 취소 가능합니다.<br />
            수천 명의 수강생이 HLB 보컬스튜디오와 함께 목소리를 바꿨습니다.
          </p>
          <div className={styles.ctaBtns}>
            <a href="/diagnosis" className="btn-primary">
              <IconMic size={18} /> 지금 무료 체험
            </a>
            <a href="#pricing" className="btn-outline">
              요금제 보기 →
            </a>
          </div>
          <p className={styles.ctaFine}>
            신용카드 불필요 &middot; 7일 무료 체험 &middot; 언제든 취소 가능
          </p>
        </div>
      </div>
    </section>
  );
}
