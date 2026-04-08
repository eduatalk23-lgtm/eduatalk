-- ============================================
-- subjects.grade_excluded 플래그 추가
--
-- 석차등급이 기재되지 않는 과목을 명시적으로 표시.
-- 2022 개정 융합선택 과목이 대표적 사례.
-- subject_types의 selectionType으로도 판별 가능하나,
-- subject_type_id가 NULL인 경우를 대비해 과목 레벨에 직접 플래그 설정.
-- ============================================

-- 1. 컬럼 추가
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS grade_excluded BOOLEAN NOT NULL DEFAULT false;

-- 2. 융합선택 과목에 grade_excluded 설정
UPDATE subjects s
SET grade_excluded = true
FROM subject_types st
WHERE s.subject_type_id = st.id
  AND st.name LIKE '%융합%';

-- 3. 인덱스 (grade_excluded = true인 과목 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_subjects_grade_excluded
  ON subjects(grade_excluded) WHERE grade_excluded = true;
