-- ============================================================================
-- 마이그레이션: 마스터 콘텐츠 테이블 인덱스 추가
-- 작성일: 2025-12-16
-- 설명: 콘텐츠 검색 성능 최적화를 위한 복합 인덱스 추가
--       - (curriculum_revision_id, subject_group_id, subject_id) 복합 인덱스
--       - (tenant_id, is_active) 복합 인덱스
-- ============================================================================

-- ============================================================================
-- master_books 테이블 인덱스
-- ============================================================================

-- 교육과정 필터링 복합 인덱스 (가장 자주 사용되는 필터 조합)
-- 쿼리 패턴: WHERE curriculum_revision_id = ? AND subject_group_id = ? AND subject_id = ?
CREATE INDEX IF NOT EXISTS idx_master_books_curriculum_subject_composite
ON master_books(curriculum_revision_id, subject_group_id, subject_id)
WHERE curriculum_revision_id IS NOT NULL AND subject_group_id IS NOT NULL AND subject_id IS NOT NULL;

-- 테넌트 및 활성 상태 복합 인덱스 (필터링 성능 향상)
-- 쿼리 패턴: WHERE tenant_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_master_books_tenant_active
ON master_books(tenant_id, is_active)
WHERE is_active = true;

-- ============================================================================
-- master_lectures 테이블 인덱스
-- ============================================================================

-- 교육과정 필터링 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_master_lectures_curriculum_subject_composite
ON master_lectures(curriculum_revision_id, subject_group_id, subject_id)
WHERE curriculum_revision_id IS NOT NULL AND subject_group_id IS NOT NULL AND subject_id IS NOT NULL;

-- 테넌트 및 활성 상태 복합 인덱스
-- 주의: master_lectures 테이블에 is_active 컬럼이 있는지 확인 필요
-- 없으면 이 인덱스는 생성되지 않음
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_lectures' AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_master_lectures_tenant_active
    ON master_lectures(tenant_id, is_active)
    WHERE is_active = true;
  END IF;
END $$;

-- ============================================================================
-- master_custom_contents 테이블 인덱스
-- ============================================================================

-- 교육과정 필터링 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_curriculum_subject_composite
ON master_custom_contents(curriculum_revision_id, subject_group_id, subject_id)
WHERE curriculum_revision_id IS NOT NULL AND subject_group_id IS NOT NULL AND subject_id IS NOT NULL;

-- 테넌트 및 활성 상태 복합 인덱스
-- 주의: master_custom_contents 테이블에 is_active 컬럼이 있는지 확인 필요
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'master_custom_contents' AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_master_custom_contents_tenant_active
    ON master_custom_contents(tenant_id, is_active)
    WHERE is_active = true;
  END IF;
END $$;

-- ============================================================================
-- 주석: 인덱스 사용 가이드
-- ============================================================================
-- 
-- 이 인덱스들은 다음 쿼리 패턴을 최적화합니다:
-- 
-- 1. 교육과정 기반 필터링:
--    SELECT * FROM master_books 
--    WHERE curriculum_revision_id = ? 
--      AND subject_group_id = ? 
--      AND subject_id = ?;
-- 
-- 2. 테넌트 및 활성 상태 필터링:
--    SELECT * FROM master_books 
--    WHERE tenant_id = ? AND is_active = true;
-- 
-- 3. 복합 필터링 (인덱스 병합):
--    SELECT * FROM master_books 
--    WHERE curriculum_revision_id = ? 
--      AND subject_id = ? 
--      AND tenant_id = ? 
--      AND is_active = true;
-- 
-- 참고: PostgreSQL은 여러 인덱스를 병합하여 사용할 수 있으므로,
--       복합 인덱스와 단일 컬럼 인덱스를 함께 사용할 수 있습니다.

