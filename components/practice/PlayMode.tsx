'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { getBlob, saveSession } from '@/lib/storage/songDB';
import { getAudioContext, resumeAudioContext } from '@/lib/audio/audioEngine';
import {
  startPitchDetection,
  stopPitchDetection,
  isPitchDetectionActive,
} from '@/lib/audio/pitchDetector';
import type { PitchData } from '@/lib/audio/pitchDetector';
import type { Song, MelodyPoint, SessionScore } from '@/types';
import styles from './PlayMode.module.css';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  song: Song;
}

export default function PlayMode({ song }: Props) {
  const {
    isPlaying,
    isRecording,
    currentTime,
    duration,
    mrVolume,
    playbackRate,
    startPlay,
    endPlay,
    setCurrentTime,
    setDuration,
    setCurrentSession,
    setShowResult,
  } = usePracticeStore();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'scoring'>('ready');
  const [currentNote, setCurrentNote] = useState<string>('--');
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Audio refs
  const mrBufferRef = useRef<AudioBuffer | null>(null);
  const mrSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mrGainRef = useRef<GainNode | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const pitchDataRef = useRef<MelodyPoint[]>([]);
  const loadedIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  // Load MR buffer
  useEffect(() => {
    if (!song || loadedIdRef.current === song.id) return;
    let cancelled = false;

    async function load() {
      if (!song) return;
      const ctx = getAudioContext();
      const blob = await getBlob(song.instrumentalBlobKey);
      if (!blob || cancelled) return;

      const arrayBuffer = await blob.arrayBuffer();
      if (cancelled) return;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (cancelled) return;

      mrBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      loadedIdRef.current = song.id;
    }

    load();
    return () => { cancelled = true; };
  }, [song, setDuration]);

  // Initialize gain node
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = getAudioContext();
    if (!mrGainRef.current) {
      mrGainRef.current = ctx.createGain();
      mrGainRef.current.connect(ctx.destination);
    }

    return () => {
      stopAllAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync MR volume
  useEffect(() => {
    if (mrGainRef.current) {
      mrGainRef.current.gain.value = mrVolume;
    }
  }, [mrVolume]);

  const stopAllAudio = useCallback(() => {
    try {
      if (mrSourceRef.current) {
        mrSourceRef.current.onended = null;
        mrSourceRef.current.stop();
        mrSourceRef.current.disconnect();
      }
    } catch { /* already stopped */ }
    mrSourceRef.current = null;

    if (isPitchDetectionActive()) {
      stopPitchDetection();
    }

    cancelAnimationFrame(animFrameRef.current);
    isPlayingRef.current = false;
  }, []);

  const onPitch = useCallback((data: PitchData) => {
    setCurrentNote(data.noteName);
    setCurrentFreq(data.frequency);

    pitchDataRef.current.push({
      time: usePracticeStore.getState().currentTime,
      frequency: data.frequency,
      noteName: data.noteName,
    });
  }, []);

  const calculateScore = useCallback((): number => {
    const points = pitchDataRef.current;
    if (points.length === 0) return 0;

    // Simple scoring: percentage of detected points with reasonable frequency
    const validPoints = points.filter((p) => p.frequency > 80 && p.frequency < 1200);
    const coverage = Math.min(1, validPoints.length / Math.max(1, duration * 2));

    // Basic consistency score: check if frequencies don't jump wildly
    let consistencyScore = 1;
    if (validPoints.length > 1) {
      let jumpCount = 0;
      for (let i = 1; i < validPoints.length; i++) {
        const ratio = validPoints[i].frequency / validPoints[i - 1].frequency;
        if (ratio > 2 || ratio < 0.5) jumpCount++;
      }
      consistencyScore = 1 - (jumpCount / validPoints.length);
    }

    // Combine: coverage * 40 + consistency * 60
    const raw = (coverage * 40 + consistencyScore * 60);
    return Math.round(Math.max(0, Math.min(100, raw)));
  }, [duration]);

  const finishPlay = useCallback(async (partial: boolean) => {
    stopAllAudio();
    endPlay();
    setPhase('scoring');

    const score = calculateScore();
    const actualDuration = usePracticeStore.getState().currentTime;

    const session: SessionScore = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      songId: song.id,
      playedAt: new Date().toISOString(),
      keyShift: usePracticeStore.getState().keyShift,
      overallScore: score,
      sectionScores: [],
      userPitchData: pitchDataRef.current,
      duration: partial ? actualDuration : duration,
    };

    try {
      await saveSession(session);
    } catch {
      // Session save failure is non-critical
    }

    setCurrentSession(session);
    setShowResult(true);
    setPhase('ready');
    pitchDataRef.current = [];
    setCurrentNote('--');
    setCurrentFreq(0);
  }, [stopAllAudio, endPlay, calculateScore, song.id, duration, setCurrentSession, setShowResult]);

  const handleStart = useCallback(async () => {
    if (!mrBufferRef.current || !mrGainRef.current) return;

    const ctx = getAudioContext();
    await resumeAudioContext();

    pitchDataRef.current = [];
    setPhase('playing');

    // Create and start MR source
    const source = ctx.createBufferSource();
    source.buffer = mrBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(mrGainRef.current);

    source.onended = () => {
      if (isPlayingRef.current) {
        finishPlay(false);
      }
    };

    source.start(0);
    mrSourceRef.current = source;
    playStartTimeRef.current = ctx.currentTime;
    isPlayingRef.current = true;
    startPlay();

    // Start pitch detection
    try {
      await startPitchDetection(onPitch);
    } catch {
      // Pitch detection failure is non-critical, continue without it
    }

    // Time update loop
    function tick() {
      if (!isPlayingRef.current) return;
      const ctx = getAudioContext();
      const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
      setCurrentTime(elapsed);
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }, [playbackRate, startPlay, onPitch, setCurrentTime, finishPlay]);

  const handleStopRequest = useCallback(() => {
    setShowStopConfirm(true);
  }, []);

  const handleStopConfirm = useCallback(() => {
    setShowStopConfirm(false);
    finishPlay(true);
  }, [finishPlay]);

  const handleStopCancel = useCallback(() => {
    setShowStopConfirm(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const separationStatus = song.separationStatus ?? 'done';

  return (
    <div className={styles.playMode}>
      {/* Song header */}
      <div className={styles.songHeader}>
        <div className={styles.songTitle}>{song.title}</div>
        <div className={styles.songArtist}>{song.artist}</div>
      </div>

      {separationStatus === 'pending' && (
        <div className={styles.pendingNotice}>
          보컬 분리 진행 중입니다. 원본 파일로 MR이 재생됩니다.
        </div>
      )}

      {/* Pitch display */}
      <div className={styles.pitchArea}>
        <div className={styles.currentNote}>{currentNote}</div>
        {currentFreq > 0 && (
          <div className={styles.currentFreq}>{currentFreq.toFixed(1)} Hz</div>
        )}
      </div>

      {/* Lyrics placeholder */}
      <div className={styles.lyricsPlaceholder}>
        <span className={styles.placeholderText}>가사 표시 영역 (향후 업데이트)</span>
      </div>

      {/* Progress */}
      {phase === 'playing' && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <div className={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        {phase === 'ready' && (
          <button
            className={styles.startBtn}
            onClick={handleStart}
            disabled={!mrBufferRef.current}
          >
            시작
          </button>
        )}

        {phase === 'playing' && (
          <button
            className={styles.stopBtn}
            onClick={handleStopRequest}
          >
            중간에 그만두기
          </button>
        )}

        {phase === 'scoring' && (
          <div className={styles.scoringText}>
            채점 중...
          </div>
        )}
      </div>

      {/* Stop confirmation */}
      {showStopConfirm && (
        <div className={styles.confirmOverlay} onClick={handleStopCancel}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmText}>
              여기까지 채점할까요?
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={handleStopCancel}>
                계속 부르기
              </button>
              <button className={styles.confirmOk} onClick={handleStopConfirm}>
                채점하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
