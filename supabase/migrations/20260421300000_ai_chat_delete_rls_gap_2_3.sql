-- ============================================
-- Phase G-6 Sprint 1 (2026-04-21): AI-Chat DELETE RLS 정책 보강.
--
-- 기존 ai_artifacts / ai_artifact_versions / ai_subagent_runs 는 SELECT/INSERT/
-- UPDATE 만 정책이 있어, RLS 활성화에도 불구하고 admin client 우회 경로에서
-- cross-tenant DELETE 가 허용되는 허점(Gap #2 / #3).
--
-- ai_artifact_versions 는 append-only 원칙 — DELETE 차단이 정합. 정책 없음으로
-- 유지하되(RLS 기본 deny), 명시적 가드 주석 추가.
--
-- ai_artifacts 는 대화 삭제(ON DELETE CASCADE) 외의 직접 삭제를 tenant JWT
-- 검증으로 제한. ai_subagent_runs 는 감사 이력 — DELETE 차단(정책 없음)이 권장
-- 이지만 tenant 내부 정리(GDPR 등)를 위해 JWT 검증 하에 허용.
-- ============================================

-- ── ai_artifacts: DELETE 정책. tenant JWT 일치 + 같은 초기 정책 패턴 ──
CREATE POLICY "ai_artifacts_delete" ON public.ai_artifacts
  FOR DELETE USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

COMMENT ON POLICY "ai_artifacts_delete" ON public.ai_artifacts IS
  'Phase G-6: tenant 내부 직접 삭제만 허용. 대화 삭제 시 CASCADE 와 병행.';

-- ── ai_artifact_versions: DELETE 정책 없음(=append-only 보장). 주석만 추가 ──
COMMENT ON TABLE public.ai_artifact_versions IS
  'append-only 버전 체인. RLS DELETE 정책 없음(기본 deny) → admin client 로도 직접 삭제 차단. artifact ON DELETE CASCADE 로만 정리됨.';

-- ── ai_subagent_runs: DELETE 정책. tenant JWT 일치 ──
CREATE POLICY "subagent_runs_delete" ON public.ai_subagent_runs
  FOR DELETE USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

COMMENT ON POLICY "subagent_runs_delete" ON public.ai_subagent_runs IS
  'Phase G-6: tenant 내부 감사 이력 정리(GDPR 등) 허용. JWT tenant 일치 필수.';
