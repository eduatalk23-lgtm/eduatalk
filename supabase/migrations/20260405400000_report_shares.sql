-- ============================================
-- F3-3: 리포트 공유 테이블
-- 가이드 공유(exploration_guide_shares) 패턴 복제
-- report_data: 공유 생성 시점의 리포트 스냅샷 (JSONB)
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.report_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE,
  share_token   uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  visible_sections text[] NOT NULL DEFAULT '{}',
  report_data   jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_report_shares_token ON public.report_shares(share_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_shares_student ON public.report_shares(student_id);

-- RLS
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (활성 공유만)
CREATE POLICY "report_shares_public_read"
  ON public.report_shares FOR SELECT
  USING (is_active = true);

-- admin/consultant만 생성
CREATE POLICY "report_shares_admin_insert"
  ON public.report_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  );

-- admin/consultant만 수정 (비활성화 등)
CREATE POLICY "report_shares_admin_update"
  ON public.report_shares FOR UPDATE
  TO authenticated
  USING (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  )
  WITH CHECK (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  );

-- admin/consultant만 삭제
CREATE POLICY "report_shares_admin_delete"
  ON public.report_shares FOR DELETE
  TO authenticated
  USING (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  );

COMMIT;
