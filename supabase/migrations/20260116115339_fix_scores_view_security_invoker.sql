-- Fix scores view security: change from SECURITY DEFINER to SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced, not the view creator

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
    sms.exam_date,
    sms.exam_title,
    sms.standard_score,
    sms.percentile,
    sms.created_at,
    sms.updated_at,
    'mock'::text AS score_type
FROM student_mock_scores sms
LEFT JOIN subjects s ON s.id = sms.subject_id;
