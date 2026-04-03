import styles from './Proof.module.css';

const LOGOS = ['Melodist', 'SingPro', 'VoiceUp', 'TuneAI', 'PitchMaster'];

export default function Proof() {
  return (
    <section id="proof" className={styles.proof}>
      <div className="container">
        <div className={styles.proofInner}>
          <span className={styles.proofLabel}>사용자들이 선택한 보컬 트레이닝</span>
          <div className={styles.proofLogos}>
            {LOGOS.map((name) => (
              <span key={name} className={styles.proofItem}>{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
