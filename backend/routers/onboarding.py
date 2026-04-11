"""온보딩 API — 음성 분석 + AI 상담 + TTS."""
from __future__ import annotations
import shutil
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
import services.audio_service as audio_service
from services.audio_utils import convert_to_wav
from services.onboarding_service import generate_consultation
from services.voice_feedback import synthesize_feedback
import subprocess

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

MAX_AUDIO_SIZE = 20 * 1024 * 1024  # 20MB


class OnboardingTensionResponse(BaseModel):
    overall: float
    laryngeal: float
    tongue_root: float
    jaw: float
    register_break: float
    detail: str


class ConsultationResponse(BaseModel):
    problems: list[str]
    roadmap: list[str]
    suggested_stage_id: int
    summary: str


class OnboardingAnalyzeResponse(BaseModel):
    tension: OnboardingTensionResponse
    consultation: ConsultationResponse


class TTSRequest(BaseModel):
    text: str


@router.post("/analyze", response_model=OnboardingAnalyzeResponse)
async def analyze(audio: UploadFile):
    """음성 파일 업로드 → 긴장 분석 + AI 상담."""
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        # 1) 업로드 파일 저장
        ext = Path(audio.filename or "audio.webm").suffix or ".webm"
        src_path = tmp_dir / f"{uuid.uuid4().hex}{ext}"
        content = await audio.read()
        if len(content) > MAX_AUDIO_SIZE:
            raise HTTPException(413, "파일이 너무 큽니다 (최대 20MB)")
        src_path.write_bytes(content)

        # 2) WAV 변환
        if ext.lower() == ".wav":
            wav_path = src_path
        else:
            wav_path = tmp_dir / f"{uuid.uuid4().hex}.wav"
            try:
                convert_to_wav(src_path, wav_path)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                raise HTTPException(500, f"오디오 변환 실패: {e}")

        # 3) 음성 분석
        try:
            analysis = audio_service.analyze_audio_file(str(wav_path))
        except FileNotFoundError:
            raise HTTPException(404, "오디오 파일을 찾을 수 없습니다")
        except Exception as e:
            raise HTTPException(500, f"음성 분석 실패: {e}")

        # 4) 긴장 점수 추출
        tension_score = analysis.get("tension_score")
        if tension_score is None:
            # 긴장 분석 실패 시 기본값
            from models.tension import TensionScore
            tension_score = TensionScore(
                overall=0.0,
                laryngeal_tension=0.0,
                tongue_root_tension=0.0,
                jaw_tension=0.0,
                register_break=0.0,
                tension_detected=False,
                detail="분석 데이터 부족",
            )

        # 5) AI 상담
        consultation = await generate_consultation(tension_score)

        return OnboardingAnalyzeResponse(
            tension=OnboardingTensionResponse(
                overall=tension_score.overall,
                laryngeal=tension_score.laryngeal_tension,
                tongue_root=tension_score.tongue_root_tension,
                jaw=tension_score.jaw_tension,
                register_break=tension_score.register_break,
                detail=tension_score.detail,
            ),
            consultation=ConsultationResponse(**consultation),
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/tts")
async def tts(req: TTSRequest):
    """텍스트 → 음성 합성 (edge-tts)."""
    if not req.text or not req.text.strip():
        raise HTTPException(400, "텍스트가 비어있습니다")

    audio_bytes = await synthesize_feedback(req.text)
    if audio_bytes is None:
        raise HTTPException(500, "음성 합성 실패")

    return Response(content=audio_bytes, media_type="audio/mpeg")
