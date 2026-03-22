-- ============================================================
-- AI 추천 주제 영구 축적 저장소
-- 가이드 생성 시 AI가 추천한 탐구 주제를 영구 저장하여
-- 시간이 갈수록 풍부해지는 주제 풀을 구축한다.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suggested_topics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- 분류 조건 (검색/필터용)
  guide_type            varchar(30) NOT NULL
                          CHECK (guide_type IN ('reading', 'topic_exploration', 'subject_performance', 'experiment', 'program')),
  subject_name          text,
  career_field          text,
  curriculum_year       smallint,
  target_major          text,

  -- 주제 내용
  title                 text NOT NULL,
  reason                text,
  related_subjects      text[] DEFAULT '{}',

  -- 추적
  used_count            int NOT NULL DEFAULT 0,
  guide_created_count   int NOT NULL DEFAULT 0,
  ai_model_version      text,
  created_by            uuid REFERENCES public.user_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- 중복 방지 (같은 테넌트 내 같은 제목)
  UNIQUE(tenant_id, title)
);

COMMENT ON TABLE public.suggested_topics IS 'AI 추천 탐구 주제 영구 축적 저장소';
COMMENT ON COLUMN public.suggested_topics.used_count IS '주제 칩 클릭 횟수 (인기도)';
COMMENT ON COLUMN public.suggested_topics.guide_created_count IS '이 주제로 가이드가 생성된 횟수';

-- 인덱스
CREATE INDEX idx_st_filter ON public.suggested_topics(tenant_id, guide_type, career_field);
CREATE INDEX idx_st_subject ON public.suggested_topics(subject_name) WHERE subject_name IS NOT NULL;
CREATE INDEX idx_st_popular ON public.suggested_topics(used_count DESC);
CREATE INDEX idx_st_created ON public.suggested_topics(created_at DESC);

-- NULL tenant_id (글로벌 공유 주제)에 대한 제목 유니크 보장
CREATE UNIQUE INDEX idx_st_title_global ON public.suggested_topics(title) WHERE tenant_id IS NULL;

-- RLS
ALTER TABLE public.suggested_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "st_admin_all"
  ON public.suggested_topics FOR ALL
  USING (public.rls_check_guide_access(tenant_id))
  WITH CHECK (public.rls_check_guide_access(tenant_id));
