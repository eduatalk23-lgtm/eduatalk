-- Migration: Migrate subject data to global
-- Description: 모든 tenant의 subject_groups와 subjects 데이터를 중복 제거하여 전역 데이터로 통합
-- Date: 2025-02-04

-- ============================================
-- 1. 기본 개정교육과정 확인 및 생성
-- ============================================

-- 2022개정 교육과정이 없으면 생성
DO $$
DECLARE
  default_revision_id uuid;
BEGIN
  -- 2022개정 교육과정 조회 또는 생성
  SELECT id INTO default_revision_id 
  FROM curriculum_revisions 
  WHERE name = '2022개정' 
  LIMIT 1;

  IF default_revision_id IS NULL THEN
    -- 2022개정 교육과정 생성
    INSERT INTO curriculum_revisions (id, name, display_order, is_active)
    VALUES (gen_random_uuid(), '2022개정', 1, true)
    RETURNING id INTO default_revision_id;
  END IF;

  -- 전역 변수로 저장 (다음 단계에서 사용)
  PERFORM set_config('app.default_revision_id', default_revision_id::text, false);
END $$;

-- ============================================
-- 2. subject_groups 데이터 마이그레이션
-- ============================================

-- 2-1. 기존 subject_groups의 curriculum_revision_id 업데이트
-- 모든 교과 그룹을 기본 개정교육과정(2022개정)에 연결
UPDATE subject_groups sg
SET curriculum_revision_id = (
  SELECT id FROM curriculum_revisions WHERE name = '2022개정' LIMIT 1
)
WHERE sg.curriculum_revision_id IS NULL;

-- 2-2. 중복 제거: 각 교과 그룹 이름별로 하나만 남기고 나머지 삭제
-- 먼저 subjects 테이블의 참조를 업데이트
DO $$
DECLARE
  default_revision_id uuid;
  group_record RECORD;
  keep_group_id uuid;
BEGIN
  -- 기본 개정교육과정 ID 가져오기
  SELECT id INTO default_revision_id 
  FROM curriculum_revisions 
  WHERE name = '2022개정' 
  LIMIT 1;

  -- 각 교과 그룹 이름별로 처리
  FOR group_record IN 
    SELECT DISTINCT name 
    FROM subject_groups 
    WHERE curriculum_revision_id = default_revision_id
  LOOP
    -- 각 이름별로 가장 오래된 그룹 ID 선택 (유지할 그룹)
    SELECT id INTO keep_group_id
    FROM subject_groups
    WHERE name = group_record.name
      AND curriculum_revision_id = default_revision_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- 나머지 그룹들의 subjects 참조를 keep_group_id로 업데이트
    UPDATE subjects
    SET subject_group_id = keep_group_id
    WHERE subject_group_id IN (
      SELECT id 
      FROM subject_groups 
      WHERE name = group_record.name
        AND curriculum_revision_id = default_revision_id
        AND id != keep_group_id
    );

    -- 중복된 그룹 삭제
    DELETE FROM subject_groups
    WHERE name = group_record.name
      AND curriculum_revision_id = default_revision_id
      AND id != keep_group_id;
  END LOOP;
END $$;

-- ============================================
-- 3. subjects 데이터 마이그레이션
-- ============================================

-- 3-1. 중복 제거: 각 교과 그룹별 과목 이름별로 하나만 남기고 나머지 삭제
DO $$
DECLARE
  subject_record RECORD;
  keep_subject_id uuid;
BEGIN
  -- 각 (subject_group_id, name) 조합별로 처리
  FOR subject_record IN 
    SELECT DISTINCT subject_group_id, name
    FROM subjects
  LOOP
    -- 각 조합별로 가장 오래된 과목 ID 선택 (유지할 과목)
    SELECT id INTO keep_subject_id
    FROM subjects
    WHERE subject_group_id = subject_record.subject_group_id
      AND name = subject_record.name
    ORDER BY created_at ASC
    LIMIT 1;

    -- 중복된 과목 삭제
    DELETE FROM subjects
    WHERE subject_group_id = subject_record.subject_group_id
      AND name = subject_record.name
      AND id != keep_subject_id;
  END LOOP;
END $$;

-- ============================================
-- 4. RLS 정책 수정 및 tenant_id 컬럼 제거
-- ============================================

-- 4-1. subject_groups 테이블의 tenant_id를 사용하는 RLS 정책 삭제
-- 전역 관리로 변경되므로 기존 tenant_id 기반 정책 제거
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Admins 정책들 삭제
  DROP POLICY IF EXISTS "Admins can view subject groups" ON subject_groups;
  DROP POLICY IF EXISTS "Admins can insert subject groups" ON subject_groups;
  DROP POLICY IF EXISTS "Admins can update subject groups" ON subject_groups;
  DROP POLICY IF EXISTS "Admins can delete subject groups" ON subject_groups;
  
  -- Students 정책 삭제
  DROP POLICY IF EXISTS "Students can view subject groups" ON subject_groups;
  
  -- 다른 tenant_id 기반 정책들도 삭제 (정책 이름이 다를 수 있음)
  -- pg_policies에서 tenant_id를 사용하는 모든 정책 찾아서 삭제
  -- qual (SELECT/UPDATE/DELETE 조건) 또는 with_check (INSERT/UPDATE 체크 조건)에서 tenant_id 검색
  FOR rec IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'subject_groups' 
      AND (
        qual::text LIKE '%tenant_id%' 
        OR with_check::text LIKE '%tenant_id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON subject_groups', rec.policyname);
  END LOOP;
END $$;

-- 4-2. subjects 테이블의 tenant_id를 사용하는 RLS 정책 삭제
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- pg_policies에서 tenant_id를 사용하는 모든 정책 찾아서 삭제
  -- qual (SELECT/UPDATE/DELETE 조건) 또는 with_check (INSERT/UPDATE 체크 조건)에서 tenant_id 검색
  FOR rec IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'subjects' 
      AND (
        qual::text LIKE '%tenant_id%' 
        OR with_check::text LIKE '%tenant_id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON subjects', rec.policyname);
  END LOOP;
END $$;

-- 4-3. subject_groups에서 tenant_id 제거
ALTER TABLE subject_groups DROP COLUMN IF EXISTS tenant_id;

-- 4-4. subjects에서 tenant_id 제거
ALTER TABLE subjects DROP COLUMN IF EXISTS tenant_id;

-- ============================================
-- 5. NOT NULL 제약조건 추가
-- ============================================

-- 5-1. subject_groups.curriculum_revision_id를 NOT NULL로 변경
ALTER TABLE subject_groups
ALTER COLUMN curriculum_revision_id SET NOT NULL;


