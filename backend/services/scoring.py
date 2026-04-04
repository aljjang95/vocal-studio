from __future__ import annotations

import math


def calculate_pitch_score(target_hz: list[float], actual_hz: list[float]) -> int:
    """cent 단위 오차 기반 피치 정확도를 계산한다.

    Args:
        target_hz: 목표 주파수 목록 (Hz)
        actual_hz: 실제 측정된 주파수 목록 (Hz)

    Returns:
        피치 정확도 점수 (0~100)
    """
    if not target_hz or not actual_hz:
        return 0

    pairs = list(zip(target_hz, actual_hz))
    if not pairs:
        return 0

    cent_errors: list[float] = []
    for t, a in pairs:
        if t <= 0 or a <= 0:
            cent_errors.append(1200.0)  # 최대 오차로 처리
            continue
        # 1 cent = 1/100 반음, 1 옥타브 = 1200 cent
        cents = abs(1200.0 * math.log2(a / t))
        cent_errors.append(cents)

    mean_error = sum(cent_errors) / len(cent_errors)

    # 0cent = 100점, 300cent (단3도) 이상 = 0점 선형 보간
    # 반음 1개(100cent) 이탈 시 약 67점 수준
    max_error = 300.0
    score = max(0.0, (1.0 - mean_error / max_error) * 100.0)
    return round(score)


def calculate_stage_score(
    pitch_accuracy: float,
    tone_stability: float,
    tension_detected: bool,
) -> int:
    """피치 정확도와 음색 안정도를 통합하여 스테이지 점수를 계산한다.

    가중치: pitch 60% + stability 40%
    tension_detected=True이면 최종 점수에서 20% 감점

    Args:
        pitch_accuracy: 피치 정확도 (0~100)
        tone_stability: 음색 안정도 (0~100)
        tension_detected: 긴장 감지 여부

    Returns:
        통합 점수 (0~100)
    """
    raw = pitch_accuracy * 0.6 + tone_stability * 0.4

    if tension_detected:
        raw *= 0.8

    score = max(0.0, min(100.0, raw))
    return round(score)
