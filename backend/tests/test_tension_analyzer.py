"""긴장 분석기 테스트 — 합성 WAV로 parselmouth 분석 검증."""
from __future__ import annotations
import pytest
from tests.fixtures.generate_wav import generate_stable_tone, generate_tense_tone
from services.tension_analyzer import analyze_tension
from models.tension import TensionAnalysis

@pytest.fixture
def stable_wav(tmp_path):
    return generate_stable_tone(str(tmp_path / "stable.wav"))

@pytest.fixture
def tense_wav(tmp_path):
    return generate_tense_tone(str(tmp_path / "tense.wav"))

class TestVoiceQuality:
    def test_stable_tone_low_jitter(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert isinstance(result, TensionAnalysis)
        assert result.voice_quality.jitter_local < 2.0

    def test_tense_tone_higher_jitter(self, stable_wav, tense_wav):
        stable = analyze_tension(stable_wav)
        tense = analyze_tension(tense_wav)
        assert tense.voice_quality.jitter_local > stable.voice_quality.jitter_local

    def test_stable_tone_high_hnr(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.voice_quality.hnr > 10.0

    def test_tense_tone_lower_hnr(self, stable_wav, tense_wav):
        stable = analyze_tension(stable_wav)
        tense = analyze_tension(tense_wav)
        assert tense.voice_quality.hnr < stable.voice_quality.hnr

    def test_h1_h2_computed(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert isinstance(result.voice_quality.h1_h2, float)

class TestFormant:
    def test_formant_values_positive(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.formant.f1_mean > 0
        assert result.formant.f2_mean > 0

    def test_vsa_non_negative(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert result.formant.vsa >= 0

class TestDuration:
    def test_duration_matches(self, stable_wav):
        result = analyze_tension(stable_wav)
        assert 1.5 < result.duration < 2.5
