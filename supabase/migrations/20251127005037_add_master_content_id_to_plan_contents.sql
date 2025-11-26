-- Migration: Add master_content_id to plan_contents
-- Description: plan_contents 테이블에 마스터 콘텐츠 ID 필드 추가
-- Date: 2025-11-27

-- ============================================
-- plan_contents 테이블에 master_content_id 필드 추가
-- ============================================

-- 1. master_content_id 필드 추가 (nullable)
-- 학생 콘텐츠가 마스터 콘텐츠와 연계되어 있는 경우 참조
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS master_content_id UUID;

-- 2. 코멘트 추가
COMMENT ON COLUMN plan_contents.master_content_id IS '마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우). book/lecture 타입일 때만 값이 있음.';

-- 3. 인덱스 추가 (마스터 콘텐츠 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_plan_contents_master_content_id 
ON plan_contents(master_content_id) 
WHERE master_content_id IS NOT NULL;

