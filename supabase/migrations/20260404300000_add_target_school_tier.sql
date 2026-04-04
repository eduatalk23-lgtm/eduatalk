-- 학생 목표 학교권 컬럼 추가 (설계 모드 레벨링 L0)
-- 값: sky_plus | in_seoul | regional | general | NULL
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS target_school_tier text;

COMMENT ON COLUMN students.target_school_tier
  IS '목표 학교권: sky_plus(SKY+상위), in_seoul(인서울), regional(지방거점), general(일반). 레벨링 엔진 입력.';
