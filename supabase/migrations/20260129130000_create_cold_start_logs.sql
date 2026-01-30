-- Cold Start 실행 로그 테이블
-- 프롬프트 개선을 위한 데이터 수집용

CREATE TABLE cold_start_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 입력 파라미터
  input_params JSONB NOT NULL,

  -- 실행 결과
  output_result JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- 성능 지표
  duration_ms INTEGER,
  items_count INTEGER DEFAULT 0,

  -- 콘텐츠 타입별 카운트
  books_count INTEGER DEFAULT 0,
  lectures_count INTEGER DEFAULT 0,

  -- 저장 결과 요약
  new_items_count INTEGER DEFAULT 0,
  updated_items_count INTEGER DEFAULT 0,
  skipped_items_count INTEGER DEFAULT 0,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_cold_start_logs_created_at ON cold_start_logs(created_at DESC);
CREATE INDEX idx_cold_start_logs_success ON cold_start_logs(success);

-- 코멘트
COMMENT ON TABLE cold_start_logs IS 'Cold Start 파이프라인 실행 로그';
COMMENT ON COLUMN cold_start_logs.input_params IS '입력 파라미터 (subjectCategory, subject, difficulty, contentType 등)';
COMMENT ON COLUMN cold_start_logs.output_result IS '실행 결과 요약 (저장 통계 등)';
COMMENT ON COLUMN cold_start_logs.duration_ms IS '실행 시간 (밀리초)';
