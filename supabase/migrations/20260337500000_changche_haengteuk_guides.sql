-- 창체/행특 방향 가이드 테이블
-- setek_guides 패턴 복제 (subject_id → activity_type)

BEGIN;

-- ============================================
-- 1. student_record_changche_guides
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_changche_guides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id)
                      ON UPDATE CASCADE ON DELETE CASCADE,
  school_year       INTEGER NOT NULL,
  activity_type     VARCHAR(20) NOT NULL
                      CHECK (activity_type IN ('autonomy', 'club', 'career')),

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

  UNIQUE(tenant_id, student_id, school_year, activity_type, source)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_srccg_student_year
  ON public.student_record_changche_guides(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srccg_source_status
  ON public.student_record_changche_guides(source, status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_changche_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_changche_guides_updated_at
  BEFORE UPDATE ON public.student_record_changche_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_changche_guides_updated_at();

-- RLS
ALTER TABLE public.student_record_changche_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srccg_tenant_read" ON public.student_record_changche_guides
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "srccg_tenant_write" ON public.student_record_changche_guides
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

-- ============================================
-- 2. student_record_haengteuk_guides
-- ============================================

CREATE TABLE IF NOT EXISTS public.student_record_haengteuk_guides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id)
                      ON UPDATE CASCADE ON DELETE CASCADE,
  school_year       INTEGER NOT NULL,

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

  -- 7개 평가항목 (자기주도성~규칙준수)
  evaluation_items  JSONB,

  -- 전체 방향
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

  UNIQUE(tenant_id, student_id, school_year, source)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_srhtg_student_year
  ON public.student_record_haengteuk_guides(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srhtg_source_status
  ON public.student_record_haengteuk_guides(source, status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_haengteuk_guides_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_haengteuk_guides_updated_at
  BEFORE UPDATE ON public.student_record_haengteuk_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_haengteuk_guides_updated_at();

-- RLS
ALTER TABLE public.student_record_haengteuk_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srhtg_tenant_read" ON public.student_record_haengteuk_guides
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "srhtg_tenant_write" ON public.student_record_haengteuk_guides
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_profiles
      WHERE id = (SELECT auth.uid())
    )
  );

COMMIT;
