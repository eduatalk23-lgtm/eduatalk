-- Migration: Add Auto Recommendation Fields to plan_contents
-- Description: plan_contents 테이블에 자동 추천 관련 필드 추가
-- Date: 2025-02-03

-- ============================================
-- plan_contents 테이블에 자동 추천 필드 추가
-- ============================================

-- 1. is_auto_recommended 필드 추가 (자동 추천 여부)
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS is_auto_recommended BOOLEAN DEFAULT FALSE;

-- 2. recommendation_source 필드 추가 (추천 출처: 'auto', 'admin', 'template')
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS recommendation_source VARCHAR(20) CHECK (recommendation_source IN ('auto', 'admin', 'template'));

-- 3. recommendation_reason 필드 추가 (추천 이유)
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;

-- 4. recommendation_metadata 필드 추가 (추가 메타데이터: scoreDetails, priority 등)
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS recommendation_metadata JSONB;

-- 5. recommended_at 필드 추가 (자동 추천 생성 시점)
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS recommended_at TIMESTAMPTZ;

-- 6. recommended_by 필드 추가 (추천 생성자: 'system' 또는 관리자 ID)
ALTER TABLE plan_contents
ADD COLUMN IF NOT EXISTS recommended_by VARCHAR(50);

-- 7. 인덱스 추가 (자동 추천 콘텐츠 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_plan_contents_auto_recommended 
ON plan_contents(plan_group_id, is_auto_recommended) 
WHERE is_auto_recommended = TRUE;

CREATE INDEX IF NOT EXISTS idx_plan_contents_recommendation_source 
ON plan_contents(plan_group_id, recommendation_source);

-- 8. 코멘트 추가
COMMENT ON COLUMN plan_contents.is_auto_recommended IS '자동 추천 여부 (true: 자동 추천, false: 관리자 추가 또는 학생 선택)';
COMMENT ON COLUMN plan_contents.recommendation_source IS '추천 출처: auto(자동 추천), admin(관리자 추가), template(템플릿 기본 추천)';
COMMENT ON COLUMN plan_contents.recommendation_reason IS '추천 이유 (구체적인 성적 정보 포함)';
COMMENT ON COLUMN plan_contents.recommendation_metadata IS '추가 메타데이터 (scoreDetails, priority 등)';
COMMENT ON COLUMN plan_contents.recommended_at IS '자동 추천 생성 시점';
COMMENT ON COLUMN plan_contents.recommended_by IS '추천 생성자 (system 또는 관리자 ID)';

