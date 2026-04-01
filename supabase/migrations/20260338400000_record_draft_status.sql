-- AI 초안/진단 생성 상태 추적 컬럼 추가
-- fire-and-forget 패턴으로 전환 시 Vercel 60초 타임아웃 방지
-- NULL=미생성, 'generating'=생성중, 'done'=완료, 'failed'=실패

-- 세특
ALTER TABLE public.student_record_seteks
  ADD COLUMN IF NOT EXISTS ai_draft_status TEXT
    CHECK (ai_draft_status IS NULL OR ai_draft_status IN ('generating', 'done', 'failed'));

-- 창체
ALTER TABLE public.student_record_changche
  ADD COLUMN IF NOT EXISTS ai_draft_status TEXT
    CHECK (ai_draft_status IS NULL OR ai_draft_status IN ('generating', 'done', 'failed'));

-- 행특
ALTER TABLE public.student_record_haengteuk
  ADD COLUMN IF NOT EXISTS ai_draft_status TEXT
    CHECK (ai_draft_status IS NULL OR ai_draft_status IN ('generating', 'done', 'failed'));

-- 종합진단: AI 생성 상태 (ai_generating=생성중, NULL=미생성/완료)
ALTER TABLE public.student_record_diagnosis
  ADD COLUMN IF NOT EXISTS ai_generating BOOLEAN DEFAULT FALSE;
