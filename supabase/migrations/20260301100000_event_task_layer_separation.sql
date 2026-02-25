-- Event + Task Layer Separation
-- calendar_events.status에서 'completed' 분리 → event_study_data.done으로 이동
-- 이벤트 상태(confirmed/tentative/cancelled)와 할일 완료(done)를 독립적으로 관리

BEGIN;

-- ============================================
-- 1. calendar_events에 is_task 컬럼 추가
-- ============================================
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS is_task boolean NOT NULL DEFAULT false;

-- study/custom 이벤트는 자동으로 task 설정
UPDATE calendar_events SET is_task = true WHERE event_type IN ('study', 'custom');

-- ============================================
-- 2. event_study_data에 done 필드 추가
-- ============================================
ALTER TABLE event_study_data
  ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS done_by text;

-- 기존 완료 데이터 → done으로 마이그레이션
UPDATE event_study_data
SET
  done = true,
  done_at = COALESCE(simple_completed_at, completed_at, now())
WHERE completion_status = 'completed' OR simple_completion = true;

-- ============================================
-- 3. calendar_events.status에서 'completed' → 'confirmed' 전환
-- ============================================
UPDATE calendar_events
SET status = 'confirmed'
WHERE status = 'completed';

-- ============================================
-- 4. CHECK 제약 조건 갱신 (completed 제거)
-- ============================================
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS chk_event_status;
ALTER TABLE calendar_events
  ADD CONSTRAINT chk_event_status CHECK (status IN ('confirmed', 'tentative', 'cancelled'));

-- ============================================
-- 5. event_study_data 레거시 컬럼 삭제
-- ============================================
ALTER TABLE event_study_data DROP CONSTRAINT IF EXISTS chk_study_completion_status;
ALTER TABLE event_study_data DROP COLUMN IF EXISTS completion_status;
ALTER TABLE event_study_data DROP COLUMN IF EXISTS simple_completion;
ALTER TABLE event_study_data DROP COLUMN IF EXISTS simple_completed_at;
ALTER TABLE event_study_data DROP COLUMN IF EXISTS completed_at;

-- ============================================
-- 6. 인덱스 갱신
-- ============================================
DROP INDEX IF EXISTS idx_calendar_events_unfinished;
CREATE INDEX idx_calendar_events_unfinished
  ON calendar_events (calendar_id, start_at)
  WHERE status != 'cancelled' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_study_data_done
  ON event_study_data (event_id)
  WHERE done = false;

COMMIT;
