-- ============================================
-- Phase 3.1: 교재 난이도 평가 시스템
-- Content Difficulty Analysis Tables
-- ============================================

-- 콘텐츠 난이도 분석 결과 테이블
CREATE TABLE IF NOT EXISTS content_difficulty_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('book', 'lecture')),
  content_id uuid NOT NULL,
  analysis_version integer DEFAULT 1,

  -- 종합 난이도 (0.00-5.00 스케일, 5가 가장 어려움)
  overall_difficulty_score numeric(3,2) CHECK (overall_difficulty_score >= 0 AND overall_difficulty_score <= 5),
  difficulty_confidence numeric(3,2) CHECK (difficulty_confidence >= 0 AND difficulty_confidence <= 1),

  -- 세부 지표
  vocabulary_complexity numeric(3,2) CHECK (vocabulary_complexity >= 0 AND vocabulary_complexity <= 5),
  concept_density numeric(3,2) CHECK (concept_density >= 0 AND concept_density <= 5),
  prerequisite_depth integer CHECK (prerequisite_depth >= 1 AND prerequisite_depth <= 5),
  mathematical_complexity numeric(3,2) CHECK (mathematical_complexity >= 0 AND mathematical_complexity <= 5),

  -- 추정 학습 시간
  estimated_hours_per_unit numeric(4,2),
  recommended_study_pace jsonb,
  -- 예: {"beginner": "3 pages/session", "intermediate": "5 pages/session", "advanced": "8 pages/session"}

  -- 메타데이터
  analyzed_at timestamptz DEFAULT now(),
  analyzed_by text CHECK (analyzed_by IN ('manual', 'ai', 'algorithm')),
  analysis_model text, -- AI 모델 ID (예: 'claude-3-sonnet')
  analysis_prompt_version text, -- 프롬프트 버전

  -- 추가 분석 데이터
  prerequisite_concepts jsonb DEFAULT '[]', -- 선수 개념 목록
  key_concepts_covered jsonb DEFAULT '[]', -- 다루는 핵심 개념 목록
  reasoning text, -- AI 분석 근거

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (content_type, content_id, analysis_version)
);

-- 개념 정의 테이블
CREATE TABLE IF NOT EXISTS content_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  subject_category text, -- 'math', 'physics', 'chemistry' 등

  difficulty_level integer CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  prerequisites uuid[] DEFAULT '{}', -- 선수 개념 ID 배열
  keywords text[] DEFAULT '{}', -- 관련 키워드
  description text,

  curriculum_revision text, -- '2015', '2022'
  grade_level integer[], -- [1,2,3] = 고1~고3

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 복합 유니크: 과목+이름+교육과정
  UNIQUE (subject_category, name, curriculum_revision)
);

-- 콘텐츠-개념 매핑
CREATE TABLE IF NOT EXISTS content_concept_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('book', 'lecture')),
  content_id uuid NOT NULL,
  concept_id uuid REFERENCES content_concepts(id) ON DELETE CASCADE,

  coverage_depth numeric(3,2) CHECK (coverage_depth >= 0 AND coverage_depth <= 1),
  page_range int4range, -- 교재: 해당 페이지 범위
  episode_range int4range, -- 강의: 해당 에피소드 범위

  created_at timestamptz DEFAULT now(),

  UNIQUE (content_type, content_id, concept_id)
);

-- AI 난이도 분석 요청 큐
CREATE TABLE IF NOT EXISTS content_analysis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('book', 'lecture')),
  content_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer DEFAULT 0, -- 높을수록 우선

  -- 처리 정보
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,

  -- 요청 컨텍스트
  request_context jsonb, -- 추가 분석 요청 정보

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (content_type, content_id)
);

-- ============================================
-- Indexes
-- ============================================

-- content_difficulty_analysis 인덱스
CREATE INDEX idx_difficulty_content ON content_difficulty_analysis(content_type, content_id);
CREATE INDEX idx_difficulty_score ON content_difficulty_analysis(overall_difficulty_score);
CREATE INDEX idx_difficulty_analyzed_at ON content_difficulty_analysis(analyzed_at DESC);

-- content_concepts 인덱스
CREATE INDEX idx_concepts_subject ON content_concepts(subject_category);
CREATE INDEX idx_concepts_difficulty ON content_concepts(difficulty_level);
CREATE INDEX idx_concepts_curriculum ON content_concepts(curriculum_revision);
CREATE INDEX idx_concepts_keywords ON content_concepts USING GIN (keywords);

-- content_concept_mappings 인덱스
CREATE INDEX idx_mappings_content ON content_concept_mappings(content_type, content_id);
CREATE INDEX idx_mappings_concept ON content_concept_mappings(concept_id);

-- content_analysis_queue 인덱스
CREATE INDEX idx_queue_status ON content_analysis_queue(status, priority DESC, created_at);
CREATE INDEX idx_queue_tenant ON content_analysis_queue(tenant_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE content_difficulty_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_concept_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analysis_queue ENABLE ROW LEVEL SECURITY;

-- content_difficulty_analysis: 모든 인증 사용자 읽기 가능
CREATE POLICY "Anyone can read difficulty analysis"
  ON content_difficulty_analysis FOR SELECT
  TO authenticated
  USING (true);

-- content_difficulty_analysis: 관리자만 쓰기 가능
CREATE POLICY "Admins can manage difficulty analysis"
  ON content_difficulty_analysis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- content_concepts: 모든 인증 사용자 읽기 가능
CREATE POLICY "Anyone can read concepts"
  ON content_concepts FOR SELECT
  TO authenticated
  USING (true);

-- content_concepts: 관리자만 쓰기 가능
CREATE POLICY "Admins can manage concepts"
  ON content_concepts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- content_concept_mappings: 모든 인증 사용자 읽기 가능
CREATE POLICY "Anyone can read mappings"
  ON content_concept_mappings FOR SELECT
  TO authenticated
  USING (true);

-- content_concept_mappings: 관리자만 쓰기 가능
CREATE POLICY "Admins can manage mappings"
  ON content_concept_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- content_analysis_queue: 테넌트 기반 RLS (관리자만)
CREATE POLICY "Admins can view their tenant queue"
  ON content_analysis_queue FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- content_analysis_queue: 관리자만 쓰기 가능
CREATE POLICY "Admins can manage analysis queue"
  ON content_analysis_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- ============================================
-- Functions
-- ============================================

-- 분석 큐에 콘텐츠 추가 함수
CREATE OR REPLACE FUNCTION add_to_analysis_queue(
  p_tenant_id uuid,
  p_content_type text,
  p_content_id uuid,
  p_priority integer DEFAULT 0,
  p_context jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_id uuid;
BEGIN
  INSERT INTO content_analysis_queue (tenant_id, content_type, content_id, priority, request_context)
  VALUES (p_tenant_id, p_content_type, p_content_id, p_priority, p_context)
  ON CONFLICT (content_type, content_id) DO UPDATE
  SET
    priority = GREATEST(content_analysis_queue.priority, EXCLUDED.priority),
    status = CASE
      WHEN content_analysis_queue.status = 'failed' THEN 'pending'
      ELSE content_analysis_queue.status
    END,
    updated_at = now()
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- 다음 분석 대상 가져오기 함수
CREATE OR REPLACE FUNCTION get_next_analysis_item()
RETURNS TABLE (
  queue_id uuid,
  content_type text,
  content_id uuid,
  request_context jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE content_analysis_queue q
  SET
    status = 'processing',
    started_at = now(),
    updated_at = now()
  WHERE q.id = (
    SELECT sq.id
    FROM content_analysis_queue sq
    WHERE sq.status = 'pending'
    AND (sq.retry_count < sq.max_retries OR sq.max_retries = -1)
    ORDER BY sq.priority DESC, sq.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.content_type, q.content_id, q.request_context;
END;
$$;

-- 분석 완료 처리 함수
CREATE OR REPLACE FUNCTION complete_analysis(
  p_queue_id uuid,
  p_success boolean,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_success THEN
    UPDATE content_analysis_queue
    SET
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    WHERE id = p_queue_id;
  ELSE
    UPDATE content_analysis_queue
    SET
      status = CASE
        WHEN retry_count + 1 >= max_retries THEN 'failed'
        ELSE 'pending'
      END,
      retry_count = retry_count + 1,
      error_message = p_error_message,
      started_at = NULL,
      updated_at = now()
    WHERE id = p_queue_id;
  END IF;
END;
$$;

-- updated_at 트리거
CREATE TRIGGER update_content_difficulty_analysis_updated_at
  BEFORE UPDATE ON content_difficulty_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_concepts_updated_at
  BEFORE UPDATE ON content_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_analysis_queue_updated_at
  BEFORE UPDATE ON content_analysis_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE content_difficulty_analysis IS 'AI가 분석한 콘텐츠 난이도 정보';
COMMENT ON TABLE content_concepts IS '교육과정 개념 정의 (선수지식 매핑용)';
COMMENT ON TABLE content_concept_mappings IS '콘텐츠-개념 매핑 관계';
COMMENT ON TABLE content_analysis_queue IS '난이도 분석 요청 큐';

COMMENT ON COLUMN content_difficulty_analysis.overall_difficulty_score IS '종합 난이도 점수 (0-5)';
COMMENT ON COLUMN content_difficulty_analysis.vocabulary_complexity IS '어휘 복잡도 (0-5)';
COMMENT ON COLUMN content_difficulty_analysis.concept_density IS '개념 밀도 - 단위당 개념 수 (0-5)';
COMMENT ON COLUMN content_difficulty_analysis.prerequisite_depth IS '선수지식 깊이 (1-5)';
COMMENT ON COLUMN content_difficulty_analysis.mathematical_complexity IS '수리적 복잡도 (0-5)';

COMMENT ON FUNCTION add_to_analysis_queue IS '콘텐츠를 분석 큐에 추가';
COMMENT ON FUNCTION get_next_analysis_item IS '다음 분석할 콘텐츠 가져오기 (락 포함)';
COMMENT ON FUNCTION complete_analysis IS '분석 완료 처리';
