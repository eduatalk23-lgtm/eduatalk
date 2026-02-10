-- ============================================================================
-- students 테이블 CRM 확장
--
-- 기존 students 테이블에 유입경로(lead_source)와 프로그램(program_id) 추가
-- CRM 파이프라인에서 전환된 학생의 맥락 정보 보존
-- ============================================================================

-- 1. lead_source 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS lead_source varchar(100);

-- 2. program_id 컬럼 추가 (programs FK)
ALTER TABLE students ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_students_lead_source
  ON students(lead_source)
  WHERE lead_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_program_id
  ON students(program_id)
  WHERE program_id IS NOT NULL;

-- ============================================================================
-- 컬럼 코멘트
-- ============================================================================

COMMENT ON COLUMN students.lead_source IS '유입경로 (homepage, landing_page, referral 등)';
COMMENT ON COLUMN students.program_id IS '등록 프로그램 (programs 테이블 FK)';
