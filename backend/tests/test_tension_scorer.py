"""긴장 점수 계산 테스트."""
from __future__ import annotations
import pytest
from models.tension import FormantData, RegisterTransition, TensionAnalysis, TensionScore, VoiceQuality
from services.tension_scorer import calculate_tension_score

def _make_analysis(**overrides) -> TensionAnalysis:
    defaults = {
        "voice_quality": VoiceQuality(jitter_local=0.5, shimmer_local=2.0, hnr=22.0, h1_h2=2.0),
        "formant": FormantData(f1_mean=500, f2_mean=1500, f1_std=30, f2_std=50, vsa=1500),
        "register_transition": RegisterTransition(transition_detected=False, f0_max_jump_hz=5.0,
            hnr_min_at_transition=18.0, voiceless_gaps=0, smoothness_score=0.9),
        "duration": 2.0,
    }
    defaults.update(overrides)
    return TensionAnalysis(**defaults)

class TestTensionScorer:
    def test_relaxed_voice_low_score(self):
        score = calculate_tension_score(_make_analysis())
        assert score.overall < 30
        assert score.tension_detected is False

    def test_high_jitter_increases_laryngeal(self):
        score = calculate_tension_score(_make_analysis(
            voice_quality=VoiceQuality(jitter_local=3.0, shimmer_local=8.0, hnr=12.0, h1_h2=-3.0)))
        assert score.laryngeal_tension > 50
        assert score.tension_detected is True

    def test_register_break_increases_score(self):
        score = calculate_tension_score(_make_analysis(
            register_transition=RegisterTransition(transition_detected=True, f0_max_jump_hz=40.0,
                hnr_min_at_transition=8.0, voiceless_gaps=2, smoothness_score=0.2)))
        assert score.register_break > 50

    def test_score_clamped(self):
        score = calculate_tension_score(_make_analysis(
            voice_quality=VoiceQuality(jitter_local=5.0, shimmer_local=15.0, hnr=5.0, h1_h2=-8.0),
            register_transition=RegisterTransition(transition_detected=True, f0_max_jump_hz=80.0,
                hnr_min_at_transition=3.0, voiceless_gaps=5, smoothness_score=0.0)))
        assert 0 <= score.overall <= 100
        assert score.tension_detected is True

    def test_detail_mentions_main_tension(self):
        score = calculate_tension_score(_make_analysis(
            voice_quality=VoiceQuality(jitter_local=3.0, shimmer_local=8.0, hnr=12.0, h1_h2=-3.0)))
        assert len(score.detail) > 0
