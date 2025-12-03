-- Migration: Create system_settings table for curriculum revision settings
-- 교육과정 계산 기준을 저장하는 시스템 설정 테이블 생성

-- 1. system_settings 테이블 생성
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE system_settings IS '시스템 전역 설정 테이블 (교육과정 계산 기준 등)';
COMMENT ON COLUMN system_settings.key IS '설정 키 (예: curriculum_revision_middle_2022)';
COMMENT ON COLUMN system_settings.value IS '설정 값 (JSON 형식)';
COMMENT ON COLUMN system_settings.description IS '설정 설명';

-- 2. updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 생성
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- 4. 초기 데이터 삽입
-- 중학교 2022개정: 2025년
INSERT INTO system_settings (key, value, description)
VALUES (
  'curriculum_revision_middle_2022',
  '{"start_year": 2025}'::jsonb,
  '중학교 2022개정 교육과정 시작년도'
)
ON CONFLICT (key) DO NOTHING;

-- 고등학교 2022개정: 2025년
INSERT INTO system_settings (key, value, description)
VALUES (
  'curriculum_revision_high_2022',
  '{"start_year": 2025}'::jsonb,
  '고등학교 2022개정 교육과정 시작년도'
)
ON CONFLICT (key) DO NOTHING;

-- 중학교 2015개정: 2018년
INSERT INTO system_settings (key, value, description)
VALUES (
  'curriculum_revision_middle_2015',
  '{"start_year": 2018}'::jsonb,
  '중학교 2015개정 교육과정 시작년도'
)
ON CONFLICT (key) DO NOTHING;

-- 고등학교 2015개정: 2018년
INSERT INTO system_settings (key, value, description)
VALUES (
  'curriculum_revision_high_2015',
  '{"start_year": 2018}'::jsonb,
  '고등학교 2015개정 교육과정 시작년도'
)
ON CONFLICT (key) DO NOTHING;

