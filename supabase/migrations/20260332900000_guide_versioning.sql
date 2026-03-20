-- ============================================================
-- CMS C4: 탐구 가이드 버전 관리
-- version (순번) + is_latest (최신 플래그) + original_guide_id (버전 체인)
-- ============================================================

-- 1. 컬럼 추가
ALTER TABLE exploration_guides
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN is_latest boolean NOT NULL DEFAULT true,
  ADD COLUMN original_guide_id uuid REFERENCES exploration_guides(id) ON DELETE SET NULL;

COMMENT ON COLUMN exploration_guides.version IS '버전 순번 (1부터 시작)';
COMMENT ON COLUMN exploration_guides.is_latest IS '최신 버전 여부 (버전 체인 내에서 하나만 true)';
COMMENT ON COLUMN exploration_guides.original_guide_id IS '최초 버전 가이드 ID (버전 체인 그룹핑, NULL이면 자기 자신이 원본)';

-- 2. 인덱스
-- 최신 버전만 조회 (가장 빈번한 쿼리)
CREATE INDEX idx_guides_is_latest ON exploration_guides (is_latest) WHERE is_latest = true;

-- 버전 히스토리 조회
CREATE INDEX idx_guides_original_version ON exploration_guides (original_guide_id, version DESC);

-- 3. 기존 데이터: 모든 기존 가이드는 version=1, is_latest=true, original_guide_id=NULL (원본)
-- DEFAULT 값이 이미 적용되므로 별도 UPDATE 불필요
