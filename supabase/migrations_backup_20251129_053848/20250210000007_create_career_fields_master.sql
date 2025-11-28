-- Migration: Create career_fields master table
-- Description: 진로 계열 마스터 테이블 생성 (관리자 CRUD용)
-- Date: 2025-02-10

-- ============================================
-- 1. career_fields 마스터 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS career_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE career_fields IS '진로 계열 마스터 테이블 (관리자 CRUD용)';
COMMENT ON COLUMN career_fields.name IS '진로 계열명 (인문계열, 사회계열 등)';
COMMENT ON COLUMN career_fields.display_order IS '표시 순서';
COMMENT ON COLUMN career_fields.is_active IS '활성화 여부';

-- ============================================
-- 2. 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_career_fields_display_order ON career_fields(display_order);
CREATE INDEX IF NOT EXISTS idx_career_fields_is_active ON career_fields(is_active);

-- ============================================
-- 3. 기존 CHECK 제약조건 값들을 마스터 테이블에 삽입
-- ============================================

INSERT INTO career_fields (name, display_order, is_active) VALUES
  ('인문계열', 1, true),
  ('사회계열', 2, true),
  ('자연계열', 3, true),
  ('공학계열', 4, true),
  ('의약계열', 5, true),
  ('예체능계열', 6, true),
  ('교육계열', 7, true),
  ('농업계열', 8, true),
  ('해양계열', 9, true),
  ('기타', 10, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. student_career_goals 테이블에 desired_career_field 컬럼 추가 (없는 경우)
-- ============================================

-- 컬럼이 이미 존재하는지 확인하고 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'student_career_goals' 
    AND column_name = 'desired_career_field'
  ) THEN
    ALTER TABLE student_career_goals 
    ADD COLUMN desired_career_field text CHECK (desired_career_field IN (
      '인문계열', '사회계열', '자연계열', '공학계열', '의약계열',
      '예체능계열', '교육계열', '농업계열', '해양계열', '기타'
    ));
    
    COMMENT ON COLUMN student_career_goals.desired_career_field IS '희망 진로 계열 (단일 선택)';
  END IF;
END $$;









