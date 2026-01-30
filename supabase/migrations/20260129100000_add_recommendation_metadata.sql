-- ============================================================================
-- 추천 근거 메타데이터 컬럼 추가
--
-- Cold Start 추천 시스템에서 수집한 추천 근거 정보를 저장하기 위한 컬럼 추가
-- - recommendation_metadata: 추천 이유, 후기, 특성 등 상세 정보 (JSONB)
-- - review_score: 평균 리뷰 점수 (빠른 조회용)
-- - review_count: 리뷰 수 (빠른 조회용)
-- - target_students: 추천 대상 학생 유형 (배열, 필터링용)
-- ============================================================================

-- ============================================================================
-- master_books 테이블 컬럼 추가
-- ============================================================================

-- 추천 메타데이터 (JSONB)
ALTER TABLE master_books
ADD COLUMN IF NOT EXISTS recommendation_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN master_books.recommendation_metadata IS '추천 근거 메타데이터 (추천 이유, 후기 요약, 장단점 등)';

-- 리뷰 점수 (빠른 조회용)
ALTER TABLE master_books
ADD COLUMN IF NOT EXISTS review_score DECIMAL(2,1) DEFAULT NULL;

COMMENT ON COLUMN master_books.review_score IS '평균 리뷰 점수 (5점 만점)';

-- 리뷰 수 (빠른 조회용)
ALTER TABLE master_books
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

COMMENT ON COLUMN master_books.review_count IS '총 리뷰 수';

-- 추천 대상 학생 (필터링용)
ALTER TABLE master_books
ADD COLUMN IF NOT EXISTS target_students TEXT[] DEFAULT '{}';

COMMENT ON COLUMN master_books.target_students IS '추천 대상 학생 유형 배열';

-- ============================================================================
-- master_lectures 테이블 컬럼 추가
-- ============================================================================

-- 추천 메타데이터 (JSONB)
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS recommendation_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN master_lectures.recommendation_metadata IS '추천 근거 메타데이터 (추천 이유, 후기 요약, 장단점 등)';

-- 리뷰 점수 (빠른 조회용)
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS review_score DECIMAL(2,1) DEFAULT NULL;

COMMENT ON COLUMN master_lectures.review_score IS '평균 리뷰 점수 (5점 만점)';

-- 리뷰 수 (빠른 조회용)
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

COMMENT ON COLUMN master_lectures.review_count IS '총 리뷰 수';

-- 추천 대상 학생 (필터링용)
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS target_students TEXT[] DEFAULT '{}';

COMMENT ON COLUMN master_lectures.target_students IS '추천 대상 학생 유형 배열';

-- ============================================================================
-- 인덱스 생성 (맞춤 추천 쿼리 최적화)
-- ============================================================================

-- master_books 인덱스
CREATE INDEX IF NOT EXISTS idx_master_books_target_students
ON master_books USING GIN (target_students);

CREATE INDEX IF NOT EXISTS idx_master_books_review_score
ON master_books (review_score DESC NULLS LAST)
WHERE review_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_books_recommendation
ON master_books (subject_category, difficulty_level, review_score DESC NULLS LAST)
WHERE is_active = true;

-- master_lectures 인덱스
CREATE INDEX IF NOT EXISTS idx_master_lectures_target_students
ON master_lectures USING GIN (target_students);

CREATE INDEX IF NOT EXISTS idx_master_lectures_review_score
ON master_lectures (review_score DESC NULLS LAST)
WHERE review_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_lectures_recommendation
ON master_lectures (subject_category, difficulty_level, review_score DESC NULLS LAST)
WHERE is_active = true;

-- JSONB 내부 필드 인덱스 (선택적 - 자주 쿼리하는 경우)
-- recommendation_metadata->>'recommendation'->>'score' 로 쿼리할 경우
CREATE INDEX IF NOT EXISTS idx_master_books_rec_score
ON master_books ((recommendation_metadata->'recommendation'->>'score'))
WHERE recommendation_metadata IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_lectures_rec_score
ON master_lectures ((recommendation_metadata->'recommendation'->>'score'))
WHERE recommendation_metadata IS NOT NULL;
