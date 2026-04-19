-- α1-2: volunteer record_type 확장
-- student_record_activity_tags, student_record_competency_scores(해당 없음 — record_type 컬럼 없음),
-- student_record_content_quality 세 테이블의 record_type CHECK에 'volunteer' 추가.
--
-- 봉사 분석 결과(activity_tags, content_quality)는 봉사 행 ID를 record_id로 사용.
-- competency_scores는 학년도(school_year) 집계 row 1건 — record_type 컬럼 없으므로 변경 불필요.
-- cleanup_polymorphic_refs 트리거: volunteer는 student_record_volunteer에 자체 polymorphic 참조 없음
--   → activity_tags/content_quality 삭제는 deleteAnalysisResultsByGrade에서 volunteer id 기반 삭제.
--   → volunteer 행 DELETE 시 activity_tags 고아 정리 트리거 추가.

BEGIN;

-- ============================================================
-- 1. student_record_activity_tags.record_type CHECK 확장
-- ============================================================

ALTER TABLE public.student_record_activity_tags
  DROP CONSTRAINT IF EXISTS student_record_activity_tags_record_type_check;

ALTER TABLE public.student_record_activity_tags
  ADD CONSTRAINT student_record_activity_tags_record_type_check
    CHECK (record_type IN (
      'setek', 'personal_setek', 'changche', 'haengteuk', 'volunteer'
    ));

-- ============================================================
-- 2. student_record_content_quality.record_type CHECK 확장
-- ============================================================

ALTER TABLE public.student_record_content_quality
  DROP CONSTRAINT IF EXISTS student_record_content_quality_record_type_check;

ALTER TABLE public.student_record_content_quality
  ADD CONSTRAINT student_record_content_quality_record_type_check
    CHECK (record_type IN (
      'setek', 'changche', 'haengteuk', 'personal_setek', 'volunteer'
    ));

-- ============================================================
-- 3. cleanup_polymorphic_refs 확장
--    student_record_volunteer DELETE 시 activity_tags 고아 정리.
--    volunteer 행에 대한 cleanup 트리거는 신규이므로 트리거 함수(cleanup_polymorphic_refs)
--    에 'volunteer' 경로를 추가하고 트리거를 등록한다.
--    content_quality는 코어 레코드 소프트 삭제 정책상 정리 대상 아님(기존 설계 동일).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_polymorphic_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- activity_tags (Phase 5 + α1-2: volunteer 포함)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_activity_tags'
  ) THEN
    DELETE FROM public.student_record_activity_tags
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- storyline_links (Phase 1c)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_storyline_links'
  ) THEN
    DELETE FROM public.student_record_storyline_links
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  -- reading_links (Phase 1c, setek/personal_setek/changche만 해당)
  IF TG_ARGV[0] IN ('setek', 'personal_setek', 'changche') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'student_record_reading_links'
    ) THEN
      DELETE FROM public.student_record_reading_links
        WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
    END IF;
  END IF;

  -- narrative_arc (Phase 2)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_record_narrative_arc'
  ) THEN
    DELETE FROM public.student_record_narrative_arc
      WHERE record_type = TG_ARGV[0] AND record_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.cleanup_polymorphic_refs IS
  '다형 참조(record_type+record_id) 고아 정리 트리거 — activity_tags, storyline_links, reading_links, narrative_arc, volunteer(α1-2)';

-- volunteer 행 DELETE 시 activity_tags 정리 트리거 등록 (content_quality는 정책상 제외)
DROP TRIGGER IF EXISTS tr_volunteer_cleanup_refs ON public.student_record_volunteer;
CREATE TRIGGER tr_volunteer_cleanup_refs
  AFTER DELETE ON public.student_record_volunteer
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('volunteer');

COMMIT;
