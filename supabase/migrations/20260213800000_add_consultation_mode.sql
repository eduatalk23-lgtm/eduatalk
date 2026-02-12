-- ============================================================
-- 원격 상담 지원: consultation_mode + meeting_link 추가
-- ============================================================

ALTER TABLE consultation_schedules
  ADD COLUMN IF NOT EXISTS consultation_mode TEXT NOT NULL DEFAULT '대면'
    CHECK (consultation_mode IN ('대면', '원격')),
  ADD COLUMN IF NOT EXISTS meeting_link TEXT;
