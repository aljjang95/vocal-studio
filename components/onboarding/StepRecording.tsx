'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import Button from '@/components/ds/Button';

const MIN_SEC = 5;
const MAX_SEC = 30;

export default function StepRecording() {
  const { setStep, setAnalyzing, setError, setResult } = useOnboardingStore();

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    setFileName(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        cleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_SEC) {
            recorderRef.current?.stop();
            setIsRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      setError('마이크 권한을 허용해주세요.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setFileName(file.name);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    if (!fileName && elapsed < MIN_SEC) {
      setError(`최소 ${MIN_SEC}초 이상 녹음해주세요.`);
      return;
    }

    setSubmitting(true);
    setStep(1);
    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName ?? 'recording.webm');

      const res = await fetch('/api/onboarding-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '분석에 실패했습니다.';
      setError(msg);
      setStep(0);
    } finally {
      setAnalyzing(false);
      setSubmitting(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s_ = sec % 60;
    return `${m}:${s_.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-7 py-5 animate-[slideIn_0.4s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold text-center">
        목소리를 들려주세요
      </h3>
      <p className="text-[0.9rem] text-[var(--text2)] text-center leading-relaxed max-w-[480px]">
        편하게 아무 노래나 한 소절 불러주세요. AI가 목소리 상태를 분석하고 맞춤 로드맵을 만들어드립니다.
      </p>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          className={`w-24 h-24 max-[560px]:w-20 max-[560px]:h-20 rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all duration-300 ${
            isRecording
              ? 'border-[var(--error)] bg-[rgba(239,68,68,0.1)] animate-[recPulse_1.5s_ease-in-out_infinite]'
              : 'border-[var(--border2)] bg-[var(--bg3)] hover:border-[var(--accent)] hover:bg-[rgba(59,130,246,0.08)]'
          }`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={submitting}
          aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
        >
          <div
            className={`transition-all duration-200 bg-[var(--error)] ${
              isRecording ? 'w-6 h-6 rounded' : 'w-8 h-8 rounded-full'
            }`}
          />
        </button>
        <span
          className={`font-mono text-[1.1rem] font-semibold min-w-[60px] text-center ${
            isRecording ? 'text-[var(--error)]' : 'text-[var(--text2)]'
          }`}
        >
          {formatTime(elapsed)}
        </span>
        {isRecording && (
          <span className="text-[0.78rem] text-[var(--muted)] text-center">
            {elapsed < MIN_SEC
              ? `${MIN_SEC - elapsed}초 더 녹음해주세요`
              : '중지 버튼을 눌러 완료하세요'}
          </span>
        )}
      </div>

      {audioBlob && !isRecording && (
        <p className="text-[0.82rem] text-[var(--accent-lt)] text-center">
          {fileName ?? `녹음 완료 (${elapsed}초)`}
        </p>
      )}

      <div className="flex items-center gap-4 w-full max-w-[320px] text-[var(--muted)] text-[0.78rem] before:content-[''] before:flex-1 before:h-px before:bg-[var(--border)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--border)]">
        또는
      </div>

      <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)] text-[var(--text2)] text-[0.85rem] cursor-pointer transition-all duration-200 hover:border-[var(--border2)] hover:text-[var(--text)]">
        파일 업로드
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isRecording || submitting}
        />
      </label>

      {audioBlob && !isRecording && (
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '분석 중...' : '분석 시작'}
        </Button>
      )}
    </div>
  );
}
