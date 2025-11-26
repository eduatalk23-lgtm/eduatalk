-- Migration: Add Camp Period and Location Fields
-- Description: 캠프 템플릿에 캠프 기간(시작일, 종료일)과 캠프 장소 필드 추가
-- Date: 2025-11-26

-- ============================================
-- camp_templates 테이블에 캠프 기간 및 장소 컬럼 추가
-- ============================================

-- camp_start_date 컬럼 추가 (캠프 시작일)
DO $$ 
BEGIN
  ALTER TABLE camp_templates ADD COLUMN camp_start_date date;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- camp_end_date 컬럼 추가 (캠프 종료일)
DO $$ 
BEGIN
  ALTER TABLE camp_templates ADD COLUMN camp_end_date date;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- camp_location 컬럼 추가 (캠프 장소)
DO $$ 
BEGIN
  ALTER TABLE camp_templates ADD COLUMN camp_location varchar(200);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- 종료일이 시작일보다 이후인지 확인하는 체크 제약 추가
DO $$ 
BEGIN
  ALTER TABLE camp_templates 
  ADD CONSTRAINT check_camp_date_range 
  CHECK (camp_start_date IS NULL OR camp_end_date IS NULL OR camp_end_date >= camp_start_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 인덱스 생성 (기간 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_camp_templates_start_date ON camp_templates(camp_start_date);
CREATE INDEX IF NOT EXISTS idx_camp_templates_end_date ON camp_templates(camp_end_date);





