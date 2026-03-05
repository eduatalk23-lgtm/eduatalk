-- Stage 1: event_type → label + is_exclusion (Additive Only, 롤백 가능)
-- event_type/event_subtype 컬럼은 유지한 채 새 컬럼만 추가

BEGIN;

-- 1. 새 컬럼 추가
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_exclusion BOOLEAN NOT NULL DEFAULT false;

-- 2. label 데이터 채우기 (event_subtype 우선, 없으면 event_type 매핑)
UPDATE calendar_events SET label = COALESCE(
  NULLIF(event_subtype, ''),
  CASE event_type
    WHEN 'study' THEN '학습'
    WHEN 'custom' THEN '일반'
    WHEN 'break' THEN '휴식'
    WHEN 'focus_time' THEN '집중 시간'
    WHEN 'exclusion' THEN '제외일'
    WHEN 'non_study' THEN '기타'
    WHEN 'academy' THEN '학원'
    ELSE '기타'
  END
);

-- 3. is_exclusion 채우기
UPDATE calendar_events SET is_exclusion = true WHERE event_type = 'exclusion';

-- 3-1. study 이벤트 중 is_task가 false인 경우 true로 수정
UPDATE calendar_events SET is_task = true WHERE event_type = 'study' AND is_task = false;

-- 3-2. custom 이벤트는 기본 is_task = true (사용자 생성 커스텀 태스크)
UPDATE calendar_events SET is_task = true WHERE event_type = 'custom';

-- 3-3. custom 이벤트 중 실제 비학습 항목은 title 패턴 기반으로 재분류
UPDATE calendar_events SET is_task = false, label = '학원'
WHERE event_type = 'custom' AND (title LIKE '%[학원]%' OR title LIKE '%학원%');

UPDATE calendar_events SET is_task = false, label = '점심식사'
WHERE event_type = 'custom' AND (title LIKE '%점심시간%' OR title LIKE '%점심식사%');

UPDATE calendar_events SET is_task = false, label = '저녁식사'
WHERE event_type = 'custom' AND (title LIKE '%저녁시간%' OR title LIKE '%저녁식사%');

-- 4. label NOT NULL
ALTER TABLE calendar_events ALTER COLUMN label SET NOT NULL;

-- 5. auto_create_event_study_data 트리거 비활성화 (event_type 의존 제거)
CREATE OR REPLACE FUNCTION auto_create_event_study_data()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW; -- no-op, 앱 코드에서 명시적으로 관리
END;
$$ LANGUAGE plpgsql;

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_cal_events_is_exclusion ON calendar_events (is_exclusion) WHERE deleted_at IS NULL AND is_exclusion = true;
CREATE INDEX IF NOT EXISTS idx_cal_events_label ON calendar_events (label) WHERE deleted_at IS NULL;

COMMIT;
