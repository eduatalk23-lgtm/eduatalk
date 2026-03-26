-- ============================================================================
-- Phase C-0: 우회학과 고도화 — 커리큘럼 소스 트래킹 + 구조화 사유 + 피드백
-- ============================================================================

-- C-0a: department_curriculum 소스 트래킹
ALTER TABLE department_curriculum
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'import'
  CHECK (source IN ('import', 'public_api', 'web_search', 'ai_inferred')),
ADD COLUMN IF NOT EXISTS confidence smallint DEFAULT 100
  CHECK (confidence BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS stale_at timestamptz;

COMMENT ON COLUMN department_curriculum.source IS '데이터 수집 경로 (import=Access DB, public_api=공공API, web_search=웹검색, ai_inferred=LLM추론)';
COMMENT ON COLUMN department_curriculum.confidence IS '데이터 신뢰도 (0-100). import=100, web_search=80-90, ai_inferred=40-70';
COMMENT ON COLUMN department_curriculum.stale_at IS 'NULL=fresh, 6개월 후 자동 설정. stale이면 재수집 대상';

-- C-0b: bypass_major_candidates 구조화 사유 + 추천 소스
ALTER TABLE bypass_major_candidates
ADD COLUMN IF NOT EXISTS competency_rationale text,
ADD COLUMN IF NOT EXISTS curriculum_rationale text,
ADD COLUMN IF NOT EXISTS placement_rationale text,
ADD COLUMN IF NOT EXISTS recommendation_source text DEFAULT 'target_based'
  CHECK (recommendation_source IN ('target_based', 'diagnosis_based', 'profile_based'));

COMMENT ON COLUMN bypass_major_candidates.competency_rationale IS '적합도 축 사유 (역량+탐구 키워드 매칭 근거)';
COMMENT ON COLUMN bypass_major_candidates.curriculum_rationale IS '유사도 축 사유 (커리큘럼 공통 과목 근거)';
COMMENT ON COLUMN bypass_major_candidates.placement_rationale IS '실현가능성 축 사유 (배치 판정 근거)';
COMMENT ON COLUMN bypass_major_candidates.recommendation_source IS '추천 경로 (target_based=희망학과 기반, diagnosis_based=AI진단 기반, profile_based=프로필 기반)';

-- C-0c: 커리큘럼 수집 로그 (Tier 2~4 수집 이력)
CREATE TABLE IF NOT EXISTS curriculum_collection_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES university_departments(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('public_api', 'web_search', 'ai_inferred')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  courses_found int DEFAULT 0,
  search_query text,
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_curriculum_log_dept ON curriculum_collection_log(department_id, attempted_at DESC);
CREATE INDEX idx_curriculum_log_status ON curriculum_collection_log(status, tier);

-- C-0d: 컨설턴트 피드백 축적 (콜드스타트 해소용)
CREATE TABLE IF NOT EXISTS bypass_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES bypass_major_candidates(id) ON DELETE SET NULL,
  department_id uuid REFERENCES university_departments(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('shortlist', 'reject', 'select')),
  reason text,
  consultant_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- 패턴 매칭용 비정규화 스냅샷
  competency_profile jsonb,     -- 행동 시점 학생 역량 점수 스냅샷
  mid_classification text,      -- 학과의 mid_classification (클러스터링용)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bypass_feedback_student ON bypass_recommendation_feedback(student_id);
CREATE INDEX idx_bypass_feedback_dept ON bypass_recommendation_feedback(department_id);
CREATE INDEX idx_bypass_feedback_mid ON bypass_recommendation_feedback(mid_classification, action);

-- RLS
ALTER TABLE curriculum_collection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bypass_recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- curriculum_collection_log: 인증된 사용자 읽기 전용
CREATE POLICY "curriculum_log_read" ON curriculum_collection_log
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- 서버(admin client)에서만 쓰기 → RLS bypass via admin client

-- bypass_recommendation_feedback: 관리자/컨설턴트 전용
CREATE POLICY "bypass_feedback_admin" ON bypass_recommendation_feedback
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));
