-- source 컬럼 VARCHAR(10) → VARCHAR(20) 확장
-- 트랙 A (2026-04-14) 1학년 prospective 플로우 검증 중 발견.
-- "ai_projected" (12자) 값을 저장하려다 22001 오류 발생.
-- 기존 레거시 스키마가 'ai' 기준 10자로 설계됐고 이후 variant 추가 시 확장 누락.
-- 예방적으로 동일 패턴 3개 테이블 전부 확장.

ALTER TABLE student_record_content_quality
  ALTER COLUMN source TYPE VARCHAR(20);

ALTER TABLE student_record_narrative_arc
  ALTER COLUMN source TYPE VARCHAR(20);

ALTER TABLE student_record_profile_cards
  ALTER COLUMN source TYPE VARCHAR(20);
