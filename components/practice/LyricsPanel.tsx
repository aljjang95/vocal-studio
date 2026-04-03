'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { saveAnalysis } from '@/lib/storage/songDB';
import type { LyricLine, SongAnalysis } from '@/types';
import PronunciationView from './PronunciationView';
import styles from './LyricsPanel.module.css';

interface Props {
  onSeek: (time: number) => void;
}

export default function LyricsPanel({ onSeek }: Props) {
  const {
    currentSongId,
    currentTime,
    isPlaying,
    currentAnalysis,
    setCurrentAnalysis,
    songs,
  } = usePracticeStore();

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? null,
    [songs, currentSongId],
  );

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [syncMode, setSyncMode] = useState(false);
  const [syncLineIndex, setSyncLineIndex] = useState(0);
  const [suggestedLyrics, setSuggestedLyrics] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const lyrics: LyricLine[] = currentAnalysis?.lyrics ?? [];

  // Find active lyric line based on currentTime
  const activeLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let lastSynced = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].startTime !== null && lyrics[i].startTime! <= currentTime) {
        lastSynced = i;
      }
    }
    return lastSynced;
  }, [lyrics, currentTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineIndex >= 0 && lineRefs.current[activeLineIndex] && scrollRef.current) {
      const line = lineRefs.current[activeLineIndex];
      if (line) {
        const container = scrollRef.current;
        const lineTop = line.offsetTop - container.offsetTop;
        const scrollTarget = lineTop - container.clientHeight / 3;
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }
  }, [activeLineIndex]);

  // Handle line click -> seek
  const handleLineClick = useCallback((index: number) => {
    const line = lyrics[index];
    if (line && line.startTime !== null) {
      onSeek(line.startTime);
    }
  }, [lyrics, onSeek]);

  // Enter edit mode
  const handleEditStart = useCallback(() => {
    const text = lyrics.map((l) => l.text).join('\n');
    setEditText(text);
    setEditMode(true);
    setError(null);
  }, [lyrics]);

  // Save edited lyrics
  const handleEditSave = useCallback(async () => {
    if (!currentSongId || !currentAnalysis) return;

    const lines = editText.split('\n');
    const newLyrics: LyricLine[] = lines.map((text, i) => ({
      text,
      startTime: lyrics[i]?.startTime ?? null,
      pronunciation: lyrics[i]?.pronunciation,
    }));

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: newLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
      setEditMode(false);
      setError(null);
    } catch {
      setError('가사 저장에 실패했습니다.');
    }
  }, [currentSongId, currentAnalysis, editText, lyrics, setCurrentAnalysis]);

  // Cancel edit
  const handleEditCancel = useCallback(() => {
    setEditMode(false);
    setEditText('');
    setError(null);
  }, []);

  // AI lyrics suggestion
  const handleAISuggest = useCallback(async () => {
    if (!currentSong) return;
    setLoadingSuggestion(true);
    setError(null);
    setSuggestedLyrics(null);

    try {
      const res = await fetch('/api/lyrics-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentSong.title,
          artist: currentSong.artist,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `요청 실패 (${res.status})`);
      }

      const data = await res.json();
      setSuggestedLyrics(data.suggestedLyrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 가사 제안에 실패했습니다.');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [currentSong]);

  // Apply suggested lyrics
  const handleApplySuggestion = useCallback(async () => {
    if (!suggestedLyrics || !currentSongId) return;

    const lines = suggestedLyrics.split('\n');
    const newLyrics: LyricLine[] = lines.map((text) => ({
      text,
      startTime: null,
    }));

    const updatedAnalysis: SongAnalysis = currentAnalysis
      ? { ...currentAnalysis, lyrics: newLyrics }
      : {
          songId: currentSongId,
          melodyData: [],
          sections: [],
          vocalMap: [],
          songRange: { low: '', high: '' },
          lyrics: newLyrics,
          analyzedAt: new Date().toISOString(),
        };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
      setSuggestedLyrics(null);
      setError(null);
    } catch {
      setError('가사 적용에 실패했습니다.');
    }
  }, [suggestedLyrics, currentSongId, currentAnalysis, setCurrentAnalysis]);

  // Sync mode: assign currentTime to current line
  const handleSyncTap = useCallback(async () => {
    if (!currentAnalysis || !currentSongId || syncLineIndex >= lyrics.length) return;

    const updatedLyrics = [...lyrics];
    updatedLyrics[syncLineIndex] = {
      ...updatedLyrics[syncLineIndex],
      startTime: currentTime,
    };

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: updatedLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);

      if (syncLineIndex < lyrics.length - 1) {
        setSyncLineIndex(syncLineIndex + 1);
      } else {
        setSyncMode(false);
        setSyncLineIndex(0);
      }
    } catch {
      setError('싱크 저장에 실패했습니다.');
    }
  }, [currentAnalysis, currentSongId, syncLineIndex, lyrics, currentTime, setCurrentAnalysis]);

  const handleSyncStart = useCallback(() => {
    setSyncMode(true);
    setSyncLineIndex(0);
    setError(null);
  }, []);

  const handleSyncStop = useCallback(() => {
    setSyncMode(false);
    setSyncLineIndex(0);
  }, []);

  // Handle pronunciation update from PronunciationView
  const handlePronunciationUpdate = useCallback(async (updatedLyrics: LyricLine[]) => {
    if (!currentSongId || !currentAnalysis) return;

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: updatedLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
    } catch {
      setError('발음 저장에 실패했습니다.');
    }
  }, [currentSongId, currentAnalysis, setCurrentAnalysis]);

  // No song selected
  if (!currentSongId) {
    return (
      <div className={styles.lyricsPanel}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#9835;</div>
          <p className={styles.emptyText}>곡을 선택해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.lyricsPanel}>
      <div className={styles.header}>
        <span className={styles.title}>가사</span>
        <div className={styles.headerActions}>
          {lyrics.length > 0 && !editMode && !syncMode && (
            <>
              <button className={styles.actionBtn} onClick={handleEditStart}>
                가사 편집
              </button>
              {isPlaying && (
                <button className={styles.actionBtn} onClick={handleSyncStart}>
                  싱크
                </button>
              )}
            </>
          )}
          <button
            className={`${styles.actionBtn} ${loadingSuggestion ? styles.actionBtnLoading : ''}`}
            onClick={handleAISuggest}
            disabled={loadingSuggestion}
          >
            {loadingSuggestion ? '생성 중...' : 'AI 가사 제안'}
          </button>
          <PronunciationView
            lyrics={lyrics}
            currentSong={currentSong}
            onUpdate={handlePronunciationUpdate}
          />
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* Sync mode bar */}
      {syncMode && lyrics.length > 0 && (
        <div className={styles.syncBar}>
          <span className={styles.syncDot} />
          <span className={styles.syncText}>
            싱크 모드 - 줄 {syncLineIndex + 1}/{lyrics.length}: &quot;{lyrics[syncLineIndex]?.text.slice(0, 30)}&quot;
          </span>
          <button className={styles.syncBtn} onClick={handleSyncTap}>
            싱크
          </button>
          <button className={styles.syncStopBtn} onClick={handleSyncStop}>
            종료
          </button>
        </div>
      )}

      {/* AI Suggestion */}
      {suggestedLyrics && (
        <div className={styles.suggestion}>
          <div className={styles.suggestionHeader}>
            <span className={styles.suggestionTitle}>AI 가사 제안</span>
          </div>
          <div className={styles.suggestionText}>{suggestedLyrics}</div>
          <div className={styles.suggestionActions}>
            <button className={styles.cancelBtn} onClick={() => setSuggestedLyrics(null)}>
              취소
            </button>
            <button className={styles.saveBtn} onClick={handleApplySuggestion}>
              적용
            </button>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editMode ? (
        <>
          <textarea
            className={styles.editArea}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="가사를 입력하세요 (줄바꿈으로 구분)"
          />
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={handleEditCancel}>
              취소
            </button>
            <button className={styles.saveBtn} onClick={handleEditSave}>
              저장
            </button>
          </div>
        </>
      ) : lyrics.length > 0 ? (
        /* Lyrics display */
        <div ref={scrollRef} className={styles.lyricsScroll}>
          {lyrics.map((line, i) => (
            <div
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              className={`${styles.lyricLine} ${
                syncMode && i === syncLineIndex
                  ? styles.lyricLineActive
                  : !syncMode && i === activeLineIndex
                    ? styles.lyricLineActive
                    : ''
              }`}
              onClick={() => handleLineClick(i)}
            >
              <span className={styles.lyricText}>{line.text || '\u00A0'}</span>
              {line.startTime !== null && (
                <span className={styles.lyricTimeTag}>
                  {Math.floor(line.startTime / 60)}:{Math.floor(line.startTime % 60).toString().padStart(2, '0')}
                </span>
              )}
              {line.pronunciation && (
                <div className={styles.lyricPronunciation}>{line.pronunciation}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#128196;</div>
          <p className={styles.emptyText}>
            가사를 입력하세요.
            <br />
            &quot;AI 가사 제안&quot; 버튼으로 자동 생성할 수도 있습니다.
          </p>
          <button className={styles.actionBtn} onClick={handleEditStart}>
            가사 입력
          </button>
        </div>
      )}
    </div>
  );
}
