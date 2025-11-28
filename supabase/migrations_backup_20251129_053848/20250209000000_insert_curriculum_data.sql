-- Migration: Insert curriculum data for 2015 and 2022 revisions
-- Description: 
--   1. 기존 데이터 삭제 (2015개정/2022개정의 국어/수학/영어/사회/과학 관련)
--   2. 개정교육과정 생성 (2015개정, 2022개정)
--   3. 과목구분 생성 (공통, 일반선택, 진로선택)
--   4. 교과 생성 (국어, 수학, 영어, 사회, 과학)
--   5. 과목 생성 (교과별)
-- Date: 2025-02-09

BEGIN;

-- ============================================
-- 1. 기존 데이터 삭제
-- ============================================

-- 1-1. 2015개정/2022개정의 모든 과목 삭제 (교과에 속한 모든 과목)
DELETE FROM subjects
WHERE subject_group_id IN (
  SELECT sg.id
  FROM subject_groups sg
  JOIN curriculum_revisions cr ON sg.curriculum_revision_id = cr.id
  WHERE (cr.name LIKE '%2015%' OR cr.year = 2015 OR cr.name LIKE '%2022%' OR cr.year = 2022)
);

-- 1-2. 2015개정/2022개정의 과목구분 삭제
DELETE FROM subject_types
WHERE curriculum_revision_id IN (
  SELECT id FROM curriculum_revisions
  WHERE (name LIKE '%2015%' OR year = 2015 OR name LIKE '%2022%' OR year = 2022)
);

-- 1-3. 2015개정/2022개정의 모든 subject_groups 삭제
-- curriculum_revisions 삭제 전에 모든 참조를 제거해야 외래키 제약조건 위반을 방지할 수 있습니다
DELETE FROM subject_groups
WHERE curriculum_revision_id IN (
  SELECT id FROM curriculum_revisions
  WHERE (name LIKE '%2015%' OR year = 2015 OR name LIKE '%2022%' OR year = 2022)
);

-- 1-4. 2015개정/2022개정 레코드 삭제 (나중에 재생성)
DELETE FROM curriculum_revisions
WHERE (name LIKE '%2015%' OR year = 2015 OR name LIKE '%2022%' OR year = 2022);

-- ============================================
-- 2. 개정교육과정 생성
-- ============================================

DO $$
DECLARE
  revision_2015_id uuid;
  revision_2022_id uuid;
  -- 2015개정 과목구분 ID
  type_common_2015_id uuid;
  type_elective_2015_id uuid;
  type_career_2015_id uuid;
  -- 2015개정 교과 ID
  group_korean_2015_id uuid;
  group_math_2015_id uuid;
  group_english_2015_id uuid;
  group_social_2015_id uuid;
  group_science_2015_id uuid;
  -- 2022개정 과목구분 ID
  type_common_2022_id uuid;
  type_elective_2022_id uuid;
  type_career_2022_id uuid;
  -- 2022개정 교과 ID
  group_korean_2022_id uuid;
  group_math_2022_id uuid;
  group_english_2022_id uuid;
  group_social_2022_id uuid;
  group_science_2022_id uuid;
BEGIN
  -- 2015개정 교육과정 생성 또는 조회
  SELECT id INTO revision_2015_id
  FROM curriculum_revisions
  WHERE name = '2015개정' OR year = 2015
  LIMIT 1;

  IF revision_2015_id IS NULL THEN
    INSERT INTO curriculum_revisions (id, name, year, is_active)
    VALUES (gen_random_uuid(), '2015개정', 2015, true)
    RETURNING id INTO revision_2015_id;
  ELSE
    -- 기존 레코드 업데이트
    UPDATE curriculum_revisions
    SET year = 2015, is_active = true
    WHERE id = revision_2015_id;
  END IF;

  -- ID 다시 조회 (확실하게)
  SELECT id INTO revision_2015_id
  FROM curriculum_revisions
  WHERE name = '2015개정' OR year = 2015
  LIMIT 1;

  -- 2022개정 교육과정 생성 또는 조회
  SELECT id INTO revision_2022_id
  FROM curriculum_revisions
  WHERE name = '2022개정' OR year = 2022
  LIMIT 1;

  IF revision_2022_id IS NULL THEN
    INSERT INTO curriculum_revisions (id, name, year, is_active)
    VALUES (gen_random_uuid(), '2022개정', 2022, true)
    RETURNING id INTO revision_2022_id;
  ELSE
    -- 기존 레코드 업데이트
    UPDATE curriculum_revisions
    SET year = 2022, is_active = true
    WHERE id = revision_2022_id;
  END IF;

  -- ID 다시 조회 (확실하게)
  SELECT id INTO revision_2022_id
  FROM curriculum_revisions
  WHERE name = '2022개정' OR year = 2022
  LIMIT 1;

  -- ============================================
  -- 3. 과목구분 생성 (개정교육과정별)
  -- ============================================

  -- 2015개정 과목구분
  IF revision_2015_id IS NOT NULL THEN
    -- 공통
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2015_id AND name = '공통') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2015_id, '공통', true);
    END IF;
    -- 일반선택
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2015_id AND name = '일반선택') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2015_id, '일반선택', true);
    END IF;
    -- 진로선택
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2015_id AND name = '진로선택') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2015_id, '진로선택', true);
    END IF;
  END IF;

  -- 2022개정 과목구분
  IF revision_2022_id IS NOT NULL THEN
    -- 공통
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2022_id AND name = '공통') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2022_id, '공통', true);
    END IF;
    -- 일반선택
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2022_id AND name = '일반선택') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2022_id, '일반선택', true);
    END IF;
    -- 진로선택
    IF NOT EXISTS (SELECT 1 FROM subject_types WHERE curriculum_revision_id = revision_2022_id AND name = '진로선택') THEN
      INSERT INTO subject_types (curriculum_revision_id, name, is_active)
      VALUES (revision_2022_id, '진로선택', true);
    END IF;
  END IF;

  -- ============================================
  -- 4. 교과 생성 (개정교육과정별)
  -- ============================================

  -- 2015개정 교과
  IF revision_2015_id IS NOT NULL THEN
    -- 국어
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2015_id AND name = '국어') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2015_id, '국어');
    END IF;
    -- 수학
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2015_id AND name = '수학') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2015_id, '수학');
    END IF;
    -- 영어
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2015_id AND name = '영어') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2015_id, '영어');
    END IF;
    -- 사회
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2015_id AND name = '사회') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2015_id, '사회');
    END IF;
    -- 과학
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2015_id AND name = '과학') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2015_id, '과학');
    END IF;
  END IF;

  -- 2022개정 교과
  IF revision_2022_id IS NOT NULL THEN
    -- 국어
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2022_id AND name = '국어') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2022_id, '국어');
    END IF;
    -- 수학
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2022_id AND name = '수학') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2022_id, '수학');
    END IF;
    -- 영어
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2022_id AND name = '영어') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2022_id, '영어');
    END IF;
    -- 사회
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2022_id AND name = '사회') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2022_id, '사회');
    END IF;
    -- 과학
    IF NOT EXISTS (SELECT 1 FROM subject_groups WHERE curriculum_revision_id = revision_2022_id AND name = '과학') THEN
      INSERT INTO subject_groups (id, curriculum_revision_id, name)
      VALUES (gen_random_uuid(), revision_2022_id, '과학');
    END IF;
  END IF;

  -- ============================================
  -- 5. 과목 생성 (2015개정 교육과정)
  -- ============================================

  IF revision_2015_id IS NOT NULL THEN
    -- 과목구분 ID 조회
      SELECT id INTO type_common_2015_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2015_id AND name = '공통'
      LIMIT 1;

      SELECT id INTO type_elective_2015_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2015_id AND name = '일반선택'
      LIMIT 1;

      SELECT id INTO type_career_2015_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2015_id AND name = '진로선택'
      LIMIT 1;

      -- 교과 ID 조회
      SELECT id INTO group_korean_2015_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2015_id AND name = '국어'
      LIMIT 1;

      SELECT id INTO group_math_2015_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2015_id AND name = '수학'
      LIMIT 1;

      SELECT id INTO group_english_2015_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2015_id AND name = '영어'
      LIMIT 1;

      SELECT id INTO group_social_2015_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2015_id AND name = '사회'
      LIMIT 1;

      SELECT id INTO group_science_2015_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2015_id AND name = '과학'
      LIMIT 1;

      -- 국어 과목
      IF group_korean_2015_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_korean_2015_id, '국어', type_common_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '화법과 작문', type_elective_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '독서', type_elective_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '언어와 매체', type_elective_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '문학', type_elective_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '실용국어', type_career_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '심화국어', type_career_2015_id),
          (gen_random_uuid(), group_korean_2015_id, '고전읽기', type_career_2015_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 수학 과목
      IF group_math_2015_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_math_2015_id, '수학', type_common_2015_id),
          (gen_random_uuid(), group_math_2015_id, '수학Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_math_2015_id, '수학Ⅱ', type_elective_2015_id),
          (gen_random_uuid(), group_math_2015_id, '미적분', type_elective_2015_id),
          (gen_random_uuid(), group_math_2015_id, '확률과 통계', type_elective_2015_id),
          (gen_random_uuid(), group_math_2015_id, '기본수학', type_career_2015_id),
          (gen_random_uuid(), group_math_2015_id, '실용수학', type_career_2015_id),
          (gen_random_uuid(), group_math_2015_id, '인공지능수학', type_career_2015_id),
          (gen_random_uuid(), group_math_2015_id, '기하', type_career_2015_id),
          (gen_random_uuid(), group_math_2015_id, '경제수학', type_career_2015_id),
          (gen_random_uuid(), group_math_2015_id, '수학과제탐구', type_career_2015_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 영어 과목
      IF group_english_2015_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_english_2015_id, '영어', type_common_2015_id),
          (gen_random_uuid(), group_english_2015_id, '영어Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_english_2015_id, '영어Ⅱ', type_elective_2015_id),
          (gen_random_uuid(), group_english_2015_id, '영어회화', type_elective_2015_id),
          (gen_random_uuid(), group_english_2015_id, '영어독해와 작문', type_elective_2015_id),
          (gen_random_uuid(), group_english_2015_id, '실용영어', type_career_2015_id),
          (gen_random_uuid(), group_english_2015_id, '영어권 문화', type_career_2015_id),
          (gen_random_uuid(), group_english_2015_id, '심화영어Ⅰ', type_career_2015_id),
          (gen_random_uuid(), group_english_2015_id, '심화영어Ⅱ', type_career_2015_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 사회 과목
      IF group_social_2015_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_social_2015_id, '통합사회', type_common_2015_id),
          (gen_random_uuid(), group_social_2015_id, '한국지리', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '세계지리', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '동아시아사', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '세계사', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '법과 정치', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '경제', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '사회·문화', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '생활과 윤리', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '윤리와 사상', type_elective_2015_id),
          (gen_random_uuid(), group_social_2015_id, '여행지리', type_career_2015_id),
          (gen_random_uuid(), group_social_2015_id, '사회문제 탐구', type_career_2015_id),
          (gen_random_uuid(), group_social_2015_id, '고전과 윤리', type_career_2015_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 과학 과목
      IF group_science_2015_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_science_2015_id, '통합과학', type_common_2015_id),
          (gen_random_uuid(), group_science_2015_id, '과학탐구실험', type_common_2015_id),
          (gen_random_uuid(), group_science_2015_id, '물리학Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_science_2015_id, '화학Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_science_2015_id, '생명과학Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_science_2015_id, '지구과학Ⅰ', type_elective_2015_id),
          (gen_random_uuid(), group_science_2015_id, '물리학Ⅱ', type_career_2015_id),
          (gen_random_uuid(), group_science_2015_id, '화학Ⅱ', type_career_2015_id),
          (gen_random_uuid(), group_science_2015_id, '생명과학Ⅱ', type_career_2015_id),
          (gen_random_uuid(), group_science_2015_id, '지구과학Ⅱ', type_career_2015_id),
          (gen_random_uuid(), group_science_2015_id, '과학사', type_career_2015_id),
          (gen_random_uuid(), group_science_2015_id, '생활과 과학', type_career_2015_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;
  END IF;

  -- ============================================
  -- 6. 과목 생성 (2022개정 교육과정)
  -- ============================================

  IF revision_2022_id IS NOT NULL THEN
    -- 과목구분 ID 조회
      SELECT id INTO type_common_2022_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2022_id AND name = '공통'
      LIMIT 1;

      SELECT id INTO type_elective_2022_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2022_id AND name = '일반선택'
      LIMIT 1;

      SELECT id INTO type_career_2022_id
      FROM subject_types
      WHERE curriculum_revision_id = revision_2022_id AND name = '진로선택'
      LIMIT 1;

      -- 교과 ID 조회
      SELECT id INTO group_korean_2022_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2022_id AND name = '국어'
      LIMIT 1;

      SELECT id INTO group_math_2022_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2022_id AND name = '수학'
      LIMIT 1;

      SELECT id INTO group_english_2022_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2022_id AND name = '영어'
      LIMIT 1;

      SELECT id INTO group_social_2022_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2022_id AND name = '사회'
      LIMIT 1;

      SELECT id INTO group_science_2022_id
      FROM subject_groups
      WHERE curriculum_revision_id = revision_2022_id AND name = '과학'
      LIMIT 1;

      -- 국어 과목
      IF group_korean_2022_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_korean_2022_id, '국어', type_common_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '화법과 작문', type_elective_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '독서', type_elective_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '언어와 매체', type_elective_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '문학', type_elective_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '실용국어', type_career_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '심화국어', type_career_2022_id),
          (gen_random_uuid(), group_korean_2022_id, '고전읽기', type_career_2022_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 수학 과목
      IF group_math_2022_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_math_2022_id, '수학', type_common_2022_id),
          (gen_random_uuid(), group_math_2022_id, '수학Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_math_2022_id, '수학Ⅱ', type_elective_2022_id),
          (gen_random_uuid(), group_math_2022_id, '미적분', type_elective_2022_id),
          (gen_random_uuid(), group_math_2022_id, '확률과 통계', type_elective_2022_id),
          (gen_random_uuid(), group_math_2022_id, '기본수학', type_career_2022_id),
          (gen_random_uuid(), group_math_2022_id, '실용수학', type_career_2022_id),
          (gen_random_uuid(), group_math_2022_id, '인공지능수학', type_career_2022_id),
          (gen_random_uuid(), group_math_2022_id, '기하', type_career_2022_id),
          (gen_random_uuid(), group_math_2022_id, '경제수학', type_career_2022_id),
          (gen_random_uuid(), group_math_2022_id, '수학과제탐구', type_career_2022_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 영어 과목
      IF group_english_2022_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_english_2022_id, '영어', type_common_2022_id),
          (gen_random_uuid(), group_english_2022_id, '영어Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_english_2022_id, '영어Ⅱ', type_elective_2022_id),
          (gen_random_uuid(), group_english_2022_id, '영어회화', type_elective_2022_id),
          (gen_random_uuid(), group_english_2022_id, '영어독해와 작문', type_elective_2022_id),
          (gen_random_uuid(), group_english_2022_id, '실용영어', type_career_2022_id),
          (gen_random_uuid(), group_english_2022_id, '영어권 문화', type_career_2022_id),
          (gen_random_uuid(), group_english_2022_id, '심화영어Ⅰ', type_career_2022_id),
          (gen_random_uuid(), group_english_2022_id, '심화영어Ⅱ', type_career_2022_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 사회 과목
      IF group_social_2022_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_social_2022_id, '통합사회', type_common_2022_id),
          (gen_random_uuid(), group_social_2022_id, '한국지리', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '세계지리', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '동아시아사', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '세계사', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '법과 정치', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '경제', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '사회·문화', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '생활과 윤리', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '윤리와 사상', type_elective_2022_id),
          (gen_random_uuid(), group_social_2022_id, '여행지리', type_career_2022_id),
          (gen_random_uuid(), group_social_2022_id, '사회문제 탐구', type_career_2022_id),
          (gen_random_uuid(), group_social_2022_id, '고전과 윤리', type_career_2022_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;

      -- 과학 과목
      IF group_science_2022_id IS NOT NULL THEN
        INSERT INTO subjects (id, subject_group_id, name, subject_type_id)
        VALUES
          (gen_random_uuid(), group_science_2022_id, '통합과학', type_common_2022_id),
          (gen_random_uuid(), group_science_2022_id, '과학탐구실험', type_common_2022_id),
          (gen_random_uuid(), group_science_2022_id, '물리학Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_science_2022_id, '화학Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_science_2022_id, '생명과학Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_science_2022_id, '지구과학Ⅰ', type_elective_2022_id),
          (gen_random_uuid(), group_science_2022_id, '물리학Ⅱ', type_career_2022_id),
          (gen_random_uuid(), group_science_2022_id, '화학Ⅱ', type_career_2022_id),
          (gen_random_uuid(), group_science_2022_id, '생명과학Ⅱ', type_career_2022_id),
          (gen_random_uuid(), group_science_2022_id, '지구과학Ⅱ', type_career_2022_id),
          (gen_random_uuid(), group_science_2022_id, '과학사', type_career_2022_id),
          (gen_random_uuid(), group_science_2022_id, '생활과 과학', type_career_2022_id)
        ON CONFLICT (subject_group_id, name) DO NOTHING;
      END IF;
  END IF;

END $$;

COMMIT;

