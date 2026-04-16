-- ============================================
-- Blueprint-Axis: hyperedge edge_context 확장
-- 기존: 'analysis', 'projected', 'synthesis_inferred'
-- 추가: 'blueprint' (top-down 설계), 'bridge' (gap→action)
-- ============================================

-- 1. student_record_hyperedges — edge_context CHECK 확장
ALTER TABLE public.student_record_hyperedges
  DROP CONSTRAINT IF EXISTS student_record_hyperedges_context_check;
ALTER TABLE public.student_record_hyperedges
  ADD CONSTRAINT student_record_hyperedges_context_check
  CHECK (edge_context IN (
    'analysis',
    'projected',
    'synthesis_inferred',
    'blueprint',
    'bridge'
  ));

-- 2. blueprint 전용 partial unique index
-- 학생 + blueprint context 내에서 동일 theme_slug 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_hyperedges_unique_blueprint
  ON public.student_record_hyperedges
  (student_id, hyperedge_type, theme_slug, edge_context)
  WHERE edge_context = 'blueprint' AND is_stale = FALSE;

-- 3. bridge 전용 partial unique index
-- 학생 + bridge context 내에서 동일 theme_slug 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_hyperedges_unique_bridge
  ON public.student_record_hyperedges
  (student_id, hyperedge_type, theme_slug, edge_context)
  WHERE edge_context = 'bridge' AND is_stale = FALSE;

-- 4. blueprint/bridge 조회 인덱스 (Gap Tracker에서 둘 다 조회)
CREATE INDEX IF NOT EXISTS idx_hyperedges_blueprint_bridge
  ON public.student_record_hyperedges(student_id, edge_context)
  WHERE edge_context IN ('blueprint', 'bridge') AND is_stale = FALSE;

-- 주석
COMMENT ON CONSTRAINT student_record_hyperedges_context_check
  ON public.student_record_hyperedges IS
  '5종 context: analysis(bottom-up 실측), projected(설계 가안), synthesis_inferred(S3 동적 추론), blueprint(top-down 설계 목표), bridge(gap→action 제안)';
