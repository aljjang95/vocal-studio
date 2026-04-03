'use client';

import { useRef } from 'react';
import styles from './Waveform.module.css';

interface WaveformProps {
  count?: number;
  animated?: boolean;
  className?: string;
}

interface BarData {
  minH: number;
  maxH: number;
  dur: number;
  delay: number;
}

// Fixed heights for Feature mini waveform
const FEAT_HEIGHTS = [20, 35, 50, 40, 60, 55, 70, 65, 80, 75, 68, 90, 85, 72, 60, 78, 65, 50, 40, 55, 70];

export default function Waveform({ count = 40, animated = true, className }: WaveformProps) {
  // 랜덤값은 마운트 시 1회만 생성 — SSR hydration 불일치 방지
  const barsRef = useRef<BarData[] | null>(null);
  if (!barsRef.current) {
    barsRef.current = Array.from({ length: count }, () => ({
      minH: Math.random() * 8 + 4,
      maxH: Math.random() * 30 + 10,
      dur: parseFloat((Math.random() * 0.9 + 0.4).toFixed(2)),
      delay: parseFloat((Math.random() * 0.8).toFixed(2)),
    }));
  }

  return (
    <div className={`${styles.waveformWrap} ${className ?? ''}`}>
      {barsRef.current.map((bar, i) => (
        <div
          key={i}
          className={styles.waveBar}
          style={{
            ['--min-h' as string]: `${bar.minH}px`,
            ['--max-h' as string]: `${bar.maxH}px`,
            ['--dur' as string]: `${bar.dur}s`,
            animationDelay: animated ? `${bar.delay}s` : '0s',
            animationPlayState: animated ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}

export function FeatMiniWaveform() {
  return (
    <div className={styles.featMiniBars}>
      {FEAT_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={styles.fmb}
          style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}
