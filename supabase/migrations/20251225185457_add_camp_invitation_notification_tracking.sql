-- Migration: Add notification tracking columns to camp_invitations
-- Purpose: Track notification status to enable retry and monitoring
-- Issue: #6 - Camp Notification Fire-and-Forget

-- Add notification tracking columns
ALTER TABLE camp_invitations
ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_attempts INTEGER DEFAULT 0;

-- Add index for finding failed notifications (for retry logic)
CREATE INDEX IF NOT EXISTS idx_camp_invitations_notification_status
ON camp_invitations(notification_status)
WHERE notification_status IN ('failed', 'pending');

-- Add comment for documentation
COMMENT ON COLUMN camp_invitations.notification_status IS
  'Notification status: pending, sending, sent, failed';
COMMENT ON COLUMN camp_invitations.notification_sent_at IS
  'Timestamp when notification was successfully sent';
COMMENT ON COLUMN camp_invitations.notification_error IS
  'Error message if notification failed';
COMMENT ON COLUMN camp_invitations.notification_attempts IS
  'Number of notification attempts made';
