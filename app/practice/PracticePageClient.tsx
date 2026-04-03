'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePracticeStore } from '@/stores/practiceStore';
import { getAnalysis } from '@/lib/storage/songDB';
import SongUploader from '@/components/practice/SongUploader';
import SongList from '@/components/practice/SongList';
import PracticePlayer from '@/components/practice/PracticePlayer';
import LoopControls from '@/components/practice/LoopControls';
import PitchDisplay from '@/components/practice/PitchDisplay';
import ModeSwitcher from '@/components/practice/ModeSwitcher';
import PlayMode from '@/components/practice/PlayMode';
import SessionResult from '@/components/practice/SessionResult';
import PitchTimeline from '@/components/practice/PitchTimeline';
import LyricsPanel from '@/components/practice/LyricsPanel';
import SectionTabs from '@/components/practice/SectionTabs';
import VocalMap from '@/components/practice/VocalMap';
import styles from './practice.module.css';

export default function PracticePageClient() {
  const {
    songs,
    currentSongId,
    mode,
    showResult,
    currentSession,
    currentAnalysis,
    activePanel,
    setActivePanel,
    setCurrentAnalysis,
    setCurrentTime,
    setPlaying,
  } = usePracticeStore();

  const [uploaderCollapsed, setUploaderCollapsed] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const prevSongIdRef = useRef<string | null>(null);

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? null,
    [songs, currentSongId],
  );

  // Load analysis cache when song changes
  useEffect(() => {
    if (!currentSongId || currentSongId === prevSongIdRef.current) return;
    prevSongIdRef.current = currentSongId;

    let cancelled = false;

    async function loadAnalysis() {
      if (!currentSongId) return;
      setAnalysisLoading(true);

      try {
        const cached = await getAnalysis(currentSongId);
        if (cancelled) return;

        if (cached) {
          setCurrentAnalysis(cached);
        } else {
          setCurrentAnalysis(null);
          // Auto-trigger analysis if song has melody data (future: auto-analyze)
          // For now, just clear
        }
      } catch {
        if (!cancelled) setCurrentAnalysis(null);
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }

    loadAnalysis();

    return () => { cancelled = true; };
  }, [currentSongId, setCurrentAnalysis]);

  // Seek handler for LyricsPanel and SectionTabs
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    // Also dispatch a custom event for PracticePlayer to pick up the seek
    window.dispatchEvent(new CustomEvent('vocalmind-seek', { detail: { time } }));
  }, [setCurrentTime]);

  // Set default active panel when song is selected
  useEffect(() => {
    if (currentSongId && activePanel === null) {
      setActivePanel('pitch');
    }
  }, [currentSongId, activePanel, setActivePanel]);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <Link href="/" className={styles.backLink}>
              &larr; 보컬마인드
            </Link>
            <nav className={styles.headerNav}>
              <Link href="/coaching" className={styles.headerLink}>코칭</Link>
              <Link href="/diagnosis" className={styles.headerLink}>진단</Link>
              <Link href="/warmup" className={styles.headerLink}>워밍업</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Mode switcher at the top */}
          <div className={styles.modeSwitcherWrap}>
            <ModeSwitcher />
          </div>

          <div className={styles.layout}>
            {/* Left sidebar: Song List */}
            <div className={styles.sidebar}>
              <div className={styles.sidebarList}>
                <SongList />
              </div>
            </div>

            {/* Right content */}
            <div className={styles.content}>
              {/* Uploader (collapsible) */}
              <SongUploader
                collapsed={uploaderCollapsed}
                onToggle={() => setUploaderCollapsed((prev) => !prev)}
              />

              {currentSong ? (
                <>
                  {mode === 'practice' ? (
                    <>
                      {/* Practice mode: Player + SectionTabs + Loop */}
                      <div className={styles.playerSection}>
                        <PracticePlayer song={currentSong} />
                        <SectionTabs onSeek={handleSeek} />
                        <LoopControls disabled={!currentSong} />
                      </div>

                      {/* Panel tabs */}
                      <div className={styles.panelTabs}>
                        <button
                          className={`${styles.panelTab} ${activePanel === 'pitch' ? styles.panelTabActive : ''}`}
                          onClick={() => setActivePanel('pitch')}
                        >
                          피치
                        </button>
                        <button
                          className={`${styles.panelTab} ${activePanel === 'lyrics' ? styles.panelTabActive : ''}`}
                          onClick={() => setActivePanel('lyrics')}
                        >
                          가사
                        </button>
                        <button
                          className={`${styles.panelTab} ${activePanel === 'vocalmap' ? styles.panelTabActive : ''}`}
                          onClick={() => setActivePanel('vocalmap')}
                        >
                          보컬맵
                        </button>
                      </div>

                      {/* Active panel content */}
                      {activePanel === 'pitch' && <PitchDisplay />}
                      {activePanel === 'lyrics' && <LyricsPanel onSeek={handleSeek} />}
                      {activePanel === 'vocalmap' && (
                        <VocalMap onSeek={handleSeek} />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Play mode */}
                      <PlayMode song={currentSong} />
                    </>
                  )}

                  {/* PitchTimeline: shown after play mode result */}
                  {showResult && currentSession && (
                    <PitchTimeline
                      session={currentSession}
                      analysis={currentAnalysis}
                    />
                  )}
                </>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>&#9835;</div>
                  <h2 className={styles.emptyTitle}>곡을 선택해주세요</h2>
                  <p className={styles.emptyDesc}>
                    좌측 목록에서 곡을 선택하거나, 위에서 새로운 곡을 업로드해주세요.
                    {mode === 'practice'
                      ? ' MR 재생, 보컬 가이드, 구간 반복, 실시간 음정 모니터링이 가능합니다.'
                      : ' Play 모드에서 전곡을 처음부터 끝까지 불러보세요.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Session result overlay */}
      {showResult && <SessionResult />}
    </>
  );
}
