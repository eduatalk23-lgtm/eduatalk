-- ============================================================================
-- 마이그레이션: master_custom_contents 테이블 생성
-- 작성일: 2025-12-09
-- 설명: 마스터 커스텀 콘텐츠 테이블 생성 (마스터 교재/강의와 동일한 역할)
-- ============================================================================

-- ============================================================================
-- master_custom_contents 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_custom_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  
  -- 기본 정보 (MasterContentFields 기반)
  revision varchar(20), -- 개정 (2015개정 등)
  content_category varchar(20), -- 유형
  title text NOT NULL,
  difficulty_level varchar(20), -- 난이도
  notes text, -- 비고/메모
  
  -- 커스텀 콘텐츠 특화 필드
  content_type varchar(50), -- 콘텐츠 유형 ('book', 'lecture', 'worksheet', 'other')
  total_page_or_time integer, -- 총 페이지 수 또는 시간(분)
  subject varchar(50), -- 과목명 (denormalized)
  subject_category varchar(50), -- 교과 그룹명 (denormalized)
  
  -- 교육과정 관련 (선택적)
  curriculum_revision_id uuid REFERENCES curriculum_revisions(id),
  subject_id uuid REFERENCES subjects(id),
  subject_group_id uuid REFERENCES subject_groups(id),
  
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 인덱스 생성
-- ============================================================================

-- tenant_id 인덱스 (테넌트별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_tenant_id 
ON master_custom_contents(tenant_id);

-- title 인덱스 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_title 
ON master_custom_contents(title);

-- subject_id 인덱스 (과목별 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_subject_id 
ON master_custom_contents(subject_id);

-- curriculum_revision_id 인덱스 (교육과정별 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_curriculum_revision_id 
ON master_custom_contents(curriculum_revision_id);

-- content_type 인덱스 (유형별 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_content_type 
ON master_custom_contents(content_type);

-- difficulty_level 인덱스 (난이도별 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_difficulty_level 
ON master_custom_contents(difficulty_level);

-- updated_at 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_master_custom_contents_updated_at 
ON master_custom_contents(updated_at DESC);

-- ============================================================================
-- RLS (Row Level Security) 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE master_custom_contents ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자가 조회 가능 (tenant_id가 NULL이면 공통, 아니면 해당 테넌트만)
CREATE POLICY "master_custom_contents_select_policy"
ON master_custom_contents
FOR SELECT
USING (
  tenant_id IS NULL 
  OR tenant_id IN (
    SELECT tenant_id FROM students WHERE id = auth.uid()
    UNION
    SELECT tenant_id FROM admin_users WHERE id = auth.uid()
  )
);

-- 정책: 관리자/컨설턴트만 생성 가능
CREATE POLICY "master_custom_contents_insert_policy"
ON master_custom_contents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'consultant')
  )
);

-- 정책: 관리자/컨설턴트만 수정 가능 (자신의 테넌트 또는 공통 콘텐츠)
CREATE POLICY "master_custom_contents_update_policy"
ON master_custom_contents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'consultant')
    AND (
      master_custom_contents.tenant_id IS NULL
      OR master_custom_contents.tenant_id = admin_users.tenant_id
    )
  )
);

-- 정책: 관리자/컨설턴트만 삭제 가능 (자신의 테넌트 또는 공통 콘텐츠)
CREATE POLICY "master_custom_contents_delete_policy"
ON master_custom_contents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'consultant')
    AND (
      master_custom_contents.tenant_id IS NULL
      OR master_custom_contents.tenant_id = admin_users.tenant_id
    )
  )
);

-- ============================================================================
-- 업데이트 트리거 (updated_at 자동 갱신)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_master_custom_contents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_master_custom_contents_updated_at
BEFORE UPDATE ON master_custom_contents
FOR EACH ROW
EXECUTE FUNCTION update_master_custom_contents_updated_at();

-- ============================================================================
-- 주석 추가
-- ============================================================================

COMMENT ON TABLE master_custom_contents IS '마스터 커스텀 콘텐츠 테이블 (전체 기관 공통 또는 테넌트별)';
COMMENT ON COLUMN master_custom_contents.tenant_id IS 'NULL이면 전체 기관 공통, 값이 있으면 테넌트별 커스텀 콘텐츠';
COMMENT ON COLUMN master_custom_contents.content_type IS '콘텐츠 유형: book, lecture, worksheet, other';
COMMENT ON COLUMN master_custom_contents.total_page_or_time IS '총 페이지 수 또는 시간(분 단위)';

