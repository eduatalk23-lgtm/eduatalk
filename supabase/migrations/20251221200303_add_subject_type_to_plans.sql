-- student_plan 테이블에 subject_type 컬럼 추가
ALTER TABLE student_plan 
ADD COLUMN subject_type TEXT 
CHECK (subject_type IS NULL OR subject_type IN ('strategy', 'weakness'));

-- 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_student_plan_subject_type 
ON student_plan(subject_type) 
WHERE subject_type IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN student_plan.subject_type IS '전략/취약 정보: strategy(전략과목), weakness(취약과목)';

