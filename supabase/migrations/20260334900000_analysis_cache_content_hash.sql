-- ============================================
-- 증분 역량 분석: 레코드별 content_hash 추가
-- content 텍스트 해시로 변경 감지 → 미변경 레코드 AI 호출 스킵
-- ============================================

ALTER TABLE public.student_record_analysis_cache
  ADD COLUMN IF NOT EXISTS content_hash varchar(20);

COMMENT ON COLUMN public.student_record_analysis_cache.content_hash
IS 'DJB2 hash of record content text. Used for incremental analysis: skip re-analysis if content unchanged.';
