"""POST /evaluate — 음성 분석 + 채점."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import services.audio_service as audio_service
from services.scoring import calculate_pitch_score, calculate_stage_score_v2

router = APIRouter()

class EvaluateRequest(BaseModel):
    stage_id: int
    audio_url: str
    target_pitches: list[float] = []
    video_url: str | None = None

class TensionDetail(BaseModel):
    detected: bool
    detail: str

class EvaluateResponse(BaseModel):
    score: int
    pitch_accuracy: int
    tone_stability: float
    tension_detected: bool
    tension: TensionDetail
    feedback: str
    passed: bool

PASSING_SCORE = 80

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest):
    audio_path = req.audio_url.replace("file://", "")
    try:
        analysis = audio_service.analyze_audio_file(audio_path)
    except FileNotFoundError:
        raise HTTPException(404, "오디오 파일을 찾을 수 없습니다")
    except Exception as e:
        raise HTTPException(500, f"음성 분석 실패: {e}")

    pitch_accuracy = calculate_pitch_score(req.target_pitches, analysis["pitch_values"])
    score, tension_detected, tension_detail = calculate_stage_score_v2(
        float(pitch_accuracy), analysis["tone_stability"], analysis.get("tension_score")
    )
    passed = score >= PASSING_SCORE

    if passed:
        feedback = "좋아요! 안정적으로 소리가 나오고 있어요. 다음 단계로 넘어가볼까요?"
    elif score >= 60:
        if tension_detected and tension_detail:
            feedback = f"거의 다 왔어요! {tension_detail} 부분을 이완하는 데 집중해보세요."
        else:
            feedback = "거의 다 왔어요! 턱과 목을 편하게 유지하는 감각에 집중해보세요."
    else:
        if tension_detected and tension_detail:
            feedback = f"천천히 해봐요. {tension_detail} 긴장이 감지됐어요. 소리 내기 전에 이완 세팅을 먼저 잡아보세요."
        else:
            feedback = "천천히 해봐요. 소리 내기 전에 세팅을 먼저 잡고, 편안한 감각을 유지해보세요."

    return EvaluateResponse(
        score=score,
        pitch_accuracy=pitch_accuracy,
        tone_stability=analysis["tone_stability"],
        tension_detected=tension_detected,
        tension=TensionDetail(detected=tension_detected, detail=tension_detail),
        feedback=feedback,
        passed=passed,
    )
