-- ============================================
-- 기존 학생의 exam_year / curriculum_revision을 grade에서 자동 백필
--
-- 공식:
--   exam_year = EXTRACT(YEAR FROM NOW()) + (4 - grade)  (고등학교)
--   curriculum_revision: 고1 입학 연도(= 올해 - (grade - 1)) >= 2025 → '2022 개정', else '2015 개정'
--
-- 주의: grade가 NULL이거나 유효하지 않은 행은 건드리지 않음
-- grade 컬럼은 integer 타입, school_type은 'HIGH'/'MIDDLE'
-- ============================================

-- 고등학교 학생 백필 (school_type IS NULL 또는 HIGH)
UPDATE students
SET
  exam_year = EXTRACT(YEAR FROM NOW())::int + (4 - grade),
  curriculum_revision = CASE
    WHEN (EXTRACT(YEAR FROM NOW())::int - (grade - 1)) >= 2025 THEN '2022 개정'
    WHEN (EXTRACT(YEAR FROM NOW())::int - (grade - 1)) >= 2018 THEN '2015 개정'
    ELSE '2009 개정'
  END
WHERE grade IS NOT NULL
  AND grade BETWEEN 1 AND 3
  AND (school_type IS NULL OR school_type = 'HIGH');

-- 중학교 학생 백필
UPDATE students
SET
  exam_year = EXTRACT(YEAR FROM NOW())::int + (7 - grade),
  curriculum_revision = CASE
    WHEN (EXTRACT(YEAR FROM NOW())::int + (4 - grade)) >= 2025 THEN '2022 개정'
    WHEN (EXTRACT(YEAR FROM NOW())::int + (4 - grade)) >= 2018 THEN '2015 개정'
    ELSE '2009 개정'
  END
WHERE grade IS NOT NULL
  AND grade BETWEEN 1 AND 3
  AND school_type = 'MIDDLE';
