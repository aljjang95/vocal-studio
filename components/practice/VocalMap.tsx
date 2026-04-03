'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { VocalTechnique } from '@/types';
import styles from './VocalMap.module.css';

// ── Technique definitions ──

type TechniqueKey = VocalTechnique['type'];

interface TechniqueInfo {
  key: TechniqueKey;
  color: string;
  label: string;
  description: string;
}

const TECHNIQUES: TechniqueInfo[] = [
  { key: 'vibrato',  color: '#9B59B6', label: '바이브레이션', description: '바이브레이션 - 음을 규칙적으로 떨어뜨리는 기법' },
  { key: 'bending',  color: '#3498DB', label: '벤딩',        description: '벤딩 - 음을 부드럽게 구부리는 기법' },
  { key: 'belting',  color: '#E74C3C', label: '벨팅',        description: '벨팅 - 흉성으로 강하게 고음을 내는 기법' },
  { key: 'falsetto', color: '#E91E63', label: '팔세토',      description: '팔세토 - 가성으로 높은 음을 내는 기법' },
  { key: 'whisper',  color: '#95A5A6', label: '브레시(위스퍼)', description: '브레시 - 숨 섞인 부드러운 톤' },
  { key: 'breathy',  color: '#95A5A6', label: '브레시',      description: '브레시 - 숨 섞인 부드러운 톤' },
  { key: 'run',      color: '#F39C12', label: '런/리프',     description: '런/리프 - 빠르게 음을 오르내리는 기법' },
  { key: 'crack',    color: '#F1C40F', label: '꺾기',        description: '꺾기 - 음을 의도적으로 꺾는 한국식 창법' },
  { key: 'mix',      color: '#2ECC71', label: '믹스보이스',   description: '믹스보이스 - 흉성과 두성을 섞은 발성' },
];

// Map for quick lookup
const TECHNIQUE_MAP = new Map(TECHNIQUES.map((t) => [t.key, t]));

// Unique display rows (whisper and breathy share a row)
const DISPLAY_ROWS: TechniqueKey[] = [
  'vibrato', 'bending', 'belting', 'falsetto', 'whisper', 'run', 'crack', 'mix',
];

function getRowIndex(type: TechniqueKey): number {
  if (type === 'breathy') return DISPLAY_ROWS.indexOf('whisper');
  return DISPLAY_ROWS.indexOf(type);
}

function getTechniqueInfo(type: TechniqueKey): TechniqueInfo {
  return TECHNIQUE_MAP.get(type) ?? TECHNIQUES[0];
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ──

interface Props {
  onSeek: (time: number) => void;
}

export default function VocalMap({ onSeek }: Props) {
  const {
    currentAnalysis,
    duration,
    currentTime,
    setMode,
    setLoop,
    setActivePanel,
  } = usePracticeStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // UI state
  const [showFilter, setShowFilter] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<TechniqueKey>>(
    () => new Set(DISPLAY_ROWS.concat('breathy')),
  );
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; technique: VocalTechnique;
  } | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<VocalTechnique | null>(null);

  const vocalMap = currentAnalysis?.vocalMap ?? [];
  const totalDuration = duration > 0 ? duration : (vocalMap.length > 0
    ? Math.max(...vocalMap.map((v) => v.endTime)) + 1
    : 1);

  // Filtered techniques
  const filteredMap = useMemo(
    () => vocalMap.filter((v) => enabledTypes.has(v.type)),
    [vocalMap, enabledTypes],
  );

  // Summary stats
  const techniqueStats = useMemo(() => {
    const counts = new Map<TechniqueKey, number>();
    for (const v of vocalMap) {
      counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
    return entries;
  }, [vocalMap]);

  const maxCount = useMemo(
    () => (techniqueStats.length > 0 ? techniqueStats[0][1] : 0),
    [techniqueStats],
  );

  const topTechnique = useMemo(
    () => (techniqueStats.length > 0 ? getTechniqueInfo(techniqueStats[0][0]) : null),
    [techniqueStats],
  );

  const uniqueTypeCount = techniqueStats.length;

  const difficulty = useMemo(() => {
    if (uniqueTypeCount >= 7) return { label: '고급', cls: styles.diffAdvanced };
    if (uniqueTypeCount >= 4) return { label: '중급', cls: styles.diffIntermediate };
    return { label: '기본', cls: styles.diffBasic };
  }, [uniqueTypeCount]);

  // ── Filter toggle ──

  const toggleType = useCallback((type: TechniqueKey) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        // Also toggle paired breathy/whisper
        if (type === 'whisper') next.delete('breathy');
        if (type === 'breathy') next.delete('whisper');
      } else {
        next.add(type);
        if (type === 'whisper') next.add('breathy');
        if (type === 'breathy') next.add('whisper');
      }
      return next;
    });
  }, []);

  // ── Canvas hit-test helper ──

  const hitTest = useCallback((clientX: number, clientY: number): VocalTechnique | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const rowCount = DISPLAY_ROWS.length;
    const labelWidth = 70;
    const chartLeft = labelWidth;
    const chartWidth = w - labelWidth - 10;
    const rowHeight = h / rowCount;
    const barPadY = 4;

    for (const v of filteredMap) {
      const row = getRowIndex(v.type);
      if (row < 0) continue;
      const info = getTechniqueInfo(v.type);
      if (!info) continue;

      const bx = chartLeft + (v.startTime / totalDuration) * chartWidth;
      const bw = Math.max(4, ((v.endTime - v.startTime) / totalDuration) * chartWidth);
      const by = row * rowHeight + barPadY;
      const bh = rowHeight - barPadY * 2;

      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        return v;
      }
    }
    return null;
  }, [filteredMap, totalDuration]);

  // ── Mouse events ──

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        technique: hit,
      });
    } else {
      setTooltip(null);
    }
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      setSelectedTechnique(hit);
      setTooltip(null);
    }
  }, [hitTest]);

  // ── Popup actions ──

  const handleListen = useCallback(() => {
    if (!selectedTechnique) return;
    onSeek(selectedTechnique.startTime);
    setSelectedTechnique(null);
  }, [selectedTechnique, onSeek]);

  const handlePractice = useCallback(() => {
    if (!selectedTechnique) return;
    setMode('practice');
    setLoop(selectedTechnique.startTime, selectedTechnique.endTime);
    setActivePanel('pitch');
    setSelectedTechnique(null);
  }, [selectedTechnique, setMode, setLoop, setActivePanel]);

  // ── Canvas rendering ──

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rowCount = DISPLAY_ROWS.length;
      const labelWidth = 70;
      const chartLeft = labelWidth;
      const chartWidth = w - labelWidth - 10;
      const rowHeight = h / rowCount;
      const barPadY = 4;

      // ── Draw row backgrounds and labels ──
      for (let i = 0; i < rowCount; i++) {
        const y = i * rowHeight;
        const rowType = DISPLAY_ROWS[i];
        const info = getTechniqueInfo(rowType);

        // Alternating row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.015)';
          ctx.fillRect(0, y, w, rowHeight);
        }

        // Row divider
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(labelWidth, y + rowHeight);
        ctx.lineTo(w, y + rowHeight);
        ctx.stroke();

        // Label
        ctx.fillStyle = enabledTypes.has(rowType) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillText(info.label, labelWidth - 8, y + rowHeight / 2);
      }

      // ── Draw time markers ──
      const timeStep = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : totalDuration > 30 ? 10 : 5;
      for (let t = 0; t <= totalDuration; t += timeStep) {
        const x = chartLeft + (t / totalDuration) * chartWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(t), x, h - 2);
      }

      // ── Draw technique bars ──
      for (const v of filteredMap) {
        const row = getRowIndex(v.type);
        if (row < 0) continue;
        const info = getTechniqueInfo(v.type);

        const bx = chartLeft + (v.startTime / totalDuration) * chartWidth;
        const bw = Math.max(4, ((v.endTime - v.startTime) / totalDuration) * chartWidth);
        const by = row * rowHeight + barPadY;
        const bh = rowHeight - barPadY * 2;

        // Bar fill with intensity-based alpha
        const alpha = 0.4 + v.intensity * 0.5;
        ctx.fillStyle = info.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();

        // Border
        ctx.strokeStyle = info.color + '88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.stroke();
      }

      // ── Draw current time indicator ──
      if (currentTime > 0 && currentTime <= totalDuration) {
        const cx = chartLeft + (currentTime / totalDuration) * chartWidth;
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [filteredMap, totalDuration, currentTime, enabledTypes]);

  // Cleanup
  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Empty state ──
  if (!currentAnalysis || vocalMap.length === 0) {
    return (
      <div className={styles.vocalMap}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#9835;</div>
          <div className={styles.emptyText}>
            보컬맵 분석이 필요합니다. 곡을 분석해주세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.vocalMap}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>보컬맵 - 테크닉 시각화</span>
        <div className={styles.headerRight}>
          <button
            className={`${styles.filterToggle} ${showFilter ? styles.filterToggleActive : ''}`}
            onClick={() => setShowFilter((v) => !v)}
          >
            필터
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className={styles.filterPanel}>
          {DISPLAY_ROWS.map((type) => {
            const info = getTechniqueInfo(type);
            const checked = enabledTypes.has(type);
            return (
              <label
                key={type}
                className={`${styles.filterItem} ${!checked ? styles.filterItemUnchecked : ''}`}
              >
                <input
                  type="checkbox"
                  className={styles.filterCheckbox}
                  checked={checked}
                  onChange={() => toggleType(type)}
                  style={checked ? { background: info.color, borderColor: info.color } : undefined}
                />
                <span className={styles.filterDot} style={{ background: info.color }} />
                <span className={styles.filterLabel}>{info.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={styles.canvasWrap}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        {tooltip && (
          <div
            className={styles.tooltip}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <span className={styles.tooltipType}>
              {getTechniqueInfo(tooltip.technique.type).label}
            </span>
            <span className={styles.tooltipTime}>
              {formatTime(tooltip.technique.startTime)} ~ {formatTime(tooltip.technique.endTime)}
            </span>
          </div>
        )}
      </div>

      {/* Summary panel */}
      <div className={styles.summary}>
        {/* Bar chart */}
        <div className={styles.summaryChart}>
          <div className={styles.summaryTitle}>테크닉 사용 횟수</div>
          <div className={styles.barList}>
            {techniqueStats.map(([type, count]) => {
              const info = getTechniqueInfo(type);
              const isTop = count === maxCount;
              return (
                <div
                  key={type}
                  className={`${styles.barRow} ${isTop ? styles.barHighlight : ''}`}
                >
                  <span className={styles.barLabel}>{info.label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        background: info.color,
                      }}
                    />
                  </div>
                  <span className={styles.barCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty & summary */}
        <div className={styles.summaryInfo}>
          <span className={styles.difficultyLabel}>곡 난이도</span>
          <span className={`${styles.difficultyBadge} ${difficulty.cls}`}>
            {difficulty.label}
          </span>
          <span className={styles.techniqueCount}>
            테크닉 {uniqueTypeCount}종 / {vocalMap.length}회
          </span>
          {topTechnique && (
            <div className={styles.topTechnique}>
              가장 많이 사용: <span className={styles.topTechniqueName}>{topTechnique.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail popup */}
      {selectedTechnique && (
        <div className={styles.popupOverlay} onClick={() => setSelectedTechnique(null)}>
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <span
                className={styles.popupDot}
                style={{ background: getTechniqueInfo(selectedTechnique.type).color }}
              />
              <span className={styles.popupTitle}>
                {getTechniqueInfo(selectedTechnique.type).label}
              </span>
            </div>
            <p className={styles.popupDesc}>
              {getTechniqueInfo(selectedTechnique.type).description}
            </p>
            <p className={styles.popupTime}>
              {formatTime(selectedTechnique.startTime)} ~ {formatTime(selectedTechnique.endTime)}
              {' '}({(selectedTechnique.endTime - selectedTechnique.startTime).toFixed(1)}s)
            </p>
            <div className={styles.popupActions}>
              <button className={`${styles.popupBtn} ${styles.popupBtnListen}`} onClick={handleListen}>
                이 구간 듣기
              </button>
              <button className={`${styles.popupBtn} ${styles.popupBtnPractice}`} onClick={handlePractice}>
                이 구간 연습하기
              </button>
            </div>
            <button className={styles.popupClose} onClick={() => setSelectedTechnique(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
