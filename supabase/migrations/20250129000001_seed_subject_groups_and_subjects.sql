-- Migration: Seed default subject groups and subjects
-- Description: 기본 교과 그룹 및 과목 데이터 시드
-- Date: 2025-01-29

-- ============================================
-- 기본 교과 그룹 및 과목 데이터 시드
-- ============================================

-- 함수: 기본 교과/과목 데이터 생성
CREATE OR REPLACE FUNCTION seed_subject_data(tenant_uuid uuid)
RETURNS void AS $$
DECLARE
  국어_id uuid;
  수학_id uuid;
  영어_id uuid;
  한국사_id uuid;
  과학_id uuid;
BEGIN
  -- 교과 그룹 생성 (개별적으로 INSERT하여 ID 확보)
  INSERT INTO subject_groups (tenant_id, name, display_order)
  VALUES (tenant_uuid, '국어', 1)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 국어_id;

  INSERT INTO subject_groups (tenant_id, name, display_order)
  VALUES (tenant_uuid, '수학', 2)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 수학_id;

  INSERT INTO subject_groups (tenant_id, name, display_order)
  VALUES (tenant_uuid, '영어', 3)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 영어_id;

  INSERT INTO subject_groups (tenant_id, name, display_order)
  VALUES (tenant_uuid, '한국사', 4)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 한국사_id;

  INSERT INTO subject_groups (tenant_id, name, display_order)
  VALUES (tenant_uuid, '과학', 5)
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 과학_id;

  -- ID 다시 조회 (ON CONFLICT로 인해 생성되지 않았을 수 있음)
  SELECT id INTO 국어_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '국어' LIMIT 1;
  SELECT id INTO 수학_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '수학' LIMIT 1;
  SELECT id INTO 영어_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '영어' LIMIT 1;
  SELECT id INTO 한국사_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '한국사' LIMIT 1;
  SELECT id INTO 과학_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '과학' LIMIT 1;

  -- 국어 과목
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order)
  VALUES
    (tenant_uuid, 국어_id, '국어', 1),
    (tenant_uuid, 국어_id, '문학', 2),
    (tenant_uuid, 국어_id, '독서', 3),
    (tenant_uuid, 국어_id, '화법과 작문', 4),
    (tenant_uuid, 국어_id, '언어와 매체', 5)
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;

  -- 수학 과목
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order)
  VALUES
    (tenant_uuid, 수학_id, '수학', 1),
    (tenant_uuid, 수학_id, '수학Ⅰ', 2),
    (tenant_uuid, 수학_id, '수학Ⅱ', 3),
    (tenant_uuid, 수학_id, '확률과 통계', 4),
    (tenant_uuid, 수학_id, '미적분', 5),
    (tenant_uuid, 수학_id, '기하', 6)
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;

  -- 영어 과목
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order)
  VALUES
    (tenant_uuid, 영어_id, '영어', 1),
    (tenant_uuid, 영어_id, '영어Ⅰ', 2),
    (tenant_uuid, 영어_id, '영어Ⅱ', 3),
    (tenant_uuid, 영어_id, '영어 독해와 작문', 4),
    (tenant_uuid, 영어_id, '영어권 문화', 5)
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;

  -- 한국사 과목 (역사/도덕 포함)
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order)
  VALUES
    (tenant_uuid, 한국사_id, '한국사', 1),
    (tenant_uuid, 한국사_id, '동아시아사', 2),
    (tenant_uuid, 한국사_id, '세계사', 3),
    (tenant_uuid, 한국사_id, '도덕', 4),
    (tenant_uuid, 한국사_id, '생활과 윤리', 5),
    (tenant_uuid, 한국사_id, '윤리와 사상', 6)
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;

  -- 과학 과목
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order)
  VALUES
    (tenant_uuid, 과학_id, '물리학', 1),
    (tenant_uuid, 과학_id, '물리학Ⅰ', 2),
    (tenant_uuid, 과학_id, '물리학Ⅱ', 3),
    (tenant_uuid, 과학_id, '화학', 4),
    (tenant_uuid, 과학_id, '화학Ⅰ', 5),
    (tenant_uuid, 과학_id, '화학Ⅱ', 6),
    (tenant_uuid, 과학_id, '생명과학', 7),
    (tenant_uuid, 과학_id, '생명과학Ⅰ', 8),
    (tenant_uuid, 과학_id, '생명과학Ⅱ', 9),
    (tenant_uuid, 과학_id, '지구과학', 10),
    (tenant_uuid, 과학_id, '지구과학Ⅰ', 11),
    (tenant_uuid, 과학_id, '지구과학Ⅱ', 12)
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 모든 tenant에 대해 기본 데이터 생성
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id FROM tenants
  LOOP
    PERFORM seed_subject_data(tenant_record.id);
  END LOOP;
END $$;

-- 함수 정리 (시드 후 제거)
-- DROP FUNCTION IF EXISTS seed_subject_data(uuid);

-- 코멘트
COMMENT ON FUNCTION seed_subject_data(uuid) IS '특정 tenant에 대한 기본 교과/과목 데이터 생성 함수';

