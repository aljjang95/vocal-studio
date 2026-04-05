'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { useJourneyStore } from '@/stores/journeyStore';
import PitchVisualizer from '@/components/journey/PitchVisualizer';
import FeedbackPanel from '@/components/journey/FeedbackPanel';
import type { EvaluationResult, CoachingFeedback } from '@/types';

interface Props { stageId: number; }

export default function PracticeClient({ stageId }: Props) {
  const router = useRouter();
  const stage = hlbCurriculum.find((s) => s.id === stageId);
  const { canAccessStage, submitEvaluation, progress } = useJourneyStore();

  const [isRecording, setIsRecording] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<number | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [coaching, setCoaching] = useState<CoachingFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  if (!stage) return <div className="p-4 text-white">단계를 찾을 수 없습니다.</div>;
  if (!canAccessStage(stageId)) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <span className="text-4xl">🔒</span>
          <p className="mt-4 text-gray-400">이전 단계를 먼저 완료해주세요.</p>
          <button onClick={() => router.push('/journey')} className="mt-4 text-indigo-400 underline">여정으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('stage_id', String(stageId));
      formData.append('target_pitches', JSON.stringify(stage.pattern.map((semitone) => 261.6 * Math.pow(2, semitone / 12))));
      const evalResp = await fetch('/api/evaluate', { method: 'POST', body: formData });
      const evalData: EvaluationResult = await evalResp.json();
      setEvaluation(evalData);
      submitEvaluation(stageId, evalData);
      const coachResp = await fetch('/api/journey-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId, user_message: `${stage.name} 연습 중입니다. 점수: ${evalData.score}`, score: evalData.score, pitch_accuracy: evalData.pitchAccuracy, tension_detail: evalData.tension?.detail ?? "" }),
      });
      const coachData: CoachingFeedback = await coachResp.json();
      setCoaching(coachData);
    } catch (e) {
      console.error('채점 실패:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleSubmit(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setEvaluation(null);
      setCoaching(null);
    } catch {
      alert('마이크 접근 권한이 필요합니다.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const prog = progress[stageId];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/journey')} className="text-gray-400">←</button>
        <div>
          <div className="text-sm text-gray-400">{stage.blockIcon} {stage.block}</div>
          <h1 className="text-xl font-bold">{stage.name}</h1>
        </div>
      </header>
      <div className="mb-4 p-3 rounded-lg bg-gray-900/50 border border-gray-800">
        <p className="text-sm text-gray-300">
          발음: <span className="text-white font-medium">{stage.pronunciation}</span> · BPM: {stage.bpmRange[0]}~{stage.bpmRange[1]} · {stage.scaleType}
        </p>
        <p className="text-xs text-gray-500 mt-1">{stage.evaluationCriteria.description}</p>
      </div>
      <PitchVisualizer
        targetPitches={stage.pattern.map((s) => 261.6 * Math.pow(2, s / 12))}
        currentPitch={currentPitch}
        isActive={isRecording}
      />
      <div className="flex justify-center my-6">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-200
            ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
      </div>
      <div className="mb-4 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900">
        <p className="text-sm text-indigo-300">💬 {stage.somaticFeedback.observationQuestion}</p>
      </div>
      <FeedbackPanel evaluation={evaluation} coaching={coaching} isLoading={isLoading} />
      {prog && prog.bestScore > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">최고 점수: {prog.bestScore} · 시도: {prog.attempts}회</div>
      )}
    </div>
  );
}
