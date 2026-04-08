-- ============================================
-- student_mock_scores에 curriculum_revision_id 추가
--
-- 문제: 모의고사 성적 테이블에 교육과정 정보가 직접 저장되지 않아
-- student_term_id(nullable)를 통한 간접 참조만 가능했음.
-- student_term_id가 NULL인 레코드는 교육과정 추적 불가.
--
-- 해결: curriculum_revision_id 컬럼을 직접 추가하고 기존 데이터를 백필.
-- ============================================

-- 1. 컬럼 추가 (nullable로 시작 — 백필 완료 후 NOT NULL 검토)
ALTER TABLE student_mock_scores
  ADD COLUMN IF NOT EXISTS curriculum_revision_id UUID
  REFERENCES curriculum_revisions(id);

-- 2. 기존 데이터 백필: student_terms 경유
UPDATE student_mock_scores ms
SET curriculum_revision_id = st.curriculum_revision_id
FROM student_terms st
WHERE ms.student_term_id = st.id
  AND ms.curriculum_revision_id IS NULL
  AND st.curriculum_revision_id IS NOT NULL;

-- 3. student_term 없는 레코드: 학생의 현재 교육과정으로 백필
UPDATE student_mock_scores ms
SET curriculum_revision_id = cr.id
FROM students s
JOIN curriculum_revisions cr ON cr.name = s.curriculum_revision
WHERE ms.student_id = s.id
  AND ms.curriculum_revision_id IS NULL;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_mock_scores_curriculum_revision
  ON student_mock_scores(curriculum_revision_id);
