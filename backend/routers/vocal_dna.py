"""POST /vocal-dna/analyze — 보컬 DNA 5축 분석 라우터."""
from __future__ import annotations

import math
import tempfile
from pathlib import Path

import parselmouth
import soundfile as sf
from fastapi import APIRouter, HTTPException, UploadFile
from parselmouth.praat import call
from pydantic import BaseModel, Field

from models.tension import TensionAnalysis, TensionScore
from services.audio_utils import convert_to_wav
from services.tension_analyzer import analyze_tension
from services.tension_scorer import calculate_tension_score

router = APIRouter()


# ── 응답 모델 ─────────────────────────────────────────────────────────────────

class VocalDnaResponse(BaseModel):
    laryngeal: float = Field(ge=0, le=100, description="후두 이완도 (높을수록 좋음)")
    tongue_root: float = Field(ge=0, le=100, description="혀뿌리 이완도")
    jaw: float = Field(ge=0, le=100, description="턱 이완도")
    register_break: float = Field(ge=0, le=100, description="성구전환 안정도")
    tone_stability: float = Field(ge=0, le=100, description="음색 안정도 (HNR 기반)")
    avg_pitch_hz: float | None = Field(default=None, description="평균 기본주파수 (Hz)")
    voice_type: str | None = Field(default=None, description="음역대 분류")


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _extract_avg_pitch(audio_path: str) -> float:
    """parselmouth F0 평균 추출. 감지 불가 시 0.0 반환."""
    try:
        data, sr = sf.read(audio_path, dtype="float32", always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        snd = parselmouth.Sound(data, sampling_frequency=float(sr))
        pitch = call(snd, "To Pitch", 0.0, 75, 600)
        f0_mean = call(pitch, "Get mean", 0, 0, "Hertz")
        if f0_mean != f0_mean or math.isinf(f0_mean) or f0_mean <= 0:
            return 0.0
        return float(f0_mean)
    except Exception:
        return 0.0


def _classify_voice_type(avg_pitch_hz: float) -> str | None:
    """피치 기반 음역대 분류.

    남성 범위 (< 330Hz):  < 165Hz 저음 / 165~330Hz 중음
    여성 범위 (>= 330Hz): 330~440Hz 중음 / >= 440Hz 고음
    330Hz 이상은 여성 음역으로 분류한다.
    """
    if avg_pitch_hz <= 0:
        return None
    if avg_pitch_hz < 165.0:
        return "남성 저음"
    if avg_pitch_hz < 330.0:
        return "남성 중음"
    if avg_pitch_hz < 440.0:
        return "여성 중음"
    return "여성 고음"


def _run_analysis(wav_path: str) -> tuple[TensionAnalysis, TensionScore, float]:
    """WAV 경로 → (TensionAnalysis, TensionScore, avg_pitch_hz)."""
    analysis = analyze_tension(wav_path)
    score = calculate_tension_score(analysis)
    avg_pitch = _extract_avg_pitch(wav_path)
    return analysis, score, avg_pitch


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ── 라우터 ────────────────────────────────────────────────────────────────────

@router.post("/vocal-dna/analyze", response_model=VocalDnaResponse)
async def analyze_vocal_dna(audio: UploadFile) -> VocalDnaResponse:
    """오디오 업로드 → 5축 보컬 DNA 분석.

    긴장 점수를 반전하여 '높을수록 좋음' 스케일로 반환한다.
    """
    raw_bytes = await audio.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="빈 오디오 파일입니다.")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        # 원본 파일 저장
        src = tmp / f"input_{audio.filename or 'audio'}"
        src.write_bytes(raw_bytes)

        # WAV 변환
        dst = tmp / "converted.wav"
        try:
            convert_to_wav(src, dst)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"오디오 변환 실패: {exc}",
            ) from exc

        # 분석 실행
        try:
            analysis, score, avg_pitch = _run_analysis(str(dst))
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"음성 분석 중 오류: {exc}",
            ) from exc

    # 긴장 점수 반전 (긴장↑ = 나쁨 → DNA↑ = 좋음)
    laryngeal = _clamp(100.0 - score.laryngeal_tension)
    tongue_root = _clamp(100.0 - score.tongue_root_tension)
    jaw = _clamp(100.0 - score.jaw_tension)
    register_break = _clamp(100.0 - score.register_break)

    # tone_stability: HNR 20dB = 100점 기준 정규화
    tone_stability = _clamp(analysis.voice_quality.hnr * 5.0)

    # pitch / voice_type
    pitch_out = avg_pitch if avg_pitch > 0 else None
    voice_type = _classify_voice_type(avg_pitch)

    return VocalDnaResponse(
        laryngeal=laryngeal,
        tongue_root=tongue_root,
        jaw=jaw,
        register_break=register_break,
        tone_stability=tone_stability,
        avg_pitch_hz=pitch_out,
        voice_type=voice_type,
    )
