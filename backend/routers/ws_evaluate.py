"""WebSocket /ws/evaluate — 실시간 오디오 스트림 분석."""
from __future__ import annotations
import json
import shutil
import tempfile
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.realtime_analyzer import (
    SessionAccumulator,
    analyze_chunk,
    convert_chunk_to_wav,
    get_somatic_feedback,
)
from services.session_report import generate_session_report

router = APIRouter()


@router.websocket("/ws/evaluate")
async def ws_evaluate(ws: WebSocket):
    """실시간 음성 분석 WebSocket.

    클라이언트 → 서버 메시지:
      - binary: 오디오 청크 (WebM)
      - text JSON: {"type": "start", "stage_id": 1} 또는 {"type": "end"}

    서버 → 클라이언트 메시지 (JSON):
      - {"type": "analysis", "tension": {...}, "feedback": "...", "chunk_index": N}
      - {"type": "report", ...종합 리포트...}
      - {"type": "error", "message": "..."}
    """
    await ws.accept()
    session = SessionAccumulator()
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        while True:
            message = await ws.receive()

            # 텍스트 메시지: start/end 제어
            if "text" in message:
                data = json.loads(message["text"])
                msg_type = data.get("type", "")

                if msg_type == "start":
                    session = SessionAccumulator(stage_id=data.get("stage_id", 0))
                    await ws.send_json({"type": "started", "stage_id": session.stage_id})

                elif msg_type == "end":
                    # 세션 종료 → 종합 리포트
                    report = generate_session_report(session)
                    report["type"] = "report"
                    report["stats"] = session.summary_stats()
                    await ws.send_json(report)
                    break

            # 바이너리 메시지: 오디오 청크
            elif "bytes" in message:
                chunk_data = message["bytes"]
                if not chunk_data:
                    continue

                try:
                    wav_path = convert_chunk_to_wav(chunk_data, tmp_dir)
                    score = analyze_chunk(wav_path)
                    wav_path.unlink(missing_ok=True)

                    if score:
                        feedback = get_somatic_feedback(score, session.chunk_count)
                        session.add(score, feedback)
                        await ws.send_json({
                            "type": "analysis",
                            "chunk_index": session.chunk_count,
                            "tension": {
                                "overall": score.overall,
                                "laryngeal": score.laryngeal_tension,
                                "tongue_root": score.tongue_root_tension,
                                "jaw": score.jaw_tension,
                                "register_break": score.register_break,
                                "detected": score.tension_detected,
                                "detail": score.detail,
                            },
                            "feedback": feedback,
                        })
                    else:
                        await ws.send_json({
                            "type": "analysis",
                            "chunk_index": session.chunk_count,
                            "tension": None,
                            "feedback": "음성이 감지되지 않았어요. 마이크를 확인해보세요.",
                        })

                except Exception as e:
                    await ws.send_json({"type": "error", "message": f"청크 분석 실패: {e}"})

    except WebSocketDisconnect:
        pass
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
