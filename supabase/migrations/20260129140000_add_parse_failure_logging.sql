-- 파싱 실패 시 AI 응답 샘플 저장용 컬럼 추가
-- 디버깅 및 프롬프트 개선에 활용

-- cold_start_logs에 실패 응답 샘플 컬럼 추가
ALTER TABLE cold_start_logs
ADD COLUMN IF NOT EXISTS raw_response_sample TEXT;

-- 컬럼 코멘트
COMMENT ON COLUMN cold_start_logs.raw_response_sample IS '파싱 실패 시 AI 응답 샘플 (앞 2000자)';

-- 파싱 실패 로그만 조회하는 뷰 (디버깅용)
CREATE OR REPLACE VIEW cold_start_parse_failures AS
SELECT
  id,
  created_at,
  input_params,
  output_result->>'failed_at' as failed_at,
  error_message,
  raw_response_sample,
  duration_ms
FROM cold_start_logs
WHERE success = false
   OR output_result->'stats'->>'usedFallback' = 'true'
ORDER BY created_at DESC;

COMMENT ON VIEW cold_start_parse_failures IS 'Cold Start 파싱 실패 및 Fallback 케이스 조회용 뷰';
