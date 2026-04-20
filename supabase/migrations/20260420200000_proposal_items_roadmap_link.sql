-- α4 Proposal → 로드맵 자동 생성 링크 (2026-04-20)
-- ------------------------------------------------------------
-- 컨설턴트가 제안을 "수락" 하면 student_record_roadmap_items 에 row 가 자동 생성되고,
-- 역방향으로 proposal_items.roadmap_item_id 에 생성된 roadmap row id 를 링크.
-- ON DELETE SET NULL — 로드맵 row 가 지워져도 proposal 기록은 유지.

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS roadmap_item_id UUID
    REFERENCES public.student_record_roadmap_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.proposal_items.roadmap_item_id IS
  '컨설턴트 수락 시 자동 생성된 로드맵 row. null=아직 수락 전 또는 매핑 실패.';

-- 학생 수락율·활성 로드맵 조회용
CREATE INDEX IF NOT EXISTS idx_proposal_items_roadmap_item
  ON public.proposal_items (roadmap_item_id)
  WHERE roadmap_item_id IS NOT NULL;
