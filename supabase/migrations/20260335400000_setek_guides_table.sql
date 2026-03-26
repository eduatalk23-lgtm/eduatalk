-- Phase 2.5c: setek_guides 별도 테이블
-- 기존 activity_summaries(prompt_version='guide_v1')에서 과목별 테이블로 분리
-- AI/컨설턴트/확정 3관점 + 과목별 방향 데이터 영속화

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_record_setek_guides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id)
                      ON UPDATE CASCADE ON DELETE CASCADE,
  school_year       INTEGER NOT NULL,
  subject_id        UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,

  -- 3관점 지원
  source            VARCHAR(20) NOT NULL DEFAULT 'ai'
                      CHECK (source IN ('ai', 'manual')),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'confirmed')),

  -- 방향 데이터
  direction         TEXT NOT NULL,
  keywords          TEXT[] NOT NULL DEFAULT '{}',
  competency_focus  TEXT[] NOT NULL DEFAULT '{}',
  cautions          TEXT,
  teacher_points    TEXT[] NOT NULL DEFAULT '{}',

  -- 전체 방향 (학생 단위 — 동일 배치의 첫 행에만 설정)
  overall_direction TEXT,

  -- AI 메타
  model_tier        VARCHAR(20),
  prompt_version    VARCHAR(10),

  -- 확정
  confirmed_at      TIMESTAMPTZ,
  confirmed_by      UUID REFERENCES public.user_profiles(id)
                      ON UPDATE CASCADE ON DELETE SET NULL,

  -- 추적
  created_by        UUID REFERENCES public.user_profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, student_id, school_year, subject_id, source)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_srsg_student_year
  ON public.student_record_setek_guides(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srsg_source_status
  ON public.student_record_setek_guides(source, status);

-- updated_at 자동 갱신 트리거 (프로젝트 패턴: 테이블별 전용 함수)
CREATE OR REPLACE FUNCTION public.update_setek_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_setek_guides_updated_at
  BEFORE UPDATE ON public.student_record_setek_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_setek_guides_updated_at();

-- RLS
ALTER TABLE public.student_record_setek_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srsg_tenant_read" ON public.student_record_setek_guides
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "srsg_tenant_write" ON public.student_record_setek_guides
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

COMMIT;
