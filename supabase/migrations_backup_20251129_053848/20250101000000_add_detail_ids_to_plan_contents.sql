-- Migration: Add start_detail_id and end_detail_id to plan_contents
-- Description: plan_contents 테이블에 상세 정보 ID 필드 추가 (book_details, lecture_episodes 참조)
-- Date: 2025-01-01

-- ============================================
-- plan_contents 테이블에 상세 정보 ID 필드 추가
-- ============================================

-- 1. start_detail_id 필드 추가 (nullable)
-- book의 경우 book_details.id 참조, lecture의 경우 lecture_episodes.id 참조
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS start_detail_id UUID;

-- 2. end_detail_id 필드 추가 (nullable)
-- book의 경우 book_details.id 참조, lecture의 경우 lecture_episodes.id 참조
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS end_detail_id UUID;

-- 3. 코멘트 추가
COMMENT ON COLUMN plan_contents.start_detail_id IS '시작 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id). 상세 정보가 있는 콘텐츠에서만 값이 있음.';
COMMENT ON COLUMN plan_contents.end_detail_id IS '종료 범위 상세 정보 ID (book_details.id 또는 lecture_episodes.id). 상세 정보가 있는 콘텐츠에서만 값이 있음.';

-- 4. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_plan_contents_start_detail_id 
ON plan_contents(start_detail_id) 
WHERE start_detail_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plan_contents_end_detail_id 
ON plan_contents(end_detail_id) 
WHERE end_detail_id IS NOT NULL;

