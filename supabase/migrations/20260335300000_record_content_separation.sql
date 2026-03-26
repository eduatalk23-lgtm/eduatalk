-- Phase 2.5b: 기록 테이블 content 4분할
-- AI초안(ai_draft_content) / 컨설턴트가안(content) / 확정(confirmed_content) / 실생기부(imported_content)
-- 대상: seteks, changche, haengteuk, personal_seteks

BEGIN;

-- =============================================
-- 1. student_record_seteks
-- =============================================
ALTER TABLE public.student_record_seteks
  ADD COLUMN IF NOT EXISTS ai_draft_content TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_content TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_content TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE public.student_record_seteks
  ADD COLUMN IF NOT EXISTS imported_content_bytes INTEGER
    GENERATED ALWAYS AS (octet_length(imported_content)) STORED;

-- 기존 데이터 보정: content가 있는 레코드는 imported_content에도 복사
UPDATE public.student_record_seteks
SET imported_content = content, imported_at = updated_at
WHERE content != '' AND imported_content IS NULL;

-- =============================================
-- 2. student_record_changche
-- =============================================
ALTER TABLE public.student_record_changche
  ADD COLUMN IF NOT EXISTS ai_draft_content TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_content TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_content TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE public.student_record_changche
  ADD COLUMN IF NOT EXISTS imported_content_bytes INTEGER
    GENERATED ALWAYS AS (octet_length(imported_content)) STORED;

UPDATE public.student_record_changche
SET imported_content = content, imported_at = updated_at
WHERE content != '' AND imported_content IS NULL;

-- =============================================
-- 3. student_record_haengteuk
-- =============================================
ALTER TABLE public.student_record_haengteuk
  ADD COLUMN IF NOT EXISTS ai_draft_content TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_content TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_content TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE public.student_record_haengteuk
  ADD COLUMN IF NOT EXISTS imported_content_bytes INTEGER
    GENERATED ALWAYS AS (octet_length(imported_content)) STORED;

UPDATE public.student_record_haengteuk
SET imported_content = content, imported_at = updated_at
WHERE content != '' AND imported_content IS NULL;

-- =============================================
-- 4. student_record_personal_seteks
-- (NEIS 임포트 없지만 타입 일관성 위해 동일 컬럼 추가)
-- =============================================
ALTER TABLE public.student_record_personal_seteks
  ADD COLUMN IF NOT EXISTS ai_draft_content TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_content TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_content TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE public.student_record_personal_seteks
  ADD COLUMN IF NOT EXISTS imported_content_bytes INTEGER
    GENERATED ALWAYS AS (octet_length(imported_content)) STORED;

COMMIT;
