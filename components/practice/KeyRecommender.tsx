'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { saveUserProfile, getUserProfile } from '@/lib/storage/songDB';
import { getAudioContext, resumeAudioContext } from '@/lib/audio/audioEngine';
import {
  frequencyToNoteName,
  noteNameToMidi,
  midiToNoteName,
} from '@/lib/audio/musicUtils';
import { PITCH_CONFIDENCE_THRESHOLD } from '@/lib/audio/constants';
import type { UserVocalRange } from '@/types';
import styles from './KeyRecommender.module.css';

// ── Measurement states ──

type MeasureStep = 'idle' | 'low' | 'high' | 'done';

const MEASURE_DURATION_MS = 3000;

// ── Inline pitch detection for measurement (lightweight, separate from main detector) ──

async function detectPitchFromMic(
  ctx: AudioContext,
  durationMs: number,
  onPitch: (freq: number, note: string) => void,
  signal: AbortSignal,
): Promise<{ frequency: number; noteName: string } | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  if (signal.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);
  const candidates: number[] = [];

  return new Promise((resolve) => {
    const startTime = Date.now();

    function detect() {
      if (signal.aborted || Date.now() - startTime >= durationMs) {
        // Clean up
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());

        if (candidates.length === 0) {
          resolve(null);
          return;
        }

        // Take median of collected frequencies
        candidates.sort((a, b) => a - b);
        const median = candidates[Math.floor(candidates.length / 2)];
        resolve({
          frequency: median,
          noteName: frequencyToNoteName(median),
        });
        return;
      }

      analyser.getFloatTimeDomainData(buffer);
      const freq = yinDetect(buffer, ctx.sampleRate);

      if (freq > 50 && freq < 2000) {
        candidates.push(freq);
        onPitch(freq, frequencyToNoteName(freq));
      }

      requestAnimationFrame(detect);
    }

    requestAnimationFrame(detect);
  });
}

/** Simple YIN pitch detection (same algorithm as pitchDetector worklet) */
function yinDetect(buf: Float32Array, sampleRate: number): number {
  const halfLen = Math.floor(buf.length / 2);
  const yinBuffer = new Float32Array(halfLen);
  const THRESHOLD = 0.15;

  // Difference function
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Cumulative mean normalized difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = (yinBuffer[tau] * tau) / runningSum;
  }

  // Absolute threshold
  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau++) {
    if (yinBuffer[tau] < THRESHOLD) {
      while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return 0;

  // Parabolic interpolation
  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
  const x2 = tauEstimate + 1 < halfLen ? tauEstimate + 1 : tauEstimate;
  let betterTau: number;
  if (x0 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
  } else if (x2 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
  } else {
    const s0 = yinBuffer[x0],
      s1 = yinBuffer[tauEstimate],
      s2 = yinBuffer[x2];
    betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  const confidence = 1 - (yinBuffer[tauEstimate] || 0);
  if (confidence < PITCH_CONFIDENCE_THRESHOLD) return 0;

  return sampleRate / betterTau;
}

// ── Component ──

export default function KeyRecommender() {
  const {
    keyShift,
    setKeyShift,
    currentAnalysis,
  } = usePracticeStore();

  const [vocalRange, setVocalRange] = useState<UserVocalRange | null>(null);
  const [measureStep, setMeasureStep] = useState<MeasureStep>('idle');
  const [progress, setProgress] = useState(0);
  const [currentDetectedNote, setCurrentDetectedNote] = useState('');
  const [measuredLow, setMeasuredLow] = useState<{ frequency: number; noteName: string } | null>(null);
  const [measuredHigh, setMeasuredHigh] = useState<{ frequency: number; noteName: string } | null>(null);

  const [localShift, setLocalShift] = useState(keyShift);
  const [recommendation, setRecommendation] = useState<{ shift: number; reason: string } | null>(null);
  const [isLoadingRecommend, setIsLoadingRecommend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved vocal range on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    getUserProfile('vocalRange').then((data) => {
      if (data) {
        setVocalRange(data as UserVocalRange);
      }
    });
  }, []);

  // Sync localShift when store changes
  useEffect(() => {
    setLocalShift(keyShift);
  }, [keyShift]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const startMeasurement = useCallback(async (step: 'low' | 'high') => {
    if (typeof window === 'undefined') return;

    setError(null);
    setMeasureStep(step);
    setProgress(0);
    setCurrentDetectedNote('');

    // Abort any previous measurement
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Progress bar animation
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / MEASURE_DURATION_MS) * 100);
      setProgress(pct);
    }, 50);

    try {
      await resumeAudioContext();
      const ctx = getAudioContext();

      const result = await detectPitchFromMic(
        ctx,
        MEASURE_DURATION_MS,
        (_freq, note) => {
          setCurrentDetectedNote(note);
        },
        controller.signal,
      );

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);

      if (!result) {
        setError('음성이 감지되지 않았습니다. 다시 시도해주세요.');
        setMeasureStep('idle');
        return;
      }

      if (step === 'low') {
        setMeasuredLow(result);
        setMeasureStep('idle');
      } else {
        setMeasuredHigh(result);

        // Both measurements done - save
        const low = step === 'high' ? measuredLow : result;
        const high = result;

        if (low && high) {
          const range: UserVocalRange = {
            measuredAt: new Date().toISOString(),
            low: { frequency: low.frequency, noteName: low.noteName },
            high: { frequency: high.frequency, noteName: high.noteName },
          };

          // Validate: low should be lower than high
          const lowMidi = noteNameToMidi(low.noteName);
          const highMidi = noteNameToMidi(high.noteName);

          if (lowMidi >= highMidi) {
            setError('최저음이 최고음보다 높습니다. 다시 측정해주세요.');
            setMeasureStep('idle');
            return;
          }

          setVocalRange(range);
          await saveUserProfile('vocalRange', range);
          setMeasureStep('done');
        } else {
          setMeasureStep('idle');
        }
      }
    } catch (err) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('마이크 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
      } else {
        setError('측정 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      setMeasureStep('idle');
    }
  }, [measuredLow]);

  const resetMeasurement = useCallback(() => {
    setMeasuredLow(null);
    setMeasuredHigh(null);
    setMeasureStep('idle');
    setCurrentDetectedNote('');
    setProgress(0);
    setRecommendation(null);
  }, []);

  // Fetch AI recommendation
  const fetchRecommendation = useCallback(async () => {
    if (!vocalRange || !currentAnalysis?.songRange) return;

    setIsLoadingRecommend(true);
    setError(null);

    try {
      const response = await fetch('/api/recommend-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRange: {
            low: vocalRange.low.noteName,
            high: vocalRange.high.noteName,
          },
          songRange: currentAnalysis.songRange,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '추천 요청 실패');
      }

      const data = await response.json();
      setRecommendation({
        shift: data.recommendedShift,
        reason: data.reason,
      });
    } catch (err) {
      // Fallback: simple calculation
      const userHighMidi = noteNameToMidi(vocalRange.high.noteName);
      const songHighMidi = noteNameToMidi(currentAnalysis.songRange.high);

      if (userHighMidi > 0 && songHighMidi > 0) {
        const diff = userHighMidi - songHighMidi;
        // Leave 2 semitones of safety margin
        const shift = Math.max(-6, Math.min(6, diff - 2));
        setRecommendation({
          shift: shift > 0 ? 0 : shift, // don't raise if user can already hit
          reason: `곡의 최고음(${currentAnalysis.songRange.high})과 음역대를 비교한 단순 계산 결과입니다.`,
        });
      } else {
        setError(err instanceof Error ? err.message : '추천을 가져올 수 없습니다.');
      }
    } finally {
      setIsLoadingRecommend(false);
    }
  }, [vocalRange, currentAnalysis]);

  const applyShift = useCallback((shift: number) => {
    const clamped = Math.max(-6, Math.min(6, shift));
    setLocalShift(clamped);
    setKeyShift(clamped);
  }, [setKeyShift]);

  const songRange = currentAnalysis?.songRange;
  const isMeasuring = measureStep === 'low' || measureStep === 'high';

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <span className={styles.titleIcon}>&#127908;</span>
        키 추천
        {keyShift !== 0 && (
          <span className={styles.appliedBadge}>
            {keyShift > 0 ? `+${keyShift}` : keyShift}
          </span>
        )}
      </div>

      {/* Song Range */}
      {songRange && (
        <div className={styles.songRangeSection}>
          <div className={styles.songRangeLabel}>곡 음역대</div>
          <div className={styles.songRangeValue}>
            {songRange.low} ~ {songRange.high}
          </div>
        </div>
      )}

      {/* Vocal Range Measurement */}
      <div className={`${styles.measureSection} ${isMeasuring ? styles.measuring : ''}`}>
        <div className={styles.measureTitle}>
          {vocalRange ? '내 음역대' : '음역대 측정'}
        </div>

        {vocalRange && !isMeasuring && (
          <div className={styles.rangeDisplay}>
            <span className={styles.rangeNote}>{vocalRange.low.noteName}</span>
            <span className={styles.rangeSeparator}>~</span>
            <span className={styles.rangeNote}>{vocalRange.high.noteName}</span>
          </div>
        )}

        {isMeasuring && (
          <>
            <div className={styles.measurePrompt}>
              {measureStep === 'low'
                ? '가장 낮은 음을 내보세요'
                : '가장 높은 음을 내보세요'}
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.currentNote}>
              {currentDetectedNote || '--'}
            </div>
          </>
        )}

        {!isMeasuring && measuredLow && !measuredHigh && (
          <div className={styles.rangeDisplay}>
            <span className={styles.rangeNote}>{measuredLow.noteName}</span>
            <span className={styles.rangeSeparator}>~</span>
            <span className={styles.rangeNote}>?</span>
          </div>
        )}

        <div className={styles.measureBtnRow}>
          {!vocalRange && measureStep === 'idle' && !measuredLow && (
            <button
              className={styles.measureBtn}
              onClick={() => startMeasurement('low')}
            >
              음역대 측정 시작
            </button>
          )}

          {!vocalRange && measureStep === 'idle' && measuredLow && !measuredHigh && (
            <button
              className={styles.measureBtn}
              onClick={() => startMeasurement('high')}
            >
              최고음 측정하기
            </button>
          )}

          {vocalRange && !isMeasuring && (
            <>
              <button
                className={`${styles.measureBtn} ${styles.measureBtnSecondary}`}
                onClick={resetMeasurement}
              >
                다시 측정
              </button>
              {songRange && (
                <button
                  className={styles.measureBtn}
                  onClick={fetchRecommendation}
                  disabled={isLoadingRecommend}
                >
                  {isLoadingRecommend ? (
                    <span className={styles.loadingDots}>
                      AI 분석중<span></span><span></span><span></span>
                    </span>
                  ) : (
                    'AI 키 추천'
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>

      {/* AI Recommendation */}
      {recommendation && (
        <div className={styles.recommendSection}>
          <div className={styles.recommendHeader}>
            <span className={styles.recommendLabel}>AI 추천</span>
          </div>
          <div className={styles.recommendShift}>
            {recommendation.shift === 0
              ? '원키 (변경 불필요)'
              : recommendation.shift > 0
                ? `+${recommendation.shift} 반음`
                : `${recommendation.shift} 반음`}
          </div>
          <div className={styles.recommendReason}>{recommendation.reason}</div>
          <button
            className={styles.recommendBtn}
            onClick={() => applyShift(recommendation.shift)}
          >
            추천 키 적용하기
          </button>
        </div>
      )}

      {/* Key Shift Controls */}
      <div className={styles.keySection}>
        <div className={styles.keySectionLabel}>키 조절</div>
        <div className={styles.keyControls}>
          <button
            className={styles.keyBtn}
            onClick={() => {
              const next = localShift - 1;
              setLocalShift(next);
            }}
            disabled={localShift <= -6}
          >
            -
          </button>
          <span className={styles.keyValue}>
            {localShift === 0
              ? '원키'
              : localShift > 0
                ? `+${localShift}`
                : `${localShift}`}
          </span>
          <button
            className={styles.keyBtn}
            onClick={() => {
              const next = localShift + 1;
              setLocalShift(next);
            }}
            disabled={localShift >= 6}
          >
            +
          </button>
        </div>
        <button className={styles.applyBtn} onClick={() => applyShift(localShift)}>
          적용
        </button>
      </div>

      {/* No range hint */}
      {!vocalRange && measureStep === 'idle' && !measuredLow && (
        <div className={styles.noRangeHint}>
          음역대를 측정하면 맞춤 키를 추천해드려요
        </div>
      )}
    </div>
  );
}
