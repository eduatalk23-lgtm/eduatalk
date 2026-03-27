-- Phase R3: 로드맵 아이템 진행 상태 추적
-- planning → confirmed → in_progress → completed

-- status 컬럼 추가 (기본값: planning)
ALTER TABLE public.student_record_roadmap_items
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'planning'
  CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed'));

-- 기존 데이터: execution_content가 있으면 completed, 없으면 planning
UPDATE public.student_record_roadmap_items
SET status = CASE
  WHEN execution_content IS NOT NULL AND execution_content != '' THEN 'completed'
  ELSE 'planning'
END;

-- 인덱스: 상태별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_srri_status
  ON public.student_record_roadmap_items (student_id, status);

-- down
-- ALTER TABLE public.student_record_roadmap_items DROP COLUMN IF EXISTS status;
-- DROP INDEX IF EXISTS idx_srri_status;
