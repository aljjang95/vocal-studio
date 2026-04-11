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
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
      <div className="text-lg font-bold text-[var(--text)] mb-4 flex items-center gap-2">
        <span className="text-[1.1rem]">&#127908;</span>
        키 추천
        {keyShift !== 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/[0.15] text-[var(--accent-lt)] rounded-[10px] text-[11px] font-semibold">
            {keyShift > 0 ? `+${keyShift}` : keyShift}
          </span>
        )}
      </div>

      {/* Song Range */}
      {songRange && (
        <div className="mb-4">
          <div className="text-xs text-[var(--text2)] font-semibold uppercase tracking-wide mb-1.5">곡 음역대</div>
          <div className="text-sm text-[var(--text)] font-semibold font-[Inter,monospace]">
            {songRange.low} ~ {songRange.high}
          </div>
        </div>
      )}

      {/* Vocal Range Measurement */}
      <div className={`${"mb-5 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg"} ${isMeasuring ? "border-[var(--accent)] animate-pulse" : ''}`}>
        <div className="text-sm font-semibold text-[var(--text)] mb-3">
          {vocalRange ? '내 음역대' : '음역대 측정'}
        </div>

        {vocalRange && !isMeasuring && (
          <div className="flex items-center justify-center gap-3 p-3 bg-[var(--surface2)] rounded-md mb-3">
            <span className="text-base font-bold text-[var(--text)] font-[Inter,monospace]">{vocalRange.low.noteName}</span>
            <span className="text-sm text-[var(--muted)]">~</span>
            <span className="text-base font-bold text-[var(--text)] font-[Inter,monospace]">{vocalRange.high.noteName}</span>
          </div>
        )}

        {isMeasuring && (
          <>
            <div className="text-sm text-[var(--accent-lt)] font-semibold mb-3 min-h-[20px]">
              {measureStep === 'low'
                ? '가장 낮은 음을 내보세요'
                : '가장 높은 음을 내보세요'}
            </div>
            <div className="w-full h-1 bg-[var(--surface2)] rounded-sm overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center text-2xl font-bold text-[var(--accent-lt)] font-[Inter,monospace] min-h-[40px] flex items-center justify-center">
              {currentDetectedNote || '--'}
            </div>
          </>
        )}

        {!isMeasuring && measuredLow && !measuredHigh && (
          <div className="flex items-center justify-center gap-3 p-3 bg-[var(--surface2)] rounded-md mb-3">
            <span className="text-base font-bold text-[var(--text)] font-[Inter,monospace]">{measuredLow.noteName}</span>
            <span className="text-sm text-[var(--muted)]">~</span>
            <span className="text-base font-bold text-[var(--text)] font-[Inter,monospace]">?</span>
          </div>
        )}

        <div className="flex gap-2">
          {!vocalRange && measureStep === 'idle' && !measuredLow && (
            <button
              className="flex-1 px-4 py-2.5 bg-[var(--accent)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => startMeasurement('low')}
            >
              음역대 측정 시작
            </button>
          )}

          {!vocalRange && measureStep === 'idle' && measuredLow && !measuredHigh && (
            <button
              className="flex-1 px-4 py-2.5 bg-[var(--accent)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => startMeasurement('high')}
            >
              최고음 측정하기
            </button>
          )}

          {vocalRange && !isMeasuring && (
            <>
              <button
                className={`${"flex-1 px-4 py-2.5 bg-[var(--accent)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"} ${"bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface3)]"}`}
                onClick={resetMeasurement}
              >
                다시 측정
              </button>
              {songRange && (
                <button
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={fetchRecommendation}
                  disabled={isLoadingRecommend}
                >
                  {isLoadingRecommend ? (
                    <span className="inline-flex gap-1">
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

        {error && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-[var(--error-lt)] text-xs mt-2">{error}</div>}
      </div>

      {/* AI Recommendation */}
      {recommendation && (
        <div className="mb-4 p-3.5 bg-gradient-to-br from-purple-500/[0.08] to-blue-500/[0.08] border border-purple-500/[0.15] rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs text-[var(--accent2-lt)] font-semibold uppercase tracking-wide">AI 추천</span>
          </div>
          <div className="text-xl font-bold text-[var(--text)] mb-1.5">
            {recommendation.shift === 0
              ? '원키 (변경 불필요)'
              : recommendation.shift > 0
                ? `+${recommendation.shift} 반음`
                : `${recommendation.shift} 반음`}
          </div>
          <div className="text-xs text-[var(--text2)] leading-relaxed">{recommendation.reason}</div>
          <button
            className="block w-full py-2 mt-2.5 bg-[var(--accent2)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-colors hover:bg-[var(--accent2-lt)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => applyShift(recommendation.shift)}
          >
            추천 키 적용하기
          </button>
        </div>
      )}

      {/* Key Shift Controls */}
      <div className="mb-4">
        <div className="text-xs text-[var(--text2)] font-semibold uppercase tracking-wide mb-2">키 조절</div>
        <div className="flex items-center gap-3 justify-center">
          <button
            className="w-9 h-9 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] cursor-pointer text-[1.1rem] font-semibold transition-all hover:bg-[var(--surface2)] hover:border-[var(--border2)] disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => {
              const next = localShift - 1;
              setLocalShift(next);
            }}
            disabled={localShift <= -6}
          >
            -
          </button>
          <span className="text-[1.1rem] font-bold text-[var(--text)] min-w-[56px] text-center font-[Inter,monospace]">
            {localShift === 0
              ? '원키'
              : localShift > 0
                ? `+${localShift}`
                : `${localShift}`}
          </span>
          <button
            className="w-9 h-9 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] cursor-pointer text-[1.1rem] font-semibold transition-all hover:bg-[var(--surface2)] hover:border-[var(--border2)] disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => {
              const next = localShift + 1;
              setLocalShift(next);
            }}
            disabled={localShift >= 6}
          >
            +
          </button>
        </div>
        <button className="block w-full py-2.5 bg-[var(--accent)] border-none rounded-md text-white text-sm font-semibold cursor-pointer transition-colors mt-2.5 hover:bg-[var(--accent-lt)]" onClick={() => applyShift(localShift)}>
          적용
        </button>
      </div>

      {/* No range hint */}
      {!vocalRange && measureStep === 'idle' && !measuredLow && (
        <div className="p-4 text-center text-[var(--text2)] text-sm leading-relaxed bg-[var(--surface)] rounded-lg border border-dashed border-[var(--border)]">
          음역대를 측정하면 맞춤 키를 추천해드려요
        </div>
      )}
    </div>
  );
}
