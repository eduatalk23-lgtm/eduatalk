-- α1-4: award record_type 확장
-- student_record_activity_tags, student_record_content_quality 두 테이블의
-- record_type CHECK에 'award' 추가.
--
-- 봉사(α1-2)와 동일 패턴:
--   - activity_tags: record_id = student_record_awards.id — competency 태깅
--     (community_leadership / career_exploration / academic_inquiry 등)
--   - content_quality: 수상 근거 설명문 품질 평가(있으면).
--   - competency_scores: 학년도 집계 단위라 record_type 없음 — 변경 불필요.
--
-- cleanup: student_record_awards DELETE 시 고아 activity_tags 정리.

BEGIN;

-- ============================================
-- 1. student_record_activity_tags.record_type CHECK 확장
-- ============================================

ALTER TABLE public.student_record_activity_tags
  DROP CONSTRAINT IF EXISTS student_record_activity_tags_record_type_check;

ALTER TABLE public.student_record_activity_tags
  ADD CONSTRAINT student_record_activity_tags_record_type_check
    CHECK (record_type IN (
      'setek', 'personal_setek', 'changche', 'haengteuk', 'volunteer', 'award'
    ));

-- ============================================
-- 2. student_record_content_quality.record_type CHECK 확장
-- ============================================

ALTER TABLE public.student_record_content_quality
  DROP CONSTRAINT IF EXISTS student_record_content_quality_record_type_check;

ALTER TABLE public.student_record_content_quality
  ADD CONSTRAINT student_record_content_quality_record_type_check
    CHECK (record_type IN (
      'setek', 'changche', 'haengteuk', 'personal_setek', 'volunteer', 'award'
    ));

-- ============================================
-- 3. cleanup_polymorphic_refs 트리거 등록 (함수 본체는 α1-2 에서 이미 generic TG_ARGV 처리)
-- ============================================

DROP TRIGGER IF EXISTS tr_award_cleanup_refs ON public.student_record_awards;
CREATE TRIGGER tr_award_cleanup_refs
  AFTER DELETE ON public.student_record_awards
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_polymorphic_refs('award');

COMMIT;
