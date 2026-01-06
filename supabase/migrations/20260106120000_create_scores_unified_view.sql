-- ============================================
-- Create unified scores view for Python ML API
-- ============================================
-- This view combines student_internal_scores and student_mock_scores
-- to provide a unified interface for the Python ML API.
--
-- Problem: Python ML API queries a 'scores' table that doesn't exist
-- Error: PGRST205 - Could not find the table 'public.scores'
--
-- Solution: Create a view that unions both score tables
--
-- RLS Note: Views inherit RLS from underlying tables, so no additional
-- RLS policies are needed.

-- Drop existing view if it exists (for idempotency)
DROP VIEW IF EXISTS scores;

-- Create the unified scores view
CREATE OR REPLACE VIEW scores AS
-- Internal scores (내신 성적)
SELECT
    sis.id,
    sis.student_id,
    sis.tenant_id,
    s.name AS subject,
    sis.subject_id,
    sis.subject_group_id,
    COALESCE(sis.raw_score, 0) AS score,
    sis.grade,
    sis.semester,
    sis.rank_grade,
    sis.avg_score,
    sis.std_dev,
    sis.total_students,
    NULL::DATE AS exam_date,
    NULL::TEXT AS exam_title,
    NULL::NUMERIC AS standard_score,
    NULL::NUMERIC AS percentile,
    sis.created_at,
    sis.updated_at,
    'internal'::TEXT AS score_type
FROM student_internal_scores sis
LEFT JOIN subjects s ON s.id = sis.subject_id

UNION ALL

-- Mock scores (모의고사 성적)
SELECT
    sms.id,
    sms.student_id,
    sms.tenant_id,
    s.name AS subject,
    sms.subject_id,
    sms.subject_group_id,
    COALESCE(sms.raw_score, 0) AS score,
    sms.grade,
    NULL::INTEGER AS semester,
    sms.grade_score AS rank_grade,
    NULL::NUMERIC AS avg_score,
    NULL::NUMERIC AS std_dev,
    NULL::INTEGER AS total_students,
    sms.exam_date,
    sms.exam_title,
    sms.standard_score,
    sms.percentile,
    sms.created_at,
    sms.updated_at,
    'mock'::TEXT AS score_type
FROM student_mock_scores sms
LEFT JOIN subjects s ON s.id = sms.subject_id;

-- Add descriptive comment to the view
COMMENT ON VIEW scores IS
    'Unified view combining student_internal_scores and student_mock_scores. '
    'Provides a single interface for the Python ML API to query all student scores. '
    'Use score_type field to distinguish between ''internal'' and ''mock'' scores. '
    'Created: 2026-01-06. RLS inherited from underlying tables.';
