-- ============================================
-- D1: 학부모(parent) SELECT RLS 일괄 추가
--
-- 학부모 역할이 자녀 데이터를 조회할 수 있도록
-- 누락된 테이블에 parent SELECT 정책 추가.
--
-- 패턴: rls_check_parent_student(student_id)
--   → parent_student_links 테이블에서 parent_id = auth.uid() 확인
--
-- 제외:
--   analysis_cache      — 내부 LLM 캐시 (학부모 열람 불필요)
--   analysis_pipelines  — 내부 파이프라인 상태
--   diagnosis_snapshots — 내부 스냅샷
--   edge_snapshots      — 내부 스냅샷
--   disciplinary        — 의도적 제외 (학생/학부모 직접 열람 불가)
-- ============================================

-- ─── 1. interview_questions (면접 예상 질문) ────────
CREATE POLICY "sriq_parent_select"
  ON public.student_record_interview_questions FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 2. content_quality (5축 품질 점수) ─────────────
CREATE POLICY "srcq_parent_select"
  ON public.student_record_content_quality FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 3. edges (레코드 간 연결 그래프) ───────────────
CREATE POLICY "sre_parent_select"
  ON public.student_record_edges FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 4. setek_guides (세특 방향 가이드) ─────────────
CREATE POLICY "srsg_parent_select"
  ON public.student_record_setek_guides FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 5. changche_guides (창체 방향 가이드) ──────────
CREATE POLICY "srcg_parent_select"
  ON public.student_record_changche_guides FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 6. haengteuk_guides (행특 방향 가이드) ─────────
CREATE POLICY "srhg_parent_select"
  ON public.student_record_haengteuk_guides FOR SELECT
  USING (public.rls_check_parent_student((SELECT student_id)));

-- ─── 7. storyline_links (활동↔스토리라인 연결) ──────
-- student_id 없음 → 부모 테이블 JOIN 필요
CREATE POLICY "srsll_parent_select"
  ON public.student_record_storyline_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_storylines s
      WHERE s.id = storyline_id
        AND public.rls_check_parent_student(s.student_id)
    )
  );

-- ─── 8. reading_links (독서↔세특 연결) ─────────────
-- student_id 없음 → 부모 테이블 JOIN 필요
CREATE POLICY "srrl_parent_select"
  ON public.student_record_reading_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_record_reading r
      WHERE r.id = reading_id
        AND public.rls_check_parent_student(r.student_id)
    )
  );

-- ─── 9. activity_summaries 확인 (이미 존재) ────────
-- sras_parent_select: 이미 20260404200000_student_record_activity_summaries.sql에 존재
