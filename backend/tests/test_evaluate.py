import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")

@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_evaluate_requires_audio(client):
    resp = await client.post("/evaluate", json={"stage_id": 1})
    assert resp.status_code == 422

@pytest.mark.asyncio
async def test_evaluate_with_mock_audio(client, monkeypatch):
    import services.audio_service as audio_svc
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7, 329.6, 349.2, 392.0],
        "avg_pitch": 325.2, "tone_stability": 88.0, "duration": 5.0,
        "tension_score": None,
    })
    resp = await client.post("/evaluate", json={
        "stage_id": 1, "audio_url": "file:///fake/audio.wav",
        "target_pitches": [261.6, 293.7, 329.6, 349.2, 392.0],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data and "feedback" in data
    assert 0 <= data["score"] <= 100
    assert "tension" in data
    assert data["tension"]["detected"] is False


@pytest.mark.asyncio
async def test_evaluate_with_tension_detected(client, monkeypatch):
    """tension_score가 있을 때 tension_detected가 반영되어야 한다."""
    from models.tension import TensionScore
    import services.audio_service as audio_svc
    mock_tension = TensionScore(
        overall=60.0, laryngeal_tension=65.0, tongue_root_tension=55.0,
        jaw_tension=50.0, register_break=60.0, tension_detected=True, detail="후두 긴장",
    )
    monkeypatch.setattr(audio_svc, "analyze_audio_file", lambda path: {
        "pitch_values": [261.6, 293.7, 329.6, 349.2, 392.0],
        "avg_pitch": 325.2, "tone_stability": 88.0, "duration": 5.0,
        "tension_score": mock_tension,
    })
    resp = await client.post("/evaluate", json={
        "stage_id": 1, "audio_url": "file:///fake/audio.wav",
        "target_pitches": [261.6, 293.7, 329.6, 349.2, 392.0],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["tension_detected"] is True
    assert data["tension"]["detected"] is True
    assert "후두 긴장" in data["tension"]["detail"]
