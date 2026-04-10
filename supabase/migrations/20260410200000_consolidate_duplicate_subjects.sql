-- ============================================================
-- Phase 2 Wave 5.1e — 중복 subject 13개 정합화
--
-- 배경: 2022 개정 교육과정 편입 시 subjects 테이블에 같은 이름의 row 가
--   두 개씩 생겨 있었음 (진로선택 vs 융합선택/일반선택). 이로 인해
--   course_recommendation 의 이름 매칭이 비결정적으로 다른 subject_id 를
--   고르고 slot_generation 이 만든 seteks 와 course_plans 의 subject_id 가
--   불일치, 탐구 가이드 매칭과 UI 중복 row 가 발생.
--
-- 전략:
--   canonical = exploration_guide_subject_mappings 참조 건수가 많은 쪽
--   deprecated = 참조 건수가 적거나 0인 쪽
--   → deprecated 쪽의 학생 데이터 FK 를 canonical 로 일괄 이전
--   → deprecated row 삭제
--
-- 영향을 받는 subject 이름 13개:
--   경제, 경제 수학, 기하, 문학, 사회문제 탐구, 세계사, 수학과제 탐구,
--   여행지리, 영미 문학 읽기, 영어 독해와 작문, 윤리와 사상, 인공지능 수학,
--   확률과 통계
--
-- 학생 데이터 충돌(FK 이전 필요) — 5건:
--   - 기하: acd5c19d... → e1230ba1...
--   - 문학: c9c4ebd9... → 3bc9e79d...
--   - 수학과제 탐구: 315cccbe... → dead8637...
--   - 확률과 통계: 1ebfa023... → 1cb4183b...
--   - 경제 수학: b435f7d8... → a0f0c3d9... (guide_mappings 만)
--
-- FK 참조 테이블 (20개):
--   student_record_seteks, student_record_setek_guides, student_record_strategies,
--   student_course_plans, student_internal_scores, student_mock_scores,
--   student_record_subject_pairs (subject_id_1, subject_id_2),
--   exploration_guide_subject_mappings, exploration_guide_assignments.target_subject_id,
--   exemplar_grades, exemplar_seteks, books, content_concepts, lectures,
--   master_books, master_lectures, master_custom_contents, flexible_contents,
--   school_offered_subjects
-- ============================================================

BEGIN;

-- (canonical_id, deprecated_id) pairs
CREATE TEMP TABLE subject_merge_map (
  canonical_id uuid NOT NULL,
  deprecated_id uuid NOT NULL,
  subject_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO subject_merge_map (canonical_id, deprecated_id, subject_name) VALUES
  ('705da5e1-8368-494f-aec3-e4a3189d8e58', '09bc9d80-c448-44d4-a6a9-1a85a5a1d209', '경제'),
  ('a0f0c3d9-44a0-44a0-8c15-9e18120ed0f4', 'b435f7d8-172c-4e1d-be64-1269aaee66a2', '경제 수학'),
  ('e1230ba1-0b02-454e-a591-5aae9fa6157f', 'acd5c19d-c855-409a-a4a7-27a0f7f82e50', '기하'),
  ('3bc9e79d-8533-4048-89e0-ea10cf958207', 'c9c4ebd9-c459-47d3-9b76-59dc2b1220e2', '문학'),
  ('75be61a2-ee70-4933-b70b-50c617fd7781', 'ee619625-332e-43e8-ad0d-6972e2546843', '사회문제 탐구'),
  ('9d241735-00c7-444d-8d7d-6d8a8101b00a', '22abc7c7-3a2c-498b-aba5-c8a3be341a4f', '세계사'),
  ('dead8637-de9c-4a24-b56b-47026f70e9f0', '315cccbe-61f6-4862-8eee-afeee28df34d', '수학과제 탐구'),
  ('cb5d50e7-ba0b-4018-875f-795d707fa82f', '50c9d955-d04e-4d8c-aa66-72739eca6fbc', '여행지리'),
  ('437d6db8-b331-408a-8541-f2caa343e2ee', 'f7202bce-6740-4fe6-87c9-b0ab0afbacfe', '영미 문학 읽기'),
  ('626e40d9-1c60-46e9-8b92-6c20621e39cc', 'f2f45b4b-936f-43ae-b3b1-5a8806e729c7', '영어 독해와 작문'),
  ('a7277cc2-2aa8-48da-b0ec-b5210e838428', '3738c37c-d423-4a1f-9e90-06eeb3a2f6be', '윤리와 사상'),
  ('5a1f2386-9dcd-4002-84e5-e4897b6c0fc6', '2e299d71-2dfb-4b75-8ce4-d6dea08383c5', '인공지능 수학'),
  ('1cb4183b-f35d-42fb-af1e-25ae552ff7bb', '1ebfa023-9822-4bc5-bebb-dd888c39a063', '확률과 통계');

-- ============================================================
-- 1. 학생 데이터 FK 이전 — ON CONFLICT DO NOTHING 으로 canonical 에 이미
--    같은 키가 존재하면 deprecated row 만 삭제 (중복 방지).
-- ============================================================

-- student_record_seteks — unique(tenant,student,year,grade,semester,subject_id)
UPDATE student_record_seteks sr
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE sr.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM student_record_seteks sr2
    WHERE sr2.tenant_id = sr.tenant_id
      AND sr2.student_id = sr.student_id
      AND sr2.school_year = sr.school_year
      AND sr2.grade = sr.grade
      AND sr2.semester = sr.semester
      AND sr2.subject_id = m.canonical_id
      AND sr2.id <> sr.id
  );
-- 충돌로 남은(=canonical 쪽에 동일 키 + 동일 imported_content 로 이미 있는)
-- deprecated row 는 hard-delete. polymorphic FK(activity_tags 등)는
-- cleanup_polymorphic_refs 트리거가 자동 정리.
DELETE FROM student_record_seteks
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- student_record_setek_guides
UPDATE student_record_setek_guides sg
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE sg.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM student_record_setek_guides sg2
    WHERE sg2.student_id = sg.student_id
      AND sg2.subject_id = m.canonical_id
      AND sg2.school_year = sg.school_year
      AND sg2.guide_mode = sg.guide_mode
      AND sg2.source = sg.source
      AND sg2.id <> sg.id
  );
DELETE FROM student_record_setek_guides
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- student_record_strategies
UPDATE student_record_strategies st
SET target_subject_id = m.canonical_id
FROM subject_merge_map m
WHERE st.target_subject_id = m.deprecated_id;

-- student_course_plans — unique(tenant,student,grade,semester,subject_id)
UPDATE student_course_plans cp
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE cp.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM student_course_plans cp2
    WHERE cp2.tenant_id = cp.tenant_id
      AND cp2.student_id = cp.student_id
      AND cp2.grade = cp.grade
      AND cp2.semester = cp.semester
      AND cp2.subject_id = m.canonical_id
      AND cp2.id <> cp.id
  );
DELETE FROM student_course_plans
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- student_internal_scores
UPDATE student_internal_scores ss
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE ss.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM student_internal_scores ss2
    WHERE ss2.student_id = ss.student_id
      AND ss2.subject_id = m.canonical_id
      AND ss2.grade = ss.grade
      AND ss2.semester = ss.semester
      AND ss2.id <> ss.id
  );
DELETE FROM student_internal_scores
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- student_mock_scores
UPDATE student_mock_scores ms
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE ms.subject_id = m.deprecated_id;
DELETE FROM student_mock_scores
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- student_record_subject_pairs (subject_id_1 + subject_id_2 두 컬럼)
UPDATE student_record_subject_pairs sp
SET subject_id_1 = m.canonical_id
FROM subject_merge_map m
WHERE sp.subject_id_1 = m.deprecated_id;
UPDATE student_record_subject_pairs sp
SET subject_id_2 = m.canonical_id
FROM subject_merge_map m
WHERE sp.subject_id_2 = m.deprecated_id;

-- exploration_guide_subject_mappings — 같은 (guide_id, canonical_id) 가 이미 있으면
--   deprecated row 삭제, 없으면 canonical 로 이전
UPDATE exploration_guide_subject_mappings gm
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE gm.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM exploration_guide_subject_mappings gm2
    WHERE gm2.guide_id = gm.guide_id
      AND gm2.subject_id = m.canonical_id
  );
DELETE FROM exploration_guide_subject_mappings
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- exploration_guide_assignments.target_subject_id
UPDATE exploration_guide_assignments a
SET target_subject_id = m.canonical_id
FROM subject_merge_map m
WHERE a.target_subject_id = m.deprecated_id;

-- exemplar_* (matched_subject_id)
UPDATE exemplar_grades SET matched_subject_id = m.canonical_id
FROM subject_merge_map m WHERE exemplar_grades.matched_subject_id = m.deprecated_id;
UPDATE exemplar_seteks SET matched_subject_id = m.canonical_id
FROM subject_merge_map m WHERE exemplar_seteks.matched_subject_id = m.deprecated_id;

-- 참조 테이블 (books/lectures/content_concepts/master_* / flexible_contents / school_offered_subjects)
UPDATE books SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE books.subject_id = m.deprecated_id;
UPDATE content_concepts SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE content_concepts.subject_id = m.deprecated_id;
UPDATE lectures SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE lectures.subject_id = m.deprecated_id;
UPDATE master_books SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE master_books.subject_id = m.deprecated_id;
UPDATE master_lectures SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE master_lectures.subject_id = m.deprecated_id;
UPDATE master_custom_contents SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE master_custom_contents.subject_id = m.deprecated_id;
UPDATE flexible_contents SET subject_id = m.canonical_id
FROM subject_merge_map m WHERE flexible_contents.subject_id = m.deprecated_id;

-- school_offered_subjects — unique(school_profile_id, subject_id)
UPDATE school_offered_subjects sos
SET subject_id = m.canonical_id
FROM subject_merge_map m
WHERE sos.subject_id = m.deprecated_id
  AND NOT EXISTS (
    SELECT 1 FROM school_offered_subjects sos2
    WHERE sos2.school_profile_id = sos.school_profile_id
      AND sos2.subject_id = m.canonical_id
  );
DELETE FROM school_offered_subjects
WHERE subject_id IN (SELECT deprecated_id FROM subject_merge_map);

-- ============================================================
-- 2. deprecated subject row 삭제 (마지막)
-- ============================================================

DELETE FROM subjects
WHERE id IN (SELECT deprecated_id FROM subject_merge_map);

-- ============================================================
-- 3. 검증 — 여전히 중복 이름이 남아있는지 체크
-- ============================================================

DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT name FROM subjects
    WHERE name IN (
      '경제', '경제 수학', '기하', '문학', '사회문제 탐구', '세계사',
      '수학과제 탐구', '여행지리', '영미 문학 읽기', '영어 독해와 작문',
      '윤리와 사상', '인공지능 수학', '확률과 통계'
    )
    GROUP BY name
    HAVING COUNT(*) > 1
  ) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'subject 중복이 여전히 % 건 남아있음 — 마이그레이션 중단', dup_count;
  END IF;
END $$;

COMMIT;
