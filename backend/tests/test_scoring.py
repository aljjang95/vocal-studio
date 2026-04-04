from __future__ import annotations

import pytest
from services.scoring import calculate_pitch_score, calculate_stage_score


def test_perfect_pitch_returns_100() -> None:
    """동일한 피치를 넣으면 100점이어야 한다."""
    target = [440.0, 493.88, 523.25]
    actual = [440.0, 493.88, 523.25]
    assert calculate_pitch_score(target, actual) == 100


def test_off_pitch_returns_lower() -> None:
    """피치가 크게 어긋나면 50~80 사이 점수가 나와야 한다."""
    target = [440.0, 440.0, 440.0]
    # ~100cent 이탈 (반음 1개 = 100cent)
    actual = [466.16, 466.16, 466.16]
    score = calculate_pitch_score(target, actual)
    assert 50 <= score <= 80


def test_empty_actual_returns_zero() -> None:
    """actual이 비어있으면 0점이어야 한다."""
    assert calculate_pitch_score([440.0], []) == 0


def test_no_target_returns_zero() -> None:
    """target이 비어있으면 0점이어야 한다."""
    assert calculate_pitch_score([], [440.0]) == 0


def test_combines_pitch_and_stability() -> None:
    """pitch 60% + stability 40% 가중치가 올바르게 적용되어야 한다."""
    # pitch_accuracy=80, stability=60, tension=False
    # 기대값: 80*0.6 + 60*0.4 = 48 + 24 = 72
    score = calculate_stage_score(pitch_accuracy=80.0, tone_stability=60.0, tension_detected=False)
    assert score == 72


def test_tension_penalty() -> None:
    """tension_detected=True이면 최종 점수에서 20%가 감점되어야 한다."""
    # pitch_accuracy=100, stability=100, tension=True
    # 기대값: (100*0.6 + 100*0.4) * 0.8 = 100 * 0.8 = 80
    score = calculate_stage_score(pitch_accuracy=100.0, tone_stability=100.0, tension_detected=True)
    assert score == 80


def test_score_clamped_0_100() -> None:
    """점수는 항상 0~100 사이여야 한다."""
    low = calculate_stage_score(pitch_accuracy=0.0, tone_stability=0.0, tension_detected=True)
    high = calculate_stage_score(pitch_accuracy=200.0, tone_stability=200.0, tension_detected=False)
    assert low == 0
    assert high == 100
