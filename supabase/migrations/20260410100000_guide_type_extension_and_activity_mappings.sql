-- ============================================
-- Phase 2 Wave 1.1: 탐구 가이드 3종 신규 유형 추가 + 창체 영역 매핑 테이블 신설
--
-- Decision #2 (Hybrid with Bounded AI Generation) + Decision #5 연계.
--
-- 1) exploration_guides.guide_type CHECK 확장:
--    기존 5종 (reading/topic_exploration/subject_performance/experiment/program) +
--    신규 3종 (reflection_program/club_deep_dive/career_exploration_project)
--
-- 2) exploration_guide_activity_mappings 테이블 신설:
--    창체 활동 유형(autonomy/club/career) ↔ 가이드 매핑.
--    기존 subject_mappings, classification_mappings, career_mappings 패턴과 동일.
--    RLS: guide_access 정책 재사용.
-- ============================================

-- 1. guide_type CHECK 제약 확장
ALTER TABLE public.exploration_guides
  DROP CONSTRAINT IF EXISTS exploration_guides_guide_type_check;

ALTER TABLE public.exploration_guides
  ADD CONSTRAINT exploration_guides_guide_type_check
  CHECK (guide_type IN (
    'reading',
    'topic_exploration',
    'subject_performance',
    'experiment',
    'program',
    'reflection_program',          -- 창체 자율·자치: 학교 프로그램 + 인문학적 성찰
    'club_deep_dive',              -- 창체 동아리: 전공 심화 + 지속성
    'career_exploration_project'   -- 창체 진로: 자기주도 조사·탐색
  ));

COMMENT ON COLUMN public.exploration_guides.guide_type IS
  '가이드 유형 — 세특 5종(reading/topic_exploration/subject_performance/experiment/program) + 창체 3종(reflection_program/club_deep_dive/career_exploration_project). Phase 2 Wave 1.1에서 창체 3종 추가.';

-- 2. exploration_guide_activity_mappings 테이블 생성
CREATE TABLE IF NOT EXISTS public.exploration_guide_activity_mappings (
  guide_id uuid NOT NULL REFERENCES public.exploration_guides(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('autonomy', 'club', 'career')),
  PRIMARY KEY (guide_id, activity_type)
);

COMMENT ON TABLE public.exploration_guide_activity_mappings IS
  '탐구 가이드 ↔ 창체 활동 유형 매핑. autonomy(자율·자치)/club(동아리)/career(진로). runGuideMatching이 학생의 창체 슬롯에 가이드를 배정할 때 사용.';

-- 인덱스: activity_type 기반 빠른 조회
CREATE INDEX IF NOT EXISTS idx_exploration_guide_activity_mappings_activity_type
  ON public.exploration_guide_activity_mappings (activity_type);

-- RLS 활성화
ALTER TABLE public.exploration_guide_activity_mappings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: guide 접근 권한 상속 (subject_mappings 패턴과 동일)
DROP POLICY IF EXISTS egam_access ON public.exploration_guide_activity_mappings;
CREATE POLICY egam_access ON public.exploration_guide_activity_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exploration_guides g
      WHERE g.id = exploration_guide_activity_mappings.guide_id
        AND rls_check_guide_access(g.tenant_id)
    )
  );
