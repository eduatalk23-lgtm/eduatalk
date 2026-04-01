-- Phase QA 확장: scientific_validity 컬럼 추가
-- ContentQualityScore 5축 평가 반영 (기존 4축에서 추가)

BEGIN;

ALTER TABLE public.student_record_content_quality
  ADD COLUMN IF NOT EXISTS scientific_validity SMALLINT
    CHECK (scientific_validity IS NULL OR scientific_validity BETWEEN 0 AND 5);

COMMENT ON COLUMN public.student_record_content_quality.scientific_validity
  IS '과학적 정합성 0-5: 개념 정확성, 논리적 비약 유무, 실험설계 타당성, 결론 비자명성';

-- overall_score 코멘트 갱신 (가중치 변경 반영)
COMMENT ON COLUMN public.student_record_content_quality.overall_score
  IS '종합 0-100: (specificity×25 + coherence×15 + depth×25 + grammar×10 + scientificValidity×25) / 5';

COMMIT;
