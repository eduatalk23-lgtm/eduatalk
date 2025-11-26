-- Migration: Initial Schema
-- Description: 초기 데이터베이스 스키마 마이그레이션
-- Date: 2025-01-31
-- 
-- 주의: 이 파일은 마이그레이션 새로 시작을 위해 생성되었습니다.
-- 기존 마이그레이션 히스토리를 리셋한 후 이 파일부터 시작합니다.

-- ============================================
-- 1. 사회 교과 그룹 추가
-- ============================================
CREATE OR REPLACE FUNCTION add_social_subject_group(tenant_uuid uuid)
RETURNS void AS $$
DECLARE
  사회_id uuid;
BEGIN
  -- 사회 교과 그룹 생성
  INSERT INTO subject_groups (tenant_id, name, display_order, default_subject_type)
  VALUES (tenant_uuid, '사회', 6, '공통')
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 사회_id;

  -- ID 다시 조회
  SELECT id INTO 사회_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '사회' LIMIT 1;

  -- 사회 과목 추가 (2022 개정 교육과정 기준)
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order, subject_type)
  VALUES
    (tenant_uuid, 사회_id, '통합사회', 1, '공통'),
    (tenant_uuid, 사회_id, '한국지리', 2, '일반선택'),
    (tenant_uuid, 사회_id, '세계지리', 3, '일반선택'),
    (tenant_uuid, 사회_id, '경제', 4, '일반선택'),
    (tenant_uuid, 사회_id, '정치와 법', 5, '일반선택'),
    (tenant_uuid, 사회_id, '사회·문화', 6, '일반선택')
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. 탐구(사탐) 교과 그룹 추가
-- ============================================
CREATE OR REPLACE FUNCTION add_research_social_subject_group(tenant_uuid uuid)
RETURNS void AS $$
DECLARE
  탐구사탐_id uuid;
BEGIN
  -- 탐구(사탐) 교과 그룹 생성
  INSERT INTO subject_groups (tenant_id, name, display_order, default_subject_type)
  VALUES (tenant_uuid, '탐구-사탐', 7, '일반선택')
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 탐구사탐_id;

  -- ID 다시 조회
  SELECT id INTO 탐구사탐_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '탐구-사탐' LIMIT 1;

  -- 탐구(사탐) 과목 추가 (2022 개정 교육과정 기준)
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order, subject_type)
  VALUES
    (tenant_uuid, 탐구사탐_id, '한국지리', 1, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '세계지리', 2, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '동아시아사', 3, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '세계사', 4, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '경제', 5, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '정치와 법', 6, '일반선택'),
    (tenant_uuid, 탐구사탐_id, '사회·문화', 7, '일반선택')
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. 탐구(과탐) 교과 그룹 추가
-- ============================================
CREATE OR REPLACE FUNCTION add_research_science_subject_group(tenant_uuid uuid)
RETURNS void AS $$
DECLARE
  탐구과탐_id uuid;
  과학_id uuid;
BEGIN
  -- 탐구(과탐) 교과 그룹 생성
  INSERT INTO subject_groups (tenant_id, name, display_order, default_subject_type)
  VALUES (tenant_uuid, '탐구-과탐', 8, '일반선택')
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO 탐구과탐_id;

  -- ID 다시 조회
  SELECT id INTO 탐구과탐_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '탐구-과탐' LIMIT 1;
  SELECT id INTO 과학_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '과학' LIMIT 1;

  -- 탐구(과탐) 과목 추가 (2022 개정 교육과정 기준 - 과학 교과 그룹의 과목들을 참고)
  INSERT INTO subjects (tenant_id, subject_group_id, name, display_order, subject_type)
  VALUES
    (tenant_uuid, 탐구과탐_id, '물리학Ⅰ', 1, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '물리학Ⅱ', 2, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '화학Ⅰ', 3, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '화학Ⅱ', 4, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '생명과학Ⅰ', 5, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '생명과학Ⅱ', 6, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '지구과학Ⅰ', 7, '일반선택'),
    (tenant_uuid, 탐구과탐_id, '지구과학Ⅱ', 8, '일반선택')
  ON CONFLICT (tenant_id, subject_group_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. 한국사 교과 그룹 정리 (윤리 과목 제거)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_korean_history_subjects(tenant_uuid uuid)
RETURNS void AS $$
DECLARE
  한국사_id uuid;
BEGIN
  -- 한국사 교과 그룹 ID 조회
  SELECT id INTO 한국사_id FROM subject_groups WHERE tenant_id = tenant_uuid AND name = '한국사' LIMIT 1;

  IF 한국사_id IS NOT NULL THEN
    -- 윤리 관련 과목 삭제 (도덕, 생활과 윤리, 윤리와 사상)
    DELETE FROM subjects 
    WHERE tenant_id = tenant_uuid 
      AND subject_group_id = 한국사_id 
      AND name IN ('도덕', '생활과 윤리', '윤리와 사상');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 모든 tenant에 대해 실행
-- ============================================
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id FROM tenants
  LOOP
    PERFORM add_social_subject_group(tenant_record.id);
    PERFORM add_research_social_subject_group(tenant_record.id);
    PERFORM add_research_science_subject_group(tenant_record.id);
    PERFORM cleanup_korean_history_subjects(tenant_record.id);
  END LOOP;
END $$;

-- ============================================
-- 6. 함수 정리
-- ============================================
-- 함수는 실행 후 자동으로 정리되므로 DROP 불필요
-- (함수는 세션 종료 시 자동으로 정리됨)

