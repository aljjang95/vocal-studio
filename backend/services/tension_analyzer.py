"""parselmouth 기반 긴장 측정 핵심 엔진."""
from __future__ import annotations
import math
import numpy as np
import soundfile as sf
import parselmouth
from parselmouth.praat import call
from models.tension import (
    VoiceQuality,
    FormantData,
    RegisterTransition,
    TensionAnalysis,
)


def analyze_tension(audio_path: str) -> TensionAnalysis:
    """오디오 파일을 분석하여 긴장 지표를 반환한다."""
    audio, sr = _load_audio(audio_path)
    snd = parselmouth.Sound(audio, sampling_frequency=sr)
    voice_quality = _measure_voice_quality(snd)
    formant = _measure_formants(snd)
    register = _analyze_register_transition(snd)
    return TensionAnalysis(
        voice_quality=voice_quality,
        formant=formant,
        register_transition=register,
        duration=len(audio) / sr,
    )


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _load_audio(path: str) -> tuple[np.ndarray, int]:
    """soundfile로 오디오 로드 (librosa 금지 — Windows parselmouth 데드락)."""
    data, sr = sf.read(path, dtype="float32", always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr


def _safe(val: float, default: float = 0.0) -> float:
    """NaN/Inf 방어."""
    if val != val or math.isinf(val):
        return default
    return val


def _measure_voice_quality(snd: parselmouth.Sound) -> VoiceQuality:
    """Jitter, Shimmer, HNR, H1-H2를 측정한다."""
    # PointProcess
    point_process = call(snd, "To PointProcess (periodic, cc)", 75, 600)

    # Jitter (local) — 비율(0~1) 반환이면 *100
    jitter_raw = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
    jitter_raw = _safe(jitter_raw, 0.0)
    jitter_pct = jitter_raw * 100 if jitter_raw < 1.0 else jitter_raw

    # Shimmer (local) — 비율(0~1) 반환이면 *100
    shimmer_raw = call([snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
    shimmer_raw = _safe(shimmer_raw, 0.0)
    shimmer_pct = shimmer_raw * 100 if shimmer_raw < 1.0 else shimmer_raw

    # HNR
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr = _safe(call(harmonicity, "Get mean", 0, 0), 0.0)

    # H1-H2: LTAS 기반
    h1_h2 = _measure_h1_h2(snd)

    return VoiceQuality(
        jitter_local=jitter_pct,
        shimmer_local=shimmer_pct,
        hnr=hnr,
        h1_h2=h1_h2,
    )


def _measure_h1_h2(snd: parselmouth.Sound) -> float:
    """LTAS 기반 H1-H2 에너지 차이 (dB) 계산."""
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    f0_median = _safe(call(pitch, "Get quantile", 0, 0, 0.5, "Hertz"), 0.0)
    if f0_median <= 0:
        return 0.0

    ltas = call(snd, "To Ltas", 100)

    # H1: f0 ± 50Hz 대역
    h1_low = max(f0_median - 50, 1.0)
    h1_high = f0_median + 50
    h1_energy = _safe(call(ltas, "Get mean", h1_low, h1_high, "energy"), 0.0)

    # H2: 2*f0 ± 50Hz 대역
    h2_low = 2 * f0_median - 50
    h2_high = 2 * f0_median + 50
    h2_energy = _safe(call(ltas, "Get mean", h2_low, h2_high, "energy"), 0.0)

    if h1_energy <= 0 or h2_energy <= 0:
        return 0.0

    return float(10 * math.log10(h1_energy / h2_energy))


def _measure_formants(snd: parselmouth.Sound) -> FormantData:
    """포먼트 F1/F2 평균, 표준편차, VSA를 측정한다."""
    formant_obj = call(snd, "To Formant (burg)", 0.0, 5, 5500, 0.025, 50)
    n_frames = call(formant_obj, "Get number of frames")

    f1_vals: list[float] = []
    f2_vals: list[float] = []

    for i in range(1, n_frames + 1):
        t = call(formant_obj, "Get time from frame number", i)
        v1 = call(formant_obj, "Get value at time", 1, t, "Hertz", "Linear")
        v2 = call(formant_obj, "Get value at time", 2, t, "Hertz", "Linear")
        # NaN 프레임 건너뛰기
        if v1 == v1 and not math.isinf(v1) and v1 > 0:
            f1_vals.append(v1)
        if v2 == v2 and not math.isinf(v2) and v2 > 0:
            f2_vals.append(v2)

    f1_arr = np.array(f1_vals) if f1_vals else np.array([0.0])
    f2_arr = np.array(f2_vals) if f2_vals else np.array([0.0])

    f1_mean = float(np.mean(f1_arr))
    f2_mean = float(np.mean(f2_arr))
    f1_std = float(np.std(f1_arr))
    f2_std = float(np.std(f2_arr))

    # VSA (간단 추정: F1*F2 넓이)
    vsa = float(f1_mean * f2_mean) if f1_mean > 0 and f2_mean > 0 else 0.0

    return FormantData(
        f1_mean=f1_mean,
        f2_mean=f2_mean,
        f1_std=f1_std,
        f2_std=f2_std,
        vsa=vsa,
    )


def _analyze_register_transition(snd: parselmouth.Sound) -> RegisterTransition:
    """F0 프레임간 차이로 성구전환 및 무성구간을 분석한다."""
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    n_frames = call(pitch, "Get number of frames")
    dt = call(pitch, "Get time step")

    f0_frames: list[float] = []
    for i in range(1, n_frames + 1):
        t = call(pitch, "Get time from frame number", i)
        val = call(pitch, "Get value at time", t, "Hertz", "Linear")
        # unvoiced면 0으로 처리
        if val != val or math.isinf(val) or val <= 0:
            f0_frames.append(0.0)
        else:
            f0_frames.append(val)

    if not f0_frames:
        return RegisterTransition(
            transition_detected=False,
            f0_max_jump_hz=0.0,
            hnr_min_at_transition=0.0,
            voiceless_gaps=0,
            smoothness_score=1.0,
        )

    # ── F0 점프 계산 ──
    voiced_prev = 0.0
    max_jump = 0.0
    f0_jumps: list[float] = []

    for f0 in f0_frames:
        if voiced_prev > 0 and f0 > 0:
            jump = abs(f0 - voiced_prev)
            f0_jumps.append(jump)
            if jump > max_jump:
                max_jump = jump
        if f0 > 0:
            voiced_prev = f0

    # ── 무성구간 카운트 (연속 unvoiced 프레임 10ms 이상) ──
    frames_for_10ms = max(1, int(0.01 / dt)) if dt > 0 else 1
    voiceless_gaps = 0
    consecutive = 0
    for f0 in f0_frames:
        if f0 == 0.0:
            consecutive += 1
        else:
            if consecutive >= frames_for_10ms:
                voiceless_gaps += 1
            consecutive = 0
    if consecutive >= frames_for_10ms:
        voiceless_gaps += 1

    # ── transition_detected: 15Hz 이상 점프 ──
    transition_detected = max_jump >= 15.0

    # ── HNR at transition (단순화: 전체 HNR 최솟값) ──
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr_min = _safe(call(harmonicity, "Get minimum", 0, 0, "Parabolic"), 0.0)

    # ── smoothness_score ──
    # f0_jump 페널티 60% + gap 페널티 40%
    if f0_jumps:
        avg_jump = float(np.mean(f0_jumps))
        jump_penalty = min(avg_jump / 200.0, 1.0)  # 200Hz 기준 정규화
    else:
        jump_penalty = 0.0

    gap_penalty = min(voiceless_gaps / 5.0, 1.0)  # 5개 기준 정규화

    smoothness_score = float(1.0 - (0.6 * jump_penalty + 0.4 * gap_penalty))
    smoothness_score = max(0.0, min(1.0, smoothness_score))

    return RegisterTransition(
        transition_detected=transition_detected,
        f0_max_jump_hz=max_jump,
        hnr_min_at_transition=hnr_min,
        voiceless_gaps=voiceless_gaps,
        smoothness_score=smoothness_score,
    )
