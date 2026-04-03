'use client';

import { useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { SongSection } from '@/types';
import styles from './SectionTabs.module.css';

// Section type -> color mapping
const SECTION_COLORS: Record<SongSection['type'], string> = {
  intro:   'rgba(139, 92, 246, 0.5)',   // purple
  verse:   'rgba(59, 130, 246, 0.5)',    // blue
  chorus:  'rgba(234, 179, 8, 0.5)',     // yellow
  bridge:  'rgba(34, 197, 94, 0.5)',     // green
  outro:   'rgba(139, 92, 246, 0.3)',    // lighter purple
  other:   'rgba(113, 113, 122, 0.4)',   // gray
};

const SECTION_DOT_COLORS: Record<SongSection['type'], string> = {
  intro:   '#8B5CF6',
  verse:   '#3B82F6',
  chorus:  '#EAB308',
  bridge:  '#22C55E',
  outro:   '#A78BFA',
  other:   '#71717A',
};

interface Props {
  onSeek: (time: number) => void;
}

export default function SectionTabs({ onSeek }: Props) {
  const {
    currentAnalysis,
    currentTime,
    duration,
    setLoop,
  } = usePracticeStore();

  const sections: SongSection[] = currentAnalysis?.sections ?? [];

  // Determine which section is currently active
  const activeSectionIndex = useMemo(() => {
    if (sections.length === 0) return -1;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (currentTime >= sections[i].startTime && currentTime < sections[i].endTime) {
        return i;
      }
    }
    return -1;
  }, [sections, currentTime]);

  // Single click: seek to section start
  const handleTabClick = useCallback((section: SongSection) => {
    onSeek(section.startTime);
  }, [onSeek]);

  // Double click: set loop to section
  const handleTabDoubleClick = useCallback((section: SongSection) => {
    setLoop(section.startTime, section.endTime);
  }, [setLoop]);

  // Click on color bar segment
  const handleSegmentClick = useCallback((section: SongSection) => {
    onSeek(section.startTime);
  }, [onSeek]);

  if (sections.length === 0) {
    return (
      <div className={styles.sectionTabs}>
        <div className={styles.emptyState}>
          {currentAnalysis ? '구간 정보 없음' : '곡 분석 후 구간이 표시됩니다'}
        </div>
      </div>
    );
  }

  const totalDuration = duration > 0 ? duration : sections[sections.length - 1]?.endTime ?? 1;

  return (
    <div className={styles.sectionTabs}>
      {/* Color bar on seekbar */}
      <div className={styles.colorBar}>
        {sections.map((section, i) => {
          const left = (section.startTime / totalDuration) * 100;
          const width = ((section.endTime - section.startTime) / totalDuration) * 100;
          return (
            <div
              key={i}
              className={`${styles.colorSegment} ${i === activeSectionIndex ? styles.colorSegmentActive : ''}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: SECTION_COLORS[section.type],
              }}
              onClick={() => handleSegmentClick(section)}
              title={`${section.label} (${formatTime(section.startTime)} ~ ${formatTime(section.endTime)})`}
            />
          );
        })}
      </div>

      {/* Tab list */}
      <div className={styles.tabList}>
        {sections.map((section, i) => (
          <button
            key={i}
            className={`${styles.tab} ${i === activeSectionIndex ? styles.tabActive : ''}`}
            onClick={() => handleTabClick(section)}
            onDoubleClick={() => handleTabDoubleClick(section)}
            title={`클릭: 이동 | 더블클릭: 구간 반복\n${formatTime(section.startTime)} ~ ${formatTime(section.endTime)}`}
          >
            <span
              className={styles.tabDot}
              style={{ background: SECTION_DOT_COLORS[section.type] }}
            />
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
