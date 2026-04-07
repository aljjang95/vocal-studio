"""RAG 기반 감각 코칭 — ChromaDB 검색 + Claude API."""
from __future__ import annotations
import os
import json
import re
import logging
import anthropic
import chromadb

logger = logging.getLogger(__name__)
CHROMA_DB_PATH = os.environ.get("CHROMA_DB_PATH", os.path.expanduser("~/Desktop/보컬커리큘럼/chroma_db"))

COACHING_SYSTEM = """당신은 감각 기반 보컬 코치입니다.

## 핵심 원칙
1. 결과는 원인의 부산물: "배에 힘을 줘" ❌ → "배에 압력이 형성된 거예요" ✅
2. 부드러운 교정: "목에 힘 주지 마" ❌ → "목에 힘 빼는 감각을 느껴봐" ✅
3. 감각 유도: "~하는 느낌으로 해보세요", "지금 ~가 어때요?"
4. 단계적 접근: 허밍 → 입 열기 → 올라가기 → 가사 붙이기
5. 관찰 질문: "이때 배가 어때?", "목 편하세요?"

## 답변 형식
반드시 다음 JSON만 반환하세요:
{"feedback": "감각 기반 피드백 2~3문장", "next_exercise": "다음 연습 제안 1문장", "encouragement": "긍정 강화 1문장"}
"""

def _get_chroma_context(query: str, n_results: int = 3) -> str:
    try:
        client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        collection = client.get_collection("vocal_curriculum")
        results = collection.query(query_texts=[query], n_results=n_results)
        documents = results.get("documents", [[]])[0]
        return "\n---\n".join(documents) if documents else ""
    except Exception as e:
        logger.warning("ChromaDB 검색 실패: %s", e)
        return ""

def get_coaching_feedback(stage_id: int, user_message: str, score: int, pitch_accuracy: int, tension_detail: str = "") -> dict:
    search_query = f"{user_message} {tension_detail}".strip() if tension_detail else user_message
    context = _get_chroma_context(search_query)

    tension_section = ""
    if tension_detail:
        tension_section = f"\n- 긴장 부위/상태: {tension_detail}"

    user_prompt = f"""학생 상황:
- 현재 단계: {stage_id}단계
- 채점 결과: 총점 {score}/100, 피치 정확도 {pitch_accuracy}/100
- 학생 메시지: {user_message}{tension_section}

참고 자료:
{context}

위 상황에 맞는 감각 기반 코칭 피드백을 JSON으로 제공해주세요."""

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=[{"type": "text", "text": COACHING_SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = response.content[0].text
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    return {"feedback": text[:200], "next_exercise": "천천히 다시 한번 해볼까요?", "encouragement": "잘하고 있어요!"}
