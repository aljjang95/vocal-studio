'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';
import { useTonePlayer } from '@/lib/hooks/useTonePlayer';
import { useScaleWebSocket } from '@/lib/hooks/useScaleWebSocket';
import PianoKeyboard from './PianoKeyboard';
import type { HLBCurriculumStage, LessonPhase, ScalePracticeScore } from '@/types';

interface Props { stage: HLBCurriculumStage }

function coachMsg(phase: LessonPhase, stage: HLBCurriculumStage): string {
  if (phase === 'guide') return `${stage.name} — 아래 가이드를 읽고 준비되면 시작하세요.`;
  if (phase === 'ready') return `'${stage.pronunciation}' 소리를 피아노를 따라 연결하세요.`;
  if (phase === 'playing') return stage.somaticFeedback.observationQuestion;
  if (phase === 'grading') return '분석 중...';
  return '';
}

export default function AutoLessonFlow({ stage }: Props) {
  const router = useRouter();
  const s = useScalePracticeStore();
  const { lessonPhase, setLessonPhase, setLatestScore, setRetryCount, retryCount, unlockStage, latestScore } = s;
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);

  const { latestResult, report, startSession, stopSession, error: wsError } = useScaleWebSocket();
  const { start: startTone, stop: stopTone } = useTonePlayer({ onScaleSetComplete: () => {} });

  useEffect(() => {
    const msg = coachMsg(lessonPhase, stage);
    if (!msg) return;
    setTyping(true);
    setText('');
    let i = 0;
    const iv = setInterval(() => {
      if (i < msg.length) { setText(msg.slice(0, ++i)); }
      else { clearInterval(iv); setTyping(false); }
    }, 20);
    return () => clearInterval(iv);
  }, [lessonPhase, stage]);

  const doStart = useCallback(() => setLessonPhase('ready'), [setLessonPhase]);

  const doBegin = useCallback(async () => {
    setLessonPhase('playing');
    await startSession(stage.id, 'gentle');
    await startTone();
  }, [setLessonPhase, startSession, stage.id, startTone]);

  const doFinish = useCallback(async () => {
    setLessonPhase('grading');
    stopTone();
    stopSession();
    const t = report?.stats?.avg_tension ?? (latestResult?.tension?.overall ?? 30);
    const pa = 65, ts = 70;
    const lv = stage.id <= 9 ? 'beginner' : stage.id <= 17 ? 'intermediate' : 'advanced';
    let sc: number, ok: boolean, hint: string;
    if (lv === 'beginner') {
      sc = Math.round(100 - t); ok = t <= 45;
      hint = ok ? '편안한 소리가 나오고 있어요' : '긴장을 풀어보세요';
    } else if (lv === 'intermediate') {
      sc = Math.round((100 - t) * 0.6 + pa * 0.4); ok = t <= 40 && pa >= 60;
      hint = !ok ? (t > 40 ? '긴장을 더 풀어야 해요' : '음정을 높여보세요') : '좋아요';
    } else {
      sc = Math.round((100 - t) * 0.4 + pa * 0.5 + ts * 0.1); ok = t <= 35 && pa >= 75;
      hint = !ok ? (t > 35 ? '긴장이 감지됩니다' : '음정을 높여야 해요') : '훌륭합니다';
    }
    sc = Math.max(0, Math.min(100, sc));
    setLatestScore({ score: sc, passed: ok, level: lv as ScalePracticeScore['level'], feedbackHint: hint, tensionOverall: t, pitchAccuracy: pa, toneStability: ts });
    setLessonPhase('result');
    if (ok && stage.id + 1 <= 28) unlockStage(stage.id + 1);
  }, [setLessonPhase, stopTone, stopSession, report, latestResult, stage.id, setLatestScore, unlockStage]);

  useEffect(() => {
    if (lessonPhase === 'playing' && !s.isPlaying && s.isRecording) doFinish();
  }, [lessonPhase, s.isPlaying, s.isRecording, doFinish]);

  const doRetry = useCallback(() => {
    setRetryCount(retryCount + 1); setLatestScore(null); setLessonPhase('ready');
  }, [retryCount, setRetryCount, setLatestScore, setLessonPhase]);

  const doNext = useCallback(() => {
    setLatestScore(null); setRetryCount(0); setLessonPhase('guide');
    router.push(stage.id + 1 <= 28 ? `/scale-practice/${stage.id + 1}` : '/scale-practice');
  }, [stage.id, setLatestScore, setRetryCount, setLessonPhase, router]);

  const lvLabel = stage.id <= 9 ? '이완 중심' : stage.id <= 17 ? '이완+음정' : '종합';

  return (
    <div className="af">
      {/* 코치 */}
      <div className="af-coach">
        <div className="af-coach-dot" data-active={typing} />
        <p className="af-coach-text">
          {text}
          {typing && <span className="af-cursor" />}
        </p>
      </div>

      {/* guide */}
      {lessonPhase === 'guide' && (
        <div className="af-section">
          <div className="af-tags">
            <span>{stage.pronunciation}</span>
            <span>{stage.scaleType}</span>
            <span>BPM {stage.bpmRange[0]}</span>
            <span className="af-tag-level">{lvLabel}</span>
          </div>
          <ol className="af-steps">
            <li>턱을 편하게 열어주세요</li>
            <li>피아노를 따라 &apos;{stage.pronunciation}&apos; 소리를 연결하세요</li>
            <li>올라갈수록 배 아래쪽 압력을 느껴보세요</li>
          </ol>
          <p className="af-question">{stage.somaticFeedback.observationQuestion}</p>
          <button className="af-btn-primary" onClick={doStart}>시작</button>
        </div>
      )}

      {/* ready */}
      {lessonPhase === 'ready' && (
        <div className="af-section af-center">
          <button className="af-start-circle" onClick={doBegin}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 20,12 8,19"/></svg>
          </button>
          <p className="af-hint">탭하면 피아노 + 녹음 시작</p>
          {retryCount > 0 && <span className="af-retry">재시도 {retryCount}회</span>}
        </div>
      )}

      {/* playing */}
      {lessonPhase === 'playing' && (
        <div className="af-section">
          {latestResult?.feedback && (
            <p className={`af-live ${latestResult.tension?.overall && latestResult.tension.overall > 40 ? 'af-live-warn' : ''}`}>
              {latestResult.feedback}
            </p>
          )}
          <PianoKeyboard />
          <button className="af-btn-stop" onClick={doFinish}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="1.5"/></svg>
            종료
          </button>
        </div>
      )}

      {/* grading */}
      {lessonPhase === 'grading' && (
        <div className="af-section af-center" style={{ padding: '48px 0' }}>
          <div className="af-spinner" />
        </div>
      )}

      {/* result */}
      {lessonPhase === 'result' && latestScore && (
        <div className="af-section">
          <div className="af-score-row">
            <span className={`af-score ${latestScore.passed ? 'af-pass' : 'af-fail'}`}>
              {latestScore.score}
            </span>
            <span className={`af-verdict ${latestScore.passed ? 'af-pass' : 'af-fail'}`}>
              {latestScore.passed ? '통과' : '재도전'}
            </span>
          </div>

          <div className="af-metrics">
            <Bar label="이완" value={Math.round(100 - latestScore.tensionOverall)} />
            {latestScore.level !== 'beginner' && <Bar label="음정" value={latestScore.pitchAccuracy} />}
            {latestScore.level === 'advanced' && <Bar label="톤" value={Math.round(latestScore.toneStability)} />}
          </div>

          <p className="af-feedback">{latestScore.feedbackHint}</p>

          <div className="af-actions">
            <button className="af-btn-secondary" onClick={doRetry}>다시</button>
            {latestScore.passed && <button className="af-btn-primary" onClick={doNext}>다음 단계</button>}
          </div>
          {!latestScore.passed && (
            <button className="af-skip" onClick={doNext}>건너뛰기</button>
          )}
        </div>
      )}

      {wsError && <p className="af-error">{wsError}</p>}

      <style jsx>{`
        .af { display: flex; flex-direction: column; gap: 16px; }

        .af-coach {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 16px 0;
        }
        .af-coach-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #333; margin-top: 6px; flex-shrink: 0;
          transition: background 0.3s;
        }
        .af-coach-dot[data-active="true"] { background: #e5e5e5; }
        .af-coach-text {
          font-size: 15px; line-height: 1.7; color: #ccc; margin: 0;
        }
        .af-cursor {
          display: inline-block; width: 1.5px; height: 14px;
          background: #666; margin-left: 1px; vertical-align: text-bottom;
          animation: blink 0.7s step-end infinite;
        }
        @keyframes blink { 50% { opacity: 0; } }

        .af-section { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .af-center { display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .af-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
        .af-tags span {
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          background: #1a1a1a; color: #777;
        }
        .af-tag-level { color: #aaa !important; }

        .af-steps {
          list-style: none; padding: 0; margin: 0 0 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .af-steps li {
          font-size: 13px; color: #888; line-height: 1.5;
          padding-left: 20px; position: relative;
        }
        .af-steps li::before {
          content: counter(list-item);
          counter-increment: list-item;
          position: absolute; left: 0; color: #444;
          font-size: 12px; font-weight: 600;
        }

        .af-question {
          font-size: 14px; color: #888; text-align: center;
          padding: 14px 0; margin: 0 0 16px;
          border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;
        }

        .af-btn-primary {
          width: 100%; padding: 14px; border: none; border-radius: 8px;
          background: #e5e5e5; color: #111; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .af-btn-primary:hover { background: #d5d5d5; }

        .af-btn-secondary {
          flex: 1; padding: 14px; border: 1px solid #2a2a2a; border-radius: 8px;
          background: transparent; color: #999; font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .af-btn-secondary:hover { border-color: #3a3a3a; color: #bbb; }

        .af-btn-stop {
          width: 100%; padding: 12px; border: 1px solid #2a2a2a; border-radius: 8px;
          background: transparent; color: #999; font-size: 13px; font-weight: 500;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-top: 12px; transition: all 0.15s;
        }
        .af-btn-stop:hover { border-color: #e55; color: #e55; }

        .af-start-circle {
          width: 80px; height: 80px; border-radius: 50%;
          border: 2px solid #333; background: transparent;
          color: #999; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; margin: 16px 0;
        }
        .af-start-circle:hover { border-color: #e5e5e5; color: #e5e5e5; }

        .af-hint { font-size: 12px; color: #555; margin: 0; }
        .af-retry { font-size: 11px; color: #444; }

        .af-live {
          font-size: 13px; color: #888; text-align: center;
          padding: 10px 14px; margin: 0 0 12px;
          background: #161616; border-radius: 8px;
        }
        .af-live-warn { color: #c88; background: #1a1515; }

        .af-spinner {
          width: 24px; height: 24px; border-radius: 50%;
          border: 2px solid #222; border-top-color: #888;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .af-score-row {
          display: flex; align-items: baseline; gap: 12px;
          padding: 20px 0 16px;
        }
        .af-score {
          font-size: 48px; font-weight: 700; letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .af-verdict { font-size: 16px; font-weight: 600; }
        .af-pass { color: #e5e5e5; }
        .af-fail { color: #888; }

        .af-metrics {
          display: flex; flex-direction: column; gap: 12px;
          padding: 16px 0; margin-bottom: 8px;
          border-top: 1px solid #1a1a1a;
        }

        .af-feedback {
          font-size: 14px; color: #888; line-height: 1.6; margin: 0 0 20px;
        }

        .af-actions { display: flex; gap: 8px; }

        .af-skip {
          width: 100%; padding: 8px; margin-top: 8px;
          border: none; background: transparent;
          color: #444; font-size: 12px; cursor: pointer;
        }
        .af-skip:hover { color: #666; }

        .af-error {
          font-size: 13px; color: #c66; text-align: center;
          padding: 10px; margin: 0;
        }
      `}</style>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#555', width: 28, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.max(0, Math.min(100, value))}%`,
          background: '#888', borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, color: '#888', width: 24, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
