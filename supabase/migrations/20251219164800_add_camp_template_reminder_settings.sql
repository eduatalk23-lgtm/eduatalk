-- Migration: Add Camp Template Reminder Settings
-- Description: 캠프 템플릿에 리마인더 설정 필드 추가
-- Date: 2025-12-19

-- ============================================
-- camp_templates 테이블에 reminder_settings JSONB 필드 추가
-- ============================================
DO $$ 
BEGIN
  ALTER TABLE camp_templates ADD COLUMN reminder_settings jsonb;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- 기본값 설정 (선택사항 - 기존 레코드에는 null로 유지)
-- 새로 생성되는 템플릿에만 기본값 적용하려면 DEFAULT를 사용하지 않고
-- 애플리케이션 레벨에서 처리하는 것이 좋음

-- 인덱스 추가 (JSONB 필드 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_camp_templates_reminder_settings 
  ON camp_templates USING GIN (reminder_settings) 
  WHERE reminder_settings IS NOT NULL;

