"""POST /evaluate — 음성 파일 업로드 + 분석 + 채점."""
from __future__ import annotations
import json
import subprocess
import tempfile
import uuid
from pathlib import Path
from fastapi import APIRouter, Form, HTTPException, UploadFile
from pydantic import BaseModel
import services.audio_service as audio_service
from services.audio_utils import convert_to_wav
from services.scoring import calculate_pitch_score, calculate_stage_score_v2, calculate_scale_practice_score

router = APIRouter()


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
MAX_AUDIO_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(
    audio: UploadFile,
    stage_id: int = Form(...),
    target_pitches: str = Form("[]"),
):
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        # 1) 업로드 파일 저장
        ext = Path(audio.filename or "audio.webm").suffix or ".webm"
        src_path = tmp_dir / f"{uuid.uuid4().hex}{ext}"
        content = await audio.read()
        if len(content) > MAX_AUDIO_SIZE:
            raise HTTPException(413, "파일이 너무 큽니다 (최대 20MB)")
        src_path.write_bytes(content)

        # 2) WAV 변환 (이미 WAV면 그대로 사용)
        if ext.lower() == ".wav":
            wav_path = src_path
        else:
            wav_path = tmp_dir / f"{uuid.uuid4().hex}.wav"
            try:
                convert_to_wav(src_path, wav_path)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                raise HTTPException(500, f"오디오 변환 실패: {e}")

        # 3) 분석
        try:
            analysis = audio_service.analyze_audio_file(str(wav_path))
        except FileNotFoundError:
            raise HTTPException(404, "오디오 파일을 찾을 수 없습니다")
        except Exception as e:
            raise HTTPException(500, f"음성 분석 실패: {e}")

        # 4) 채점
        try:
            pitches = json.loads(target_pitches)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "target_pitches가 올바른 JSON 형식이 아닙니다")
        pitch_accuracy = calculate_pitch_score(pitches, analysis["pitch_values"])
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
    finally:
        # 5) 임시 파일 정리
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


class ScalePracticeResponse(BaseModel):
    score: int
    passed: bool
    level: str
    feedback_hint: str
    tension_overall: float
    pitch_accuracy: int
    tone_stability: float


@router.post("/evaluate/scale-practice", response_model=ScalePracticeResponse)
async def evaluate_scale_practice(
    audio: UploadFile,
    stage_id: int = Form(...),
    target_pitches: str = Form("[]"),
):
    """3단계 채점 공식으로 스케일 연습을 채점한다."""
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        ext = Path(audio.filename or "audio.webm").suffix or ".webm"
        src_path = tmp_dir / f"{uuid.uuid4().hex}{ext}"
        content = await audio.read()
        if len(content) > MAX_AUDIO_SIZE:
            raise HTTPException(413, "파일이 너무 큽니다 (최대 20MB)")
        src_path.write_bytes(content)

        if ext.lower() == ".wav":
            wav_path = src_path
        else:
            wav_path = tmp_dir / f"{uuid.uuid4().hex}.wav"
            try:
                convert_to_wav(src_path, wav_path)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                raise HTTPException(500, f"오디오 변환 실패: {e}")

        try:
            analysis = audio_service.analyze_audio_file(str(wav_path))
        except FileNotFoundError:
            raise HTTPException(404, "오디오 파일을 찾을 수 없습니다")
        except Exception as e:
            raise HTTPException(500, f"음성 분석 실패: {e}")

        try:
            pitches = json.loads(target_pitches)
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "target_pitches가 올바른 JSON 형식이 아닙니다")
        pitch_accuracy = calculate_pitch_score(pitches, analysis["pitch_values"])
        tension_overall = 0.0
        if analysis.get("tension_score"):
            tension_overall = analysis["tension_score"].overall

        result = calculate_scale_practice_score(
            stage_id=stage_id,
            tension_overall=tension_overall,
            pitch_accuracy=float(pitch_accuracy),
            tone_stability=analysis["tone_stability"],
        )

        return ScalePracticeResponse(
            score=result.score,
            passed=result.passed,
            level=result.level,
            feedback_hint=result.feedback_hint,
            tension_overall=tension_overall,
            pitch_accuracy=pitch_accuracy,
            tone_stability=analysis["tone_stability"],
        )
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
