-- ============================================================
-- 기존 가이드 subject_area 역추적 backfill
--
-- subject_groups.name이 기준 (UI 드롭다운과 일치)
-- curriculum_units.subject_area는 "~과" 접미사가 붙어 불일치하므로
-- subject_groups 경로를 우선 사용
-- ============================================================

-- 경로 1 (우선): subject_groups 기반 backfill
-- exploration_guide_subject_mappings → subjects → subject_groups
UPDATE exploration_guides g
SET subject_area = sg.name
FROM exploration_guide_subject_mappings m
JOIN subjects s ON s.id = m.subject_id
JOIN subject_groups sg ON sg.id = s.subject_group_id
WHERE g.id = m.guide_id
  AND g.subject_area IS NULL
  AND g.subject_select IS NOT NULL;

-- 경로 2 (fallback): curriculum_units 기반 + 정규화
-- "~과" 접미사를 subject_groups.name으로 변환
UPDATE exploration_guides g
SET subject_area = COALESCE(sg.name, cu.subject_area)
FROM (
  SELECT DISTINCT ON (subject_name)
    subject_name,
    subject_area
  FROM exploration_guide_curriculum_units
  ORDER BY subject_name, curriculum_year DESC
) cu
LEFT JOIN subjects s ON s.name = cu.subject_name
LEFT JOIN subject_groups sg ON sg.id = s.subject_group_id
WHERE g.subject_select = cu.subject_name
  AND g.subject_area IS NULL
  AND g.subject_select IS NOT NULL;

-- 경로 3: 버전 체인 내 형제 버전에서 subject_area 복사
UPDATE exploration_guides g
SET subject_area = sibling.subject_area
FROM (
  SELECT DISTINCT ON (original_guide_id)
    original_guide_id,
    subject_area
  FROM exploration_guides
  WHERE subject_area IS NOT NULL
    AND original_guide_id IS NOT NULL
  ORDER BY original_guide_id, version DESC
) sibling
WHERE g.original_guide_id = sibling.original_guide_id
  AND g.subject_area IS NULL;

-- 원본→파생 복사
UPDATE exploration_guides g
SET subject_area = origin.subject_area
FROM exploration_guides origin
WHERE g.original_guide_id = origin.id
  AND g.subject_area IS NULL
  AND origin.subject_area IS NOT NULL;

-- 경로 4: subject_select/subject_area 둘 다 없는 가이드
UPDATE exploration_guides g
SET
  subject_area = sg.name,
  subject_select = s.name
FROM exploration_guide_subject_mappings m
JOIN subjects s ON s.id = m.subject_id
JOIN subject_groups sg ON sg.id = s.subject_group_id
WHERE g.id = m.guide_id
  AND g.subject_area IS NULL
  AND g.subject_select IS NULL;

-- 정규화: curriculum_units 출처의 "~과" 접미사 잔여 정리
UPDATE exploration_guides SET subject_area = '과학' WHERE subject_area = '과학과';
UPDATE exploration_guides SET subject_area = '국어' WHERE subject_area = '국어과';
UPDATE exploration_guides SET subject_area = '수학' WHERE subject_area = '수학과';
UPDATE exploration_guides SET subject_area = '영어' WHERE subject_area = '영어과';
UPDATE exploration_guides SET subject_area = '사회(역사/도덕 포함)' WHERE subject_area IN ('사회과', '도덕과');
UPDATE exploration_guides SET subject_area = '기술·가정/정보' WHERE subject_area = '정보과';

-- 확인 로깅
DO $$
DECLARE
  total INT; filled INT; remaining INT;
BEGIN
  SELECT COUNT(*) INTO total FROM exploration_guides;
  SELECT COUNT(*) INTO filled FROM exploration_guides WHERE subject_area IS NOT NULL;
  SELECT COUNT(*) INTO remaining FROM exploration_guides WHERE subject_area IS NULL AND subject_select IS NOT NULL;
  RAISE NOTICE 'backfill 완료 — 전체: %건, 교과 있음: %건, 교과 없음(과목 있음): %건', total, filled, remaining;
END $$;
