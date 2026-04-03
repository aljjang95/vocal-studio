'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { getBlob } from '@/lib/storage/songDB';
import { getAudioContext, resumeAudioContext } from '@/lib/audio/audioEngine';
import {
  createPitchShifter,
  setPitchShift,
  disposePitchShifter,
} from '@/lib/audio/pitchShifter';
import type { Song } from '@/types';
import styles from './PracticePlayer.module.css';

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  song: Song | null;
}

export default function PracticePlayer({ song }: Props) {
  const {
    isPlaying,
    playbackRate,
    mrVolume,
    vocalGuideVolume,
    loopStart,
    loopEnd,
    currentTime,
    keyShift,
    setPlaying,
    setPlaybackRate,
    setMrVolume,
    setVocalGuideVolume,
    setCurrentTime,
    setDuration,
    setKeyShift,
  } = usePracticeStore();

  const seekbarRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [duration, setLocalDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const loadedSongIdRef = useRef<string | null>(null);

  // Web Audio API refs
  const mrBufferRef = useRef<AudioBuffer | null>(null);
  const vocalBufferRef = useRef<AudioBuffer | null>(null);
  const mrSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mrGainRef = useRef<GainNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const playStartTimeRef = useRef<number>(0); // AudioContext.currentTime when play started
  const playOffsetRef = useRef<number>(0); // offset into the buffer when play started
  const isPlayingRef = useRef(false);

  // Pitch shifter refs
  const mrShifterRef = useRef<AudioWorkletNode | null>(null);
  const vocalShifterRef = useRef<AudioWorkletNode | null>(null);
  const pitchShifterReady = useRef(false);

  // Initialize gain nodes and pitch shifter
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = getAudioContext();

    if (!mrGainRef.current) {
      mrGainRef.current = ctx.createGain();
      mrGainRef.current.connect(ctx.destination);
    }
    if (!vocalGainRef.current) {
      vocalGainRef.current = ctx.createGain();
      vocalGainRef.current.connect(ctx.destination);
    }

    // Initialize pitch shifters
    async function initShifters() {
      try {
        const mrShifter = await createPitchShifter(ctx);
        mrShifterRef.current = mrShifter;

        // Create a separate worklet node for vocal track
        const vocalShifter = new AudioWorkletNode(ctx, 'pitch-shifter-processor');
        vocalShifterRef.current = vocalShifter;

        // Reconnect gain nodes through shifters:
        // source -> shifter -> gain -> destination
        // We only rewire the gain->destination connection; sources are connected per play
        mrGainRef.current!.disconnect();
        mrGainRef.current!.connect(ctx.destination);

        vocalGainRef.current!.disconnect();
        vocalGainRef.current!.connect(ctx.destination);

        pitchShifterReady.current = true;

        // Apply current keyShift
        const currentShift = usePracticeStore.getState().keyShift;
        if (currentShift !== 0) {
          setPitchShift(currentShift);
          vocalShifter.port.postMessage({ type: 'setPitchShift', semitones: currentShift });
        }
      } catch {
        // Worklet failed to load - continue without pitch shifting
        pitchShifterReady.current = false;
      }
    }

    initShifters();

    return () => {
      stopSources();
      disposePitchShifter();
      if (vocalShifterRef.current) {
        vocalShifterRef.current.disconnect();
        vocalShifterRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSources = useCallback(() => {
    try {
      if (mrSourceRef.current) {
        mrSourceRef.current.onended = null;
        mrSourceRef.current.stop();
        mrSourceRef.current.disconnect();
      }
    } catch { /* already stopped */ }
    mrSourceRef.current = null;

    try {
      if (vocalSourceRef.current) {
        vocalSourceRef.current.onended = null;
        vocalSourceRef.current.stop();
        vocalSourceRef.current.disconnect();
      }
    } catch { /* already stopped */ }
    vocalSourceRef.current = null;
  }, []);

  const createAndStartSources = useCallback((offset: number, rate: number) => {
    const ctx = getAudioContext();
    stopSources();

    const useShifter = pitchShifterReady.current && usePracticeStore.getState().keyShift !== 0;

    if (mrBufferRef.current && mrGainRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = mrBufferRef.current;
      source.playbackRate.value = rate;

      // Route: source -> [shifter ->] gain
      if (useShifter && mrShifterRef.current) {
        source.connect(mrShifterRef.current);
        mrShifterRef.current.connect(mrGainRef.current);
      } else {
        source.connect(mrGainRef.current);
      }

      source.onended = () => {
        if (isPlayingRef.current) {
          // Check if we should loop
          const store = usePracticeStore.getState();
          if (store.loopStart !== null && store.loopEnd !== null) {
            const loopOffset = store.loopStart;
            playOffsetRef.current = loopOffset;
            playStartTimeRef.current = ctx.currentTime;
            createAndStartSources(loopOffset, rate);
          } else {
            setPlaying(false);
            setCurrentTime(0);
          }
        }
      };

      source.start(0, offset);
      mrSourceRef.current = source;
    }

    if (vocalBufferRef.current && vocalGainRef.current) {
      const source = ctx.createBufferSource();
      source.buffer = vocalBufferRef.current;
      source.playbackRate.value = rate;

      // Route: source -> [shifter ->] gain
      if (useShifter && vocalShifterRef.current) {
        source.connect(vocalShifterRef.current);
        vocalShifterRef.current.connect(vocalGainRef.current);
      } else {
        source.connect(vocalGainRef.current);
      }

      source.start(0, offset);
      vocalSourceRef.current = source;
    }

    playStartTimeRef.current = ctx.currentTime;
    playOffsetRef.current = offset;
  }, [stopSources, setPlaying, setCurrentTime]);

  // Load song blobs and decode to AudioBuffers
  useEffect(() => {
    if (!song) {
      mrBufferRef.current = null;
      vocalBufferRef.current = null;
      loadedSongIdRef.current = null;
      setLocalDuration(0);
      setDuration(0);
      return;
    }

    if (loadedSongIdRef.current === song.id) return;

    let cancelled = false;

    async function loadAudio() {
      if (!song) return;
      const ctx = getAudioContext();

      try {
        const [mrBlob, vocalBlob] = await Promise.all([
          getBlob(song.instrumentalBlobKey),
          getBlob(song.vocalBlobKey),
        ]);

        if (cancelled) return;

        if (mrBlob) {
          const arrayBuffer = await mrBlob.arrayBuffer();
          if (cancelled) return;
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (cancelled) return;
          mrBufferRef.current = audioBuffer;
          setLocalDuration(audioBuffer.duration);
          setDuration(audioBuffer.duration);
        }

        if (vocalBlob && song.vocalBlobKey !== song.instrumentalBlobKey) {
          const arrayBuffer = await vocalBlob.arrayBuffer();
          if (cancelled) return;
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (cancelled) return;
          vocalBufferRef.current = audioBuffer;
        } else if (vocalBlob && song.vocalBlobKey === song.instrumentalBlobKey) {
          // Same file for both - use the same buffer for vocal
          vocalBufferRef.current = mrBufferRef.current;
        }

        loadedSongIdRef.current = song.id;
      } catch {
        // decode failure - try loading duration from song metadata
        if (song.durationSec > 0) {
          setLocalDuration(song.durationSec);
          setDuration(song.durationSec);
        }
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [song, setDuration]);

  // Sync volumes
  useEffect(() => {
    if (mrGainRef.current) {
      mrGainRef.current.gain.value = mrVolume;
    }
  }, [mrVolume]);

  useEffect(() => {
    if (vocalGainRef.current) {
      vocalGainRef.current.gain.value = vocalGuideVolume;
    }
  }, [vocalGuideVolume]);

  // Sync keyShift to pitch shifter nodes
  useEffect(() => {
    if (!pitchShifterReady.current) return;

    // Send shift to both MR and vocal shifter worklets
    setPitchShift(keyShift);
    if (vocalShifterRef.current) {
      vocalShifterRef.current.port.postMessage({
        type: 'setPitchShift',
        semitones: keyShift,
      });
    }

    // If currently playing, reconnect sources through shifter (or bypass)
    if (isPlayingRef.current && mrSourceRef.current) {
      const ctx = getAudioContext();
      const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
      const pos = playOffsetRef.current + elapsed;
      playOffsetRef.current = pos;
      playStartTimeRef.current = ctx.currentTime;
      stopSources();
      createAndStartSources(pos, playbackRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyShift]);

  // Sync playback rate to active sources
  useEffect(() => {
    if (mrSourceRef.current) {
      mrSourceRef.current.playbackRate.value = playbackRate;
    }
    if (vocalSourceRef.current) {
      vocalSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  // Play/pause
  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (!song || !mrBufferRef.current) return;

    if (isPlaying) {
      resumeAudioContext().then(() => {
        createAndStartSources(currentTime, playbackRate);
      });
    } else {
      // When pausing, calculate current position
      if (mrSourceRef.current) {
        const ctx = getAudioContext();
        const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
        const pos = playOffsetRef.current + elapsed;
        playOffsetRef.current = pos;
        stopSources();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, song]);

  // Time update loop
  useEffect(() => {
    function tick() {
      if (!isPlayingRef.current || isSeeking) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = getAudioContext();
      const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
      const pos = playOffsetRef.current + elapsed;

      // Loop check
      const store = usePracticeStore.getState();
      if (store.loopStart !== null && store.loopEnd !== null && pos >= store.loopEnd) {
        const loopOffset = store.loopStart;
        playOffsetRef.current = loopOffset;
        playStartTimeRef.current = ctx.currentTime;
        stopSources();
        createAndStartSources(loopOffset, playbackRate);
        setCurrentTime(loopOffset);
      } else if (pos >= duration && duration > 0) {
        // Song ended, handled by source.onended
        setCurrentTime(duration);
      } else {
        setCurrentTime(pos);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSeeking, playbackRate, duration, stopSources, createAndStartSources, setCurrentTime]);

  // Listen for external seek events (from LyricsPanel, SectionTabs)
  useEffect(() => {
    const handleExternalSeek = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.time !== 'number' || !duration) return;

      const newTime = Math.max(0, Math.min(duration, detail.time));
      playOffsetRef.current = newTime;
      setCurrentTime(newTime);

      if (isPlayingRef.current) {
        const ctx = getAudioContext();
        playStartTimeRef.current = ctx.currentTime;
        stopSources();
        createAndStartSources(newTime, playbackRate);
      }
    };

    window.addEventListener('vocalmind-seek', handleExternalSeek);
    return () => window.removeEventListener('vocalmind-seek', handleExternalSeek);
  }, [duration, setCurrentTime, playbackRate, stopSources, createAndStartSources]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSources();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stopSources]);

  // Seek
  const handleSeek = useCallback((clientX: number) => {
    const bar = seekbarRef.current;
    if (!bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * duration;

    playOffsetRef.current = newTime;
    setCurrentTime(newTime);

    if (isPlayingRef.current) {
      const ctx = getAudioContext();
      playStartTimeRef.current = ctx.currentTime;
      stopSources();
      createAndStartSources(newTime, playbackRate);
    }
  }, [duration, setCurrentTime, playbackRate, stopSources, createAndStartSources]);

  const handleSeekDown = useCallback((e: React.MouseEvent) => {
    setIsSeeking(true);
    handleSeek(e.clientX);

    const onMove = (ev: MouseEvent) => handleSeek(ev.clientX);
    const onUp = () => {
      setIsSeeking(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleSeek]);

  // Transport actions
  const togglePlay = useCallback(() => {
    if (!song) return;
    setPlaying(!isPlaying);
  }, [song, isPlaying, setPlaying]);

  const restart = useCallback(() => {
    playOffsetRef.current = 0;
    setCurrentTime(0);

    if (isPlayingRef.current) {
      const ctx = getAudioContext();
      playStartTimeRef.current = ctx.currentTime;
      stopSources();
      createAndStartSources(0, playbackRate);
    }
  }, [setCurrentTime, playbackRate, stopSources, createAndStartSources]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Determine separation status for display
  const separationStatus = song?.separationStatus ?? 'done';

  if (!song) {
    return (
      <div className={styles.player}>
        <div className={styles.noSong}>
          <div className={styles.noSongIcon}>&#9654;</div>
          <p className={styles.noSongText}>곡을 업로드하거나 선택해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.player}>
      {/* Song info */}
      <div className={styles.songHeader}>
        <div className={styles.songInfo}>
          <div className={styles.songTitle}>{song.title}</div>
          <div className={styles.songArtist}>{song.artist}</div>
        </div>
        {separationStatus === 'pending' && (
          <div className={styles.separatingBadge}>보컬 분리 중...</div>
        )}
      </div>

      {/* Seekbar */}
      <div className={styles.seekbarContainer}>
        <div
          ref={seekbarRef}
          className={styles.seekbar}
          onMouseDown={handleSeekDown}
        >
          {/* Loop region highlight */}
          {loopStart !== null && loopEnd !== null && duration > 0 && (
            <div
              className={styles.loopRegion}
              style={{
                left: `${(loopStart / duration) * 100}%`,
                width: `${((loopEnd - loopStart) / duration) * 100}%`,
              }}
            />
          )}
          <div className={styles.seekbarFill} style={{ width: `${progress}%` }} />
          <div className={styles.seekbarHandle} style={{ left: `${progress}%` }} />
        </div>
      </div>

      {/* Time */}
      <div className={styles.timeDisplay}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Transport */}
      <div className={styles.transport}>
        <button className={styles.transportBtn} onClick={restart} aria-label="처음으로">
          &#9198;
        </button>
        <button className={`${styles.transportBtn} ${styles.playBtn}`} onClick={togglePlay} aria-label={isPlaying ? '일시정지' : '재생'}>
          {isPlaying ? '\u275A\u275A' : '\u25B6'}
        </button>
      </div>

      {/* Speed */}
      <div className={styles.speedSection}>
        <div className={styles.sectionLabel}>재생 속도</div>
        <div className={styles.speedBtns}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`${styles.speedBtn} ${playbackRate === s ? styles.speedBtnActive : ''}`}
              onClick={() => setPlaybackRate(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Key Shift */}
      <div className={styles.keySection}>
        <div className={styles.sectionLabel}>키 조절</div>
        <div className={styles.keyControls}>
          <button
            className={styles.keyBtn}
            onClick={() => setKeyShift(keyShift - 1)}
            disabled={keyShift <= -6}
          >
            -
          </button>
          <span className={styles.keyValue}>
            {keyShift === 0 ? '원키' : keyShift > 0 ? `+${keyShift}` : `${keyShift}`}
          </span>
          <button
            className={styles.keyBtn}
            onClick={() => setKeyShift(keyShift + 1)}
            disabled={keyShift >= 6}
          >
            +
          </button>
        </div>
        {keyShift !== 0 && (
          <div className={styles.keyHint}>
            {keyShift > 0 ? `+${keyShift}` : keyShift} 반음 적용됨
          </div>
        )}
      </div>

      {/* Volume */}
      <div className={styles.volumeSection}>
        <div className={styles.volumeRow}>
          <span className={styles.volumeLabel}>MR 볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mrVolume}
            onChange={(e) => setMrVolume(parseFloat(e.target.value))}
            className={styles.volumeSlider}
          />
          <span className={styles.volumeValue}>{Math.round(mrVolume * 100)}%</span>
        </div>
        <div className={styles.volumeRow}>
          <span className={styles.volumeLabel}>보컬 가이드</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vocalGuideVolume}
            onChange={(e) => setVocalGuideVolume(parseFloat(e.target.value))}
            className={styles.volumeSlider}
          />
          <span className={styles.volumeValue}>{Math.round(vocalGuideVolume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
