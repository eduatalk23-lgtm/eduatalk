-- ============================================================
-- Phase A — 탐구 가이드 주제 체계 (topic cluster) 도입
--
-- 목적: 4712건(reading 4432 + subject_performance 280) 가이드 풀을
--   주제(theme) 단위로 클러스터링 → 학생 진로/탐구 흐름에 맞는
--   기초→발전→심화 "사슬(sequel)" 매칭을 가능하게 함.
--
-- Phase A 스키마 (4 테이블/컬럼):
--   (1) exploration_guide_topic_clusters      — 주제 클러스터 마스터
--   (2) exploration_guides.topic_cluster_id   — 가이드 → cluster 연결
--   (3) exploration_guide_sequels             — 가이드 간 사슬 릴레이션
--   (4) student_record_topic_trajectories     — 학생 학년별 주제 궤적 (Phase B에서 채움)
-- ============================================================

BEGIN;

-- ============================================================
-- (1) 주제 클러스터 마스터
-- ============================================================

CREATE TABLE exploration_guide_topic_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 클러스터 이름 (LLM 생성, 20자 이내 권장)
  name text NOT NULL,
  -- 클러스터 설명 (LLM 생성, 100~200자)
  description text,
  -- 클러스터가 속한 가이드 유형 (reading | subject_performance | topic_exploration)
  guide_type text NOT NULL,
  -- 관련 계열 코드 배열 (exploration_guide_career_fields.code)
  career_field_codes text[] NOT NULL DEFAULT '{}',
  -- 주요 연계 과목 힌트 (자유 텍스트 배열)
  subject_hints text[] NOT NULL DEFAULT '{}',
  -- 현재 이 cluster 에 속한 가이드 수 (트리거로 자동 갱신)
  guide_count int NOT NULL DEFAULT 0,
  -- 난이도 분포 {basic: N, intermediate: N, advanced: N}
  difficulty_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 부모 cluster (큰 cluster 를 수동 분할 시 사용)
  parent_cluster_id uuid REFERENCES exploration_guide_topic_clusters(id) ON DELETE SET NULL,
  -- 생성 출처: llm_auto(자동) / consultant_manual(수동) / migration_seed
  source text NOT NULL DEFAULT 'llm_auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_topic_clusters_guide_type ON exploration_guide_topic_clusters(guide_type);
CREATE INDEX idx_topic_clusters_parent ON exploration_guide_topic_clusters(parent_cluster_id);
-- GIN 인덱스: career_field_codes 배열 매칭용
CREATE INDEX idx_topic_clusters_career_fields ON exploration_guide_topic_clusters USING GIN (career_field_codes);

COMMENT ON TABLE exploration_guide_topic_clusters IS
  'Phase A: 탐구 가이드 주제 클러스터. HDBSCAN + LLM 라벨링으로 생성.';
COMMENT ON COLUMN exploration_guide_topic_clusters.guide_type IS
  '해당 cluster 가 어느 guide_type 소속인지 (유형별 분리 클러스터링)';

-- ============================================================
-- (2) 가이드 → cluster 연결 컬럼
-- ============================================================

ALTER TABLE exploration_guides
  ADD COLUMN topic_cluster_id uuid REFERENCES exploration_guide_topic_clusters(id) ON DELETE SET NULL,
  ADD COLUMN topic_cluster_confidence numeric;

CREATE INDEX idx_guides_topic_cluster ON exploration_guides(topic_cluster_id);

COMMENT ON COLUMN exploration_guides.topic_cluster_id IS
  'Phase A: 소속 topic cluster. NULL = 클러스터링 대상 외 또는 noise point';
COMMENT ON COLUMN exploration_guides.topic_cluster_confidence IS
  'HDBSCAN 의 cluster membership probability (0~1). noise 는 NULL';

-- ============================================================
-- (3) 사슬 릴레이션
-- ============================================================

CREATE TABLE exploration_guide_sequels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_guide_id uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  to_guide_id uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  topic_cluster_id uuid REFERENCES exploration_guide_topic_clusters(id) ON DELETE SET NULL,
  -- 난이도 차이: +1 (기초→발전), +2 (기초→심화), -1 (강등 — 거의 안 씀)
  difficulty_step int NOT NULL,
  -- 관계 유형
  --   direct_sequel        : 같은 cluster 내 난이도 상승 (대표적)
  --   parallel_deepening   : 같은 난이도 내 다른 관점 심화
  --   perspective_shift    : cluster 는 같지만 관점/분야 전환
  --   prerequisite         : to_guide 가 from_guide 선수 지식 요구
  relation_type text NOT NULL CHECK (
    relation_type IN ('direct_sequel', 'parallel_deepening', 'perspective_shift', 'prerequisite')
  ),
  -- LLM 제시 근거 (1~2문장)
  reason text,
  -- 신뢰도 (0~1). 매칭 엔진은 0.4 이상만 사용
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  -- 생성 주체
  created_by text NOT NULL DEFAULT 'llm' CHECK (created_by IN ('llm', 'consultant')),
  -- 컨설턴트 검증
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 중복 방지
  UNIQUE (from_guide_id, to_guide_id),
  -- self-loop 금지
  CHECK (from_guide_id <> to_guide_id)
);

CREATE INDEX idx_sequels_from ON exploration_guide_sequels(from_guide_id);
CREATE INDEX idx_sequels_to ON exploration_guide_sequels(to_guide_id);
CREATE INDEX idx_sequels_cluster ON exploration_guide_sequels(topic_cluster_id);
CREATE INDEX idx_sequels_confidence ON exploration_guide_sequels(confidence)
  WHERE confidence >= 0.4;

COMMENT ON TABLE exploration_guide_sequels IS
  'Phase A: 가이드 간 사슬(기초→발전→심화) 릴레이션. LLM 제안 + 컨설턴트 검증.';

-- ============================================================
-- (4) 학생 주제 궤적 (Phase B 대비 스키마만 선제 정의)
-- ============================================================

CREATE TABLE student_record_topic_trajectories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  grade int NOT NULL CHECK (grade BETWEEN 1 AND 3),
  -- seed 출처
  --   seed_from_major       : target_major / career_field 에서 초기 주제 생성 (1학년 신규)
  --   extracted_from_neis   : NEIS 세특 분석에서 추출 (2·3학년)
  --   consultant_manual     : 컨설턴트 수동 지정
  source text NOT NULL CHECK (
    source IN ('seed_from_major', 'extracted_from_neis', 'consultant_manual')
  ),
  topic_cluster_id uuid REFERENCES exploration_guide_topic_clusters(id) ON DELETE SET NULL,
  -- 학생이 실제로 탐구한 구체 주제 (자유 텍스트 — cluster 이름보다 구체적)
  topic_theme text,
  -- 근거 { record_ids: [], reasoning: "" }
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 이 궤적이 얼마나 확실한가 (0~1)
  confidence numeric DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 학생×학년×cluster 는 1개만 (중복 방지)
  UNIQUE (student_id, grade, topic_cluster_id)
);

CREATE INDEX idx_topic_traj_student ON student_record_topic_trajectories(student_id);
CREATE INDEX idx_topic_traj_cluster ON student_record_topic_trajectories(topic_cluster_id);

COMMENT ON TABLE student_record_topic_trajectories IS
  'Phase B: 학생의 학년별 탐구 주제 궤적. Phase A 스키마와 함께 선제 생성.';

-- ============================================================
-- guide_count / difficulty_distribution 자동 갱신 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_topic_cluster_stats(p_cluster_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE exploration_guide_topic_clusters c
  SET
    guide_count = COALESCE((
      SELECT COUNT(*) FROM exploration_guides
      WHERE topic_cluster_id = p_cluster_id
        AND status = 'approved' AND is_latest = true
    ), 0),
    difficulty_distribution = COALESCE((
      SELECT jsonb_object_agg(difficulty_level, cnt)
      FROM (
        SELECT COALESCE(difficulty_level::text, 'unknown') AS difficulty_level, COUNT(*) AS cnt
        FROM exploration_guides
        WHERE topic_cluster_id = p_cluster_id
          AND status = 'approved' AND is_latest = true
        GROUP BY difficulty_level
      ) t
    ), '{}'::jsonb),
    updated_at = now()
  WHERE c.id = p_cluster_id;
$$;

CREATE OR REPLACE FUNCTION trigger_refresh_cluster_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.topic_cluster_id IS NOT NULL THEN
    PERFORM refresh_topic_cluster_stats(NEW.topic_cluster_id);
  ELSIF TG_OP = 'DELETE' AND OLD.topic_cluster_id IS NOT NULL THEN
    PERFORM refresh_topic_cluster_stats(OLD.topic_cluster_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.topic_cluster_id IS DISTINCT FROM NEW.topic_cluster_id THEN
      IF OLD.topic_cluster_id IS NOT NULL THEN
        PERFORM refresh_topic_cluster_stats(OLD.topic_cluster_id);
      END IF;
      IF NEW.topic_cluster_id IS NOT NULL THEN
        PERFORM refresh_topic_cluster_stats(NEW.topic_cluster_id);
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_cluster_stats
AFTER INSERT OR UPDATE OR DELETE ON exploration_guides
FOR EACH ROW EXECUTE FUNCTION trigger_refresh_cluster_stats();

-- ============================================================
-- RLS — 일단 서비스 롤만 접근 (Phase B에서 student 읽기 정책 추가)
-- ============================================================

ALTER TABLE exploration_guide_topic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE exploration_guide_sequels ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_record_topic_trajectories ENABLE ROW LEVEL SECURITY;

-- topic_clusters: approved 가이드와 동일 — 전체 읽기 허용 (관리자/컨설턴트)
CREATE POLICY "topic_clusters_read_all" ON exploration_guide_topic_clusters
  FOR SELECT USING (true);
CREATE POLICY "topic_clusters_admin_write" ON exploration_guide_topic_clusters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'consultant', 'superadmin')
    )
  );

-- sequels: 동일
CREATE POLICY "sequels_read_all" ON exploration_guide_sequels
  FOR SELECT USING (true);
CREATE POLICY "sequels_admin_write" ON exploration_guide_sequels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'consultant', 'superadmin')
    )
  );

-- topic_trajectories: 학생 본인 + 관리자/컨설턴트
CREATE POLICY "topic_traj_student_read" ON student_record_topic_trajectories
  FOR SELECT USING (
    student_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'consultant', 'superadmin')
    )
  );
CREATE POLICY "topic_traj_admin_write" ON student_record_topic_trajectories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'consultant', 'superadmin')
    )
  );

COMMIT;
