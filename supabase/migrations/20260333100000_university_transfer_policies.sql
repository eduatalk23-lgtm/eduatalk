-- ============================================================
-- 전과/복수전공 참조 테이블
-- 10개 주요 대학 정책 시드 데이터
-- ============================================================

CREATE TABLE IF NOT EXISTS public.university_transfer_policies (
  id serial PRIMARY KEY,
  university_name text NOT NULL,
  policy_type text NOT NULL CHECK (policy_type IN ('transfer', 'double_major', 'minor')),
  requirements text,
  gpa_threshold numeric(3,2),
  credit_threshold integer,
  restrictions text,
  notes text,
  source_url text,
  data_year integer NOT NULL DEFAULT 2026,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(university_name, policy_type, data_year)
);

ALTER TABLE public.university_transfer_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utp_select" ON public.university_transfer_policies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "utp_admin_all" ON public.university_transfer_policies
  FOR ALL TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

-- 시드: 10개 주요 대학 전과/복수전공 정책 참조
INSERT INTO public.university_transfer_policies (university_name, policy_type, requirements, gpa_threshold, credit_threshold, restrictions, notes, data_year)
VALUES
  -- 서울대학교
  ('서울대학교', 'transfer', '2학기 이상 이수, 소속 단과대학 승인', 3.30, 35, '의예/치의예/수의예/약학 전과 불가', '전과 인원 매우 제한적', 2026),
  ('서울대학교', 'double_major', '3학기 이상 이수, 제1전공 36학점 이상', 3.00, 36, '의예/치의예/수의예/약학 복수전공 불가', '자유전공학부는 복수전공 필수', 2026),
  -- 연세대학교
  ('연세대학교', 'transfer', '2학기 이상 이수', 3.00, 33, '의예/치의예/약학 전과 불가', '학부대학 → 전공진입 별도', 2026),
  ('연세대학교', 'double_major', '3학기 이상 이수', 2.50, 33, NULL, '비교적 자유로운 편', 2026),
  -- 고려대학교
  ('고려대학교', 'transfer', '2학기 이상 이수, 전과 시험', 3.00, 35, '의과대학/약학대학 전과 불가', '전과 시험 + 면접', 2026),
  ('고려대학교', 'double_major', '3학기 이상 이수', 2.70, 35, NULL, NULL, 2026),
  -- 성균관대학교
  ('성균관대학교', 'transfer', '2학기 이상 이수', 3.00, 33, '의예/약학 불가', '학과간 전과 비교적 자유', 2026),
  ('성균관대학교', 'double_major', '3학기 이상 이수', 2.50, 33, NULL, '자유로운 편, 인기학과 경쟁', 2026),
  -- 서강대학교
  ('서강대학교', 'transfer', '2학기 이상 이수', 3.00, 30, NULL, '자유전공 → 전공진입 별도', 2026),
  ('서강대학교', 'double_major', '2학기 이상 이수', 2.50, 30, NULL, '매우 자유로운 편', 2026),
  -- 한양대학교
  ('한양대학교', 'transfer', '2학기 이상 이수', 3.00, 35, '의예/약학 불가', NULL, 2026),
  ('한양대학교', 'double_major', '3학기 이상 이수', 2.70, 35, NULL, NULL, 2026),
  -- 중앙대학교
  ('중앙대학교', 'transfer', '2학기 이상 이수', 3.00, 33, NULL, NULL, 2026),
  ('중앙대학교', 'double_major', '3학기 이상 이수', 2.50, 33, NULL, NULL, 2026),
  -- 경희대학교
  ('경희대학교', 'transfer', '2학기 이상 이수', 3.00, 33, '의예/치의예/약학 불가', NULL, 2026),
  ('경희대학교', 'double_major', '3학기 이상 이수', 2.50, 33, NULL, NULL, 2026),
  -- 이화여자대학교
  ('이화여자대학교', 'transfer', '2학기 이상 이수', 3.00, 33, '의예/약학 불가', '호크마교양대학 → 전공진입 별도', 2026),
  ('이화여자대학교', 'double_major', '3학기 이상 이수', 2.50, 33, NULL, NULL, 2026),
  -- 서울시립대학교
  ('서울시립대학교', 'transfer', '2학기 이상 이수', 3.00, 30, NULL, '전과 인원 제한적', 2026),
  ('서울시립대학교', 'double_major', '3학기 이상 이수', 2.50, 30, NULL, NULL, 2026)
ON CONFLICT (university_name, policy_type, data_year) DO NOTHING;
