-- ============================================================
-- Phase C: 진로 분류 체계 통합 — 가이드 계열 정규화 + 소분류 태깅
--
-- 1. exploration_guide_career_fields: 영문 코드 → KEDI 코드
-- 2. 'medical' 중복 제거 (= medicine → MED)
-- 3. exploration_guide_classification_mappings 테이블 생성
-- ============================================================

BEGIN;

-- ============================================================
-- 1. exploration_guide_career_fields 정규화
-- ============================================================

-- 1a. 기존 영문 코드 → KEDI 코드로 업데이트
UPDATE exploration_guide_career_fields SET code = 'ENG', name_kor = '공학계열' WHERE code = 'engineering';
UPDATE exploration_guide_career_fields SET code = 'EDU', name_kor = '교육계열' WHERE code = 'education';
UPDATE exploration_guide_career_fields SET code = 'SOC', name_kor = '사회계열' WHERE code = 'social_sciences';
UPDATE exploration_guide_career_fields SET code = 'ART', name_kor = '예체능계열' WHERE code = 'arts_pe';
UPDATE exploration_guide_career_fields SET code = 'MED', name_kor = '의약계열' WHERE code = 'medicine';
UPDATE exploration_guide_career_fields SET code = 'HUM', name_kor = '인문계열' WHERE code = 'humanities';
UPDATE exploration_guide_career_fields SET code = 'NAT', name_kor = '자연계열' WHERE code = 'natural_sciences';

-- 1b. 'medical' = 'medicine' 중복 → MED에 통합
-- 먼저 매핑 이전: medical의 매핑을 MED로 옮기기
INSERT INTO exploration_guide_career_mappings (guide_id, career_field_id)
SELECT m.guide_id, (SELECT id FROM exploration_guide_career_fields WHERE code = 'MED')
FROM exploration_guide_career_mappings m
WHERE m.career_field_id = (SELECT id FROM exploration_guide_career_fields WHERE code = 'medical')
  AND NOT EXISTS (
    SELECT 1 FROM exploration_guide_career_mappings existing
    WHERE existing.guide_id = m.guide_id
      AND existing.career_field_id = (SELECT id FROM exploration_guide_career_fields WHERE code = 'MED')
  );

-- 매핑 삭제 후 행 삭제
DELETE FROM exploration_guide_career_mappings
WHERE career_field_id = (SELECT id FROM exploration_guide_career_fields WHERE code = 'medical');

DELETE FROM exploration_guide_career_fields WHERE code = 'medical';

-- 1c. sort_order 재정렬
UPDATE exploration_guide_career_fields SET sort_order = 1 WHERE code = 'HUM';
UPDATE exploration_guide_career_fields SET sort_order = 2 WHERE code = 'SOC';
UPDATE exploration_guide_career_fields SET sort_order = 3 WHERE code = 'EDU';
UPDATE exploration_guide_career_fields SET sort_order = 4 WHERE code = 'ENG';
UPDATE exploration_guide_career_fields SET sort_order = 5 WHERE code = 'NAT';
UPDATE exploration_guide_career_fields SET sort_order = 6 WHERE code = 'MED';
UPDATE exploration_guide_career_fields SET sort_order = 7 WHERE code = 'ART';
UPDATE exploration_guide_career_fields SET sort_order = 8 WHERE code = 'all_fields';
UPDATE exploration_guide_career_fields SET sort_order = 9 WHERE code = 'unclassified';

-- ============================================================
-- 2. exploration_guide_classification_mappings (가이드 ↔ KEDI 소분류)
-- ============================================================

CREATE TABLE IF NOT EXISTS exploration_guide_classification_mappings (
  id serial PRIMARY KEY,
  guide_id uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  classification_id int NOT NULL REFERENCES department_classification(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guide_id, classification_id)
);

COMMENT ON TABLE exploration_guide_classification_mappings IS '탐구 가이드 ↔ KEDI 소분류(department_classification) 태깅';

CREATE INDEX IF NOT EXISTS idx_egclm_classification
  ON exploration_guide_classification_mappings(classification_id);

-- RLS
ALTER TABLE exploration_guide_classification_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egclm_select" ON exploration_guide_classification_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "egclm_admin" ON exploration_guide_classification_mappings
  FOR ALL TO authenticated
  USING (public.rls_check_is_admin_or_consultant())
  WITH CHECK (public.rls_check_is_admin_or_consultant());

COMMIT;
