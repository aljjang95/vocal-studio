-- ────────────────────────────────────────────────────────────
-- Phase 12: AI 커버 듀얼 엔진 — engine 컬럼 추가
-- ────────────────────────────────────────────────────────────

-- ai_cover_conversions에 engine 컬럼 추가 (rvc 기본, hq_svc 옵션)
alter table if exists ai_cover_conversions
  add column if not exists engine text default 'rvc';

-- 녹음 데이터 총량 추적용 뷰 (성장 시스템)
create or replace view user_recording_stats as
select
  user_id,
  count(*) as recording_count,
  coalesce(sum(duration_sec), 0) as total_recording_sec
from recordings
group by user_id;
