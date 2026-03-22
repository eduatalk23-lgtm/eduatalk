-- ============================================================
-- Phase C: 진로 분류 체계 통합 — desired_career_field 정규화
--
-- 기존 한글 계열명(10개) → KEDI 7대계열 코드(7개)로 정규화
-- target_sub_classification_id 컬럼 추가
-- ============================================================

BEGIN;

-- 1. desired_career_field 값 정규화: 한글 → KEDI 코드
UPDATE students SET desired_career_field = CASE
  WHEN desired_career_field = '인문계열' THEN 'HUM'
  WHEN desired_career_field = '사회계열' THEN 'SOC'
  WHEN desired_career_field = '교육계열' THEN 'EDU'
  WHEN desired_career_field = '공학계열' THEN 'ENG'
  WHEN desired_career_field = '자연계열' THEN 'NAT'
  WHEN desired_career_field = '의약계열' THEN 'MED'
  WHEN desired_career_field = '예체능계열' THEN 'ART'
  WHEN desired_career_field = '농업계열' THEN 'NAT'  -- 자연에 편입
  WHEN desired_career_field = '해양계열' THEN 'NAT'  -- 자연에 편입
  WHEN desired_career_field = '기타' THEN NULL
  ELSE desired_career_field
END
WHERE desired_career_field IS NOT NULL;

-- 2. target_sub_classification_id 컬럼 추가 (Tier 3 소분류)
ALTER TABLE students ADD COLUMN IF NOT EXISTS
  target_sub_classification_id int REFERENCES department_classification(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN students.desired_career_field IS 'KEDI 7대계열 코드 (HUM/SOC/EDU/ENG/NAT/MED/ART)';
COMMENT ON COLUMN students.target_major IS 'MAJOR_RECOMMENDED_COURSES 22개 키 (Tier 2 전공방향)';
COMMENT ON COLUMN students.target_sub_classification_id IS 'department_classification.id (Tier 3 소분류)';

COMMIT;
