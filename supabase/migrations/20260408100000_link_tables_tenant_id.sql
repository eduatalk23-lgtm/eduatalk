-- ============================================
-- D5: link 테이블 tenant_id 비정규화
--
-- storyline_links, reading_links에 tenant_id 추가.
-- RLS admin 정책을 직접 컬럼 체크로 단순화하여
-- 기존 EXISTS 서브쿼리 제거 → 배치 성능 개선.
-- ============================================

-- ─── 1. storyline_links ─────────────────────────────

-- 1-1. nullable로 추가
ALTER TABLE public.student_record_storyline_links
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 1-2. 부모 테이블에서 backfill
UPDATE public.student_record_storyline_links srl
SET tenant_id = s.tenant_id
FROM public.student_record_storylines s
WHERE srl.storyline_id = s.id
  AND srl.tenant_id IS NULL;

-- 1-3. NOT NULL 설정
ALTER TABLE public.student_record_storyline_links
  ALTER COLUMN tenant_id SET NOT NULL;

-- 1-4. 인덱스
CREATE INDEX IF NOT EXISTS idx_srsll_tenant
  ON public.student_record_storyline_links (tenant_id);

-- 1-5. RLS 정책 교체 (admin: EXISTS → 직접 컬럼)
DROP POLICY IF EXISTS "student_record_storyline_links_admin_all"
  ON public.student_record_storyline_links;

CREATE POLICY "student_record_storyline_links_admin_all"
  ON public.student_record_storyline_links FOR ALL
  USING (public.rls_check_admin_tenant((SELECT tenant_id)))
  WITH CHECK (public.rls_check_admin_tenant((SELECT tenant_id)));

-- student_select는 student_id가 link 테이블에 없으므로 EXISTS 유지
-- (student_id 비정규화는 범위 밖)


-- ─── 2. reading_links ───────────────────────────────

-- 2-1. nullable로 추가
ALTER TABLE public.student_record_reading_links
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2-2. 부모 테이블에서 backfill
UPDATE public.student_record_reading_links rl
SET tenant_id = r.tenant_id
FROM public.student_record_reading r
WHERE rl.reading_id = r.id
  AND rl.tenant_id IS NULL;

-- 2-3. NOT NULL 설정
ALTER TABLE public.student_record_reading_links
  ALTER COLUMN tenant_id SET NOT NULL;

-- 2-4. 인덱스
CREATE INDEX IF NOT EXISTS idx_srrl_tenant
  ON public.student_record_reading_links (tenant_id);

-- 2-5. RLS 정책 교체 (admin: EXISTS → 직접 컬럼)
DROP POLICY IF EXISTS "student_record_reading_links_admin_all"
  ON public.student_record_reading_links;

CREATE POLICY "student_record_reading_links_admin_all"
  ON public.student_record_reading_links FOR ALL
  USING (public.rls_check_admin_tenant((SELECT tenant_id)))
  WITH CHECK (public.rls_check_admin_tenant((SELECT tenant_id)));
