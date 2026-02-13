-- student_internal_scores에 성취도/석차/성취도비율 컬럼 추가
ALTER TABLE student_internal_scores
  ADD COLUMN IF NOT EXISTS achievement_level varchar(1) NULL CHECK (achievement_level IN ('A','B','C','D','E')),
  ADD COLUMN IF NOT EXISTS achievement_ratio_a numeric NULL,
  ADD COLUMN IF NOT EXISTS achievement_ratio_b numeric NULL,
  ADD COLUMN IF NOT EXISTS achievement_ratio_c numeric NULL,
  ADD COLUMN IF NOT EXISTS achievement_ratio_d numeric NULL,
  ADD COLUMN IF NOT EXISTS achievement_ratio_e numeric NULL,
  ADD COLUMN IF NOT EXISTS class_rank integer NULL;

-- subject_types에 성취평가제 플래그 추가
ALTER TABLE subject_types
  ADD COLUMN IF NOT EXISTS is_achievement_only boolean NOT NULL DEFAULT false;

-- 기존 성취평가제 과목 타입 업데이트 (이름 기반)
UPDATE subject_types SET is_achievement_only = true
  WHERE name IN ('과학탐구실험');

-- scores 뷰 재생성 (achievement_level, class_rank 추가)
DROP VIEW IF EXISTS public.scores;

CREATE VIEW public.scores
WITH (security_invoker = true)
AS
SELECT sis.id,
    sis.student_id,
    sis.tenant_id,
    s.name AS subject,
    sis.subject_id,
    sis.subject_group_id,
    COALESCE(sis.raw_score, 0::numeric) AS score,
    sis.grade,
    sis.semester,
    sis.rank_grade,
    sis.avg_score,
    sis.std_dev,
    sis.total_students,
    sis.achievement_level,
    sis.class_rank,
    NULL::date AS exam_date,
    NULL::text AS exam_title,
    NULL::numeric AS standard_score,
    NULL::numeric AS percentile,
    sis.created_at,
    sis.updated_at,
    'internal'::text AS score_type
FROM student_internal_scores sis
LEFT JOIN subjects s ON s.id = sis.subject_id
UNION ALL
SELECT sms.id,
    sms.student_id,
    sms.tenant_id,
    s.name AS subject,
    sms.subject_id,
    sms.subject_group_id,
    COALESCE(sms.raw_score, 0::numeric) AS score,
    sms.grade,
    NULL::integer AS semester,
    sms.grade_score AS rank_grade,
    NULL::numeric AS avg_score,
    NULL::numeric AS std_dev,
    NULL::integer AS total_students,
    NULL::varchar(1) AS achievement_level,
    NULL::integer AS class_rank,
    sms.exam_date,
    sms.exam_title,
    sms.standard_score,
    sms.percentile,
    sms.created_at,
    sms.updated_at,
    'mock'::text AS score_type
FROM student_mock_scores sms
LEFT JOIN subjects s ON s.id = sms.subject_id;
