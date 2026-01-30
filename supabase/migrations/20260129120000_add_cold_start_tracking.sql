-- Cold Start 업데이트 추적 컬럼 추가
-- Phase 2: Freshness 관리

-- master_books 테이블에 추적 컬럼 추가
ALTER TABLE master_books
ADD COLUMN IF NOT EXISTS cold_start_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS cold_start_update_count integer DEFAULT 0;

-- master_lectures 테이블에 추적 컬럼 추가
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS cold_start_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS cold_start_update_count integer DEFAULT 0;

-- 인덱스 추가 (최근 업데이트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_master_books_cold_start_updated_at
ON master_books(cold_start_updated_at DESC NULLS LAST)
WHERE cold_start_updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_lectures_cold_start_updated_at
ON master_lectures(cold_start_updated_at DESC NULLS LAST)
WHERE cold_start_updated_at IS NOT NULL;

-- 컬럼 코멘트
COMMENT ON COLUMN master_books.cold_start_updated_at IS '마지막 콜드스타트 업데이트 시간';
COMMENT ON COLUMN master_books.cold_start_update_count IS '콜드스타트로 인한 총 업데이트 횟수';
COMMENT ON COLUMN master_lectures.cold_start_updated_at IS '마지막 콜드스타트 업데이트 시간';
COMMENT ON COLUMN master_lectures.cold_start_update_count IS '콜드스타트로 인한 총 업데이트 횟수';
