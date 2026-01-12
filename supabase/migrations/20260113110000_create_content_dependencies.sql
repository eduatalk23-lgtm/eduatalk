-- 콘텐츠 의존성(선수학습) 관계 테이블
-- 콘텐츠 A를 먼저 학습해야 콘텐츠 B를 학습할 수 있음을 정의

CREATE TABLE IF NOT EXISTS content_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 선수 콘텐츠 (먼저 완료해야 함)
  prerequisite_content_id UUID NOT NULL,
  prerequisite_content_type VARCHAR(20) NOT NULL
    CHECK (prerequisite_content_type IN ('book', 'lecture', 'custom')),

  -- 의존 콘텐츠 (선수 콘텐츠 이후에 학습)
  dependent_content_id UUID NOT NULL,
  dependent_content_type VARCHAR(20) NOT NULL
    CHECK (dependent_content_type IN ('book', 'lecture', 'custom')),

  -- 범위: 전역(global) 또는 특정 플랜 그룹(plan_group)
  scope VARCHAR(20) NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'plan_group')),
  plan_group_id UUID REFERENCES plan_groups(id) ON DELETE CASCADE,

  -- 메타데이터
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  -- 자기 자신에 대한 의존성 방지
  CONSTRAINT check_not_self_dependency
    CHECK (prerequisite_content_id != dependent_content_id
           OR prerequisite_content_type != dependent_content_type),

  -- plan_group scope일 때 plan_group_id 필수
  CONSTRAINT check_plan_group_scope
    CHECK (scope != 'plan_group' OR plan_group_id IS NOT NULL)
);

-- 중복 방지를 위한 유니크 인덱스
-- scope='global'일 때와 'plan_group'일 때를 구분
CREATE UNIQUE INDEX idx_content_deps_unique_global
  ON content_dependencies (
    tenant_id,
    prerequisite_content_id,
    prerequisite_content_type,
    dependent_content_id,
    dependent_content_type
  )
  WHERE scope = 'global';

CREATE UNIQUE INDEX idx_content_deps_unique_plan_group
  ON content_dependencies (
    tenant_id,
    prerequisite_content_id,
    prerequisite_content_type,
    dependent_content_id,
    dependent_content_type,
    plan_group_id
  )
  WHERE scope = 'plan_group';

-- 검색 성능을 위한 인덱스
CREATE INDEX idx_content_deps_tenant ON content_dependencies(tenant_id);
CREATE INDEX idx_content_deps_prereq ON content_dependencies(prerequisite_content_id, prerequisite_content_type);
CREATE INDEX idx_content_deps_dependent ON content_dependencies(dependent_content_id, dependent_content_type);
CREATE INDEX idx_content_deps_plan_group ON content_dependencies(plan_group_id) WHERE plan_group_id IS NOT NULL;

-- RLS 활성화
ALTER TABLE content_dependencies ENABLE ROW LEVEL SECURITY;

-- 관리자 정책: 자신의 tenant 의존성 관리 가능
CREATE POLICY "Admins can manage tenant dependencies" ON content_dependencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.tenant_id = content_dependencies.tenant_id
    )
  );

-- 학생 정책: 자신의 tenant 의존성 조회만 가능
CREATE POLICY "Students can view tenant dependencies" ON content_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = auth.uid()
      AND students.tenant_id = content_dependencies.tenant_id
    )
  );

-- 코멘트 추가
COMMENT ON TABLE content_dependencies IS '콘텐츠 간 선수학습 의존성 관계를 정의하는 테이블';
COMMENT ON COLUMN content_dependencies.prerequisite_content_id IS '선수 콘텐츠 ID (먼저 학습해야 함)';
COMMENT ON COLUMN content_dependencies.dependent_content_id IS '의존 콘텐츠 ID (선수 콘텐츠 이후에 학습)';
COMMENT ON COLUMN content_dependencies.scope IS 'global: 전역 적용, plan_group: 특정 플랜 그룹에만 적용';
