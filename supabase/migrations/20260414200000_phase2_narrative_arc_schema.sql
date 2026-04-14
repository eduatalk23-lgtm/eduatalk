-- ============================================================
-- Phase 2 (Layer 3 Narrative Arc): 8단계 서사 태깅 영속화
-- student_record_narrative_arc — 각 세특/창체/행특/개인세특에
-- ①호기심 ②주제선정 ③탐구내용 ④참고문헌 ⑤결론 ⑥교사관찰 ⑦성장서사 ⑧재탐구
-- 존재 여부 + confidence + evidence 저장
--
-- 근거: setek-evaluation-framework.md Phase B (프롬프트에 8단계 반영 완료,
-- 구조화된 태깅/UI는 미구현) + consultant-augmentation-platform-roadmap.md Phase 2
-- ============================================================

BEGIN;

-- ============================================================
-- 1. student_record_narrative_arc
-- ============================================================

CREATE TABLE IF NOT EXISTS public.student_record_narrative_arc (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  pipeline_id   UUID REFERENCES public.student_record_analysis_pipelines(id)
                  ON DELETE SET NULL,

  -- 다형 참조 (content_quality 패턴)
  record_type   VARCHAR(20) NOT NULL
                  CHECK (record_type IN ('setek', 'personal_setek', 'changche', 'haengteuk')),
  record_id     UUID NOT NULL,
  school_year   INTEGER NOT NULL,
  grade         SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 3),

  -- 8단계 존재 플래그 (필터·배지 조회용 — BOOLEAN 분해)
  curiosity_present            BOOLEAN NOT NULL DEFAULT FALSE,
  topic_selection_present      BOOLEAN NOT NULL DEFAULT FALSE,
  inquiry_content_present      BOOLEAN NOT NULL DEFAULT FALSE,
  references_present           BOOLEAN NOT NULL DEFAULT FALSE,
  conclusion_present           BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_observation_present  BOOLEAN NOT NULL DEFAULT FALSE,
  growth_narrative_present     BOOLEAN NOT NULL DEFAULT FALSE,
  reinquiry_present            BOOLEAN NOT NULL DEFAULT FALSE,

  -- 집계 (GENERATED — 그래프 노드 크기·결여 경고에 활용)
  stages_present_count  SMALLINT GENERATED ALWAYS AS (
    curiosity_present::int +
    topic_selection_present::int +
    inquiry_content_present::int +
    references_present::int +
    conclusion_present::int +
    teacher_observation_present::int +
    growth_narrative_present::int +
    reinquiry_present::int
  ) STORED,

  -- 세부 메타 (confidence + evidence 문자열, stage 단위)
  -- { curiosity: { confidence: 0.0~1.0, evidence: "..." }, topic_selection: {...}, ... }
  stage_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 출처/모델 (LLM drift 추적)
  source        VARCHAR(10) NOT NULL DEFAULT 'ai'
                  CHECK (source IN ('ai', 'manual')),
  model_name    TEXT,  -- 예: 'gemini-2.5-flash', 'gemini-2.5-pro'

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 동일 레코드 + 동일 source 중복 방지 (upsert 기준)
  UNIQUE (tenant_id, student_id, record_type, record_id, source)
);

COMMENT ON TABLE public.student_record_narrative_arc IS
  'Layer 3 Narrative Arc: 세특/창체/행특/개인세특 각각의 8단계 서사 태깅 (Phase 2). boolean 8 + stage_details JSONB(confidence+evidence).';
COMMENT ON COLUMN public.student_record_narrative_arc.curiosity_present IS '①호기심: 탐구 시작 동기가 명시되어 있는가';
COMMENT ON COLUMN public.student_record_narrative_arc.topic_selection_present IS '②주제선정: 구체적 탐구 주제가 선정되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.inquiry_content_present IS '③탐구내용: 탐구 과정·방법이 서술되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.references_present IS '④참고문헌: 자료/문헌/출처가 언급되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.conclusion_present IS '⑤결론: 탐구 결과·결론이 제시되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.teacher_observation_present IS '⑥교사관찰: 교사의 직접 관찰·평가가 포함되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.growth_narrative_present IS '⑦성장서사: 탐구를 통한 학생 성장·변화가 서술되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.reinquiry_present IS '⑧재탐구: 후속 탐구/심화 의지가 언급되었는가';
COMMENT ON COLUMN public.student_record_narrative_arc.stage_details IS
  '단계별 세부: { [stage]: { confidence: 0.0~1.0, evidence: "원문 근거 문자열" } }. evidence는 원문 인용 또는 짧은 요약.';
COMMENT ON COLUMN public.student_record_narrative_arc.stages_present_count IS
  '존재하는 단계 수 (0~8). GENERATED. 그래프 노드 크기·F10/M1 경고에 활용';
COMMENT ON COLUMN public.student_record_narrative_arc.source IS 'ai = LLM 추출, manual = 컨설턴트 교정';
COMMENT ON COLUMN public.student_record_narrative_arc.model_name IS 'LLM 모델명 (drift 추적). Gemini 2.5 flash/pro 기본';

-- ============================================================
-- 2. 인덱스
-- ============================================================

-- 학생별 조회 (그래프 뷰, 리스트 뷰 주 쿼리)
CREATE INDEX IF NOT EXISTS idx_srna_student_year
  ON public.student_record_narrative_arc (student_id, school_year);

CREATE INDEX IF NOT EXISTS idx_srna_tenant_student
  ON public.student_record_narrative_arc (tenant_id, student_id);

-- 레코드별 조회 (세특 카드에서 직접 로드)
CREATE INDEX IF NOT EXISTS idx_srna_record
  ON public.student_record_narrative_arc (record_type, record_id);

-- 결여 필터용 (stages_present_count 적은 레코드 조감)
CREATE INDEX IF NOT EXISTS idx_srna_stages_count
  ON public.student_record_narrative_arc (student_id, stages_present_count);

-- 파이프라인별 (재실행 롤백용)
CREATE INDEX IF NOT EXISTS idx_srna_pipeline
  ON public.student_record_narrative_arc (pipeline_id)
  WHERE pipeline_id IS NOT NULL;

-- ============================================================
-- 3. updated_at 트리거
-- ============================================================

CREATE OR REPLACE TRIGGER set_updated_at_student_record_narrative_arc
  BEFORE UPDATE ON public.student_record_narrative_arc
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. 다형 참조 정리 함수 확장
--    기존 cleanup_polymorphic_refs()는 activity_tags / storyline_links /
--    reading_links를 정리. 동일 시그니처로 덮어쓰되 narrative_arc를 추가.
--    기존 특성(SECURITY DEFINER, search_path='', IF EXISTS 가드,
--    reading_links는 setek/personal_setek/changche만) 전부 보존.
--    content_quality는 원래도 정리 대상이 아님 — 코어 레코드 소프트 삭제
--    정책상 실제 DELETE가 드물어 유지(건드리지 않음).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_polymorphic_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- activity_tags (Phase 5)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_activity_tags'
  ) THEN
    DELETE FROM public.student_record_activity_tags
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- storyline_links (Phase 1c)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_storyline_links'
  ) THEN
    DELETE FROM public.student_record_storyline_links
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- reading_links (Phase 1c, setek/personal_setek/changche만 해당)
  IF TG_ARGV[0] IN ('setek', 'personal_setek', 'changche') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_record_reading_links'
    ) THEN
      DELETE FROM public.student_record_reading_links
        WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
    END IF;
  END IF;

  -- narrative_arc (Phase 2, 이 마이그레이션에서 신설)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_narrative_arc'
  ) THEN
    DELETE FROM public.student_record_narrative_arc
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE public.student_record_narrative_arc ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 전체 접근 (tenant 범위)
CREATE POLICY "srna_admin_all"
  ON public.student_record_narrative_arc FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 자신의 데이터만 조회 (AI 라벨 비노출 원칙 — UI에서 따로 제어)
CREATE POLICY "srna_student_select"
  ON public.student_record_narrative_arc FOR SELECT
  USING (public.rls_check_student_own(student_id));

-- 학부모: 자녀 데이터만 조회
CREATE POLICY "srna_parent_select"
  ON public.student_record_narrative_arc FOR SELECT
  USING (public.rls_check_parent_student(student_id));

COMMIT;
