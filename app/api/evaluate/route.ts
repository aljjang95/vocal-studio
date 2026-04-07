import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File | null;
    const stageId = formData.get('stage_id') as string;

    if (!audio || !stageId) {
      return NextResponse.json(
        { error: '오디오와 단계 ID가 필요합니다', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    // FormData를 그대로 Python 백엔드에 전달
    const backendForm = new FormData();
    backendForm.append('audio', audio, audio.name || 'recording.webm');
    backendForm.append('stage_id', stageId);
    backendForm.append('target_pitches', formData.get('target_pitches') as string || '[]');

    const resp = await fetch(`${BACKEND_URL}/evaluate`, {
      method: 'POST',
      body: backendForm,
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: '채점 서버 연결 실패', code: 'BACKEND_ERROR' },
      { status: 502 },
    );
  }
}
