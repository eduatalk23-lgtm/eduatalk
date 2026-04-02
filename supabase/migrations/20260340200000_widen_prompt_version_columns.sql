-- prompt_version VARCHAR(10) → VARCHAR(40)
-- 기존 값 "guide_v1_prospective" (20자), "changche_guide_v1_prospective" (29자),
-- "haengteuk_guide_v1_prospective" (30자) 등이 VARCHAR(10) 제한 초과로 INSERT 실패
-- 3개 가이드 테이블 일괄 확장

BEGIN;

ALTER TABLE public.student_record_setek_guides
  ALTER COLUMN prompt_version TYPE VARCHAR(40);

ALTER TABLE public.student_record_changche_guides
  ALTER COLUMN prompt_version TYPE VARCHAR(40);

ALTER TABLE public.student_record_haengteuk_guides
  ALTER COLUMN prompt_version TYPE VARCHAR(40);

COMMIT;
