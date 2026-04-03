'use client';

import { useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { deleteBlob } from '@/lib/storage/songDB';
import type { Song } from '@/types';
import styles from './SongList.module.css';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
}

function getSeparationLabel(status: Song['separationStatus']): { text: string; className: string } {
  switch (status) {
    case 'pending':
      return { text: '분리 중', className: styles.badgePending };
    case 'failed':
      return { text: '분리 실패', className: styles.badgeFailed };
    case 'done':
      return { text: '분리 완료', className: styles.badgeDone };
    default:
      // backward compatibility: no status = done
      return { text: '분리 완료', className: styles.badgeDone };
  }
}

function getAnalysisLabel(status: Song['analysisStatus']): { text: string; className: string } | null {
  switch (status) {
    case 'analyzing':
      return { text: '분석 중', className: styles.badgePending };
    case 'done':
      return { text: '분석 완료', className: styles.badgeDone };
    default:
      return null;
  }
}

export default function SongList() {
  const { songs, currentSongId, setCurrentSong, removeSong } = usePracticeStore();
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteBlob(deleteTarget.vocalBlobKey);
      if (deleteTarget.instrumentalBlobKey !== deleteTarget.vocalBlobKey) {
        await deleteBlob(deleteTarget.instrumentalBlobKey);
      }
      if (deleteTarget.originalBlobKey) {
        await deleteBlob(deleteTarget.originalBlobKey);
      }
      removeSong(deleteTarget.id);
    } catch {
      // IndexedDB cleanup failure is non-critical
    }
    setDeleteTarget(null);
  }, [deleteTarget, removeSong]);

  const handleSongClick = useCallback((song: Song) => {
    setCurrentSong(song.id);
  }, [setCurrentSong]);

  return (
    <div className={styles.songList}>
      <div className={styles.header}>
        <h2 className={styles.title}>내 곡 목록</h2>
        <span className={styles.count}>{songs.length}곡</span>
      </div>

      <div className={styles.listBody}>
        {songs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>&#9835;</div>
            <p className={styles.emptyText}>
              아직 추가된 곡이 없습니다.<br />
              우측 상단에서 곡을 업로드해주세요.
            </p>
          </div>
        ) : (
          songs.map((song) => {
            const sepBadge = getSeparationLabel(song.separationStatus);
            const anaBadge = getAnalysisLabel(song.analysisStatus);

            return (
              <div
                key={song.id}
                className={`${styles.songItem} ${currentSongId === song.id ? styles.songItemActive : ''}`}
                onClick={() => handleSongClick(song)}
              >
                <div className={styles.songInfo}>
                  <div className={styles.songTitle}>{song.title}</div>
                  <div className={styles.songMeta}>
                    <span className={styles.songArtist}>{song.artist}</span>
                    <span className={styles.songDuration}>{formatDuration(song.durationSec)}</span>
                    <span className={styles.songDuration}>{formatDate(song.addedAt)}</span>
                  </div>
                  <div className={styles.badges}>
                    <span className={`${styles.badge} ${sepBadge.className}`}>
                      {sepBadge.text}
                    </span>
                    {anaBadge && (
                      <span className={`${styles.badge} ${anaBadge.className}`}>
                        {anaBadge.text}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(song);
                  }}
                  aria-label={`${song.title} 삭제`}
                >
                  &#10005;
                </button>
              </div>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <div className={styles.confirmOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmText}>
              <strong>{deleteTarget.title}</strong> 곡을 삭제하시겠습니까?<br />
              삭제된 곡은 복구할 수 없습니다.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button className={styles.confirmDelete} onClick={handleDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
