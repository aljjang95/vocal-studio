'use client';

import Link from 'next/link';
import AudioPlayer from '@/components/ai-cover/AudioPlayer';
import styles from './DemoSection.module.css';

const DEMO_SAMPLES = [
  {
    title: '발라드 데모',
    original: '/audio/demo-original-1.wav',
    converted: '/audio/demo-converted-1.wav',
  },
  {
    title: '팝 데모',
    original: '/audio/demo-original-2.wav',
    converted: '/audio/demo-converted-2.wav',
  },
];

export default function DemoSection() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          AI로 내 목소리가
          <br />
          <span className={styles.accent}>이렇게!</span>
        </h1>
        <p className={styles.subtitle}>
          AI 음성 변환 기술로 좋아하는 노래를 내 목소리로 불러보세요.
        </p>
      </div>

      <div className={styles.sampleList}>
        {DEMO_SAMPLES.map((sample) => (
          <div key={sample.title} className={styles.sampleCard}>
            <h3 className={styles.sampleTitle}>{sample.title}</h3>
            <AudioPlayer
              src={sample.converted}
              compareSrc={sample.original}
              label="원본"
              compareLabel="AI 커버"
            />
          </div>
        ))}
      </div>

      <div className={styles.ctaCard}>
        <p className={styles.ctaText}>
          가입하면 내 목소리로 체험할 수 있습니다
        </p>
        <Link href="/auth/login" className={styles.ctaBtn}>
          무료로 시작하기
        </Link>
      </div>
    </div>
  );
}
