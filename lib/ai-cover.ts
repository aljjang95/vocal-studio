import { createClient } from '@/lib/supabase/client';
import type { VoiceModel, AiCoverConversion } from '@/types';

export async function getModels(): Promise<VoiceModel[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('voice_models')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMonthlyUsage(): Promise<number> {
  const supabase = createClient();
  const yearMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from('ai_cover_usage')
    .select('count')
    .eq('year_month', yearMonth)
    .maybeSingle();
  return data?.count ?? 0;
}

export async function uploadRecording(file: Blob, fileName: string): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');

  const path = `${user.id}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage
    .from('ai-cover-models')
    .upload(path, file, { contentType: 'audio/wav' });
  if (error) throw error;
  return path;
}

export async function startTraining(
  recordingPaths: string[],
  modelName: string,
  epochs: number = 50,
): Promise<{ modelId: string }> {
  const res = await fetch('/api/ai-cover/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordingPaths, modelName, epochs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '서버 오류' }));
    throw new Error(err.error || '학습 요청 실패');
  }
  return res.json();
}

export async function startConversion(
  songFile: File,
  modelId: string,
  pitchShift: number = 0,
): Promise<{ conversionId: string }> {
  const formData = new FormData();
  formData.append('audio', songFile);
  formData.append('modelId', modelId);
  formData.append('pitchShift', String(pitchShift));

  const res = await fetch('/api/ai-cover/convert', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '서버 오류' }));
    throw new Error(err.error || '변환 요청 실패');
  }
  return res.json();
}

export async function getConversionStatus(conversionId: string): Promise<AiCoverConversion> {
  const res = await fetch(`/api/ai-cover/status/${conversionId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '서버 오류' }));
    throw new Error(err.error || '상태 조회 실패');
  }
  return res.json();
}

export function getStorageUrl(bucket: string, path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
