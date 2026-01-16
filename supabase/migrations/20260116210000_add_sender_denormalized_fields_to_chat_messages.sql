-- Add denormalized sender fields to chat_messages
-- These cache the sender name and profile URL at message creation time
-- This avoids expensive JOIN queries when fetching messages

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS sender_name text DEFAULT '사용자',
ADD COLUMN IF NOT EXISTS sender_profile_url text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN chat_messages.sender_name IS 'Denormalized sender name (snapshot at message creation)';
COMMENT ON COLUMN chat_messages.sender_profile_url IS 'Denormalized sender profile image URL (snapshot at message creation)';

-- Create index for potential searches by sender name
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_name ON chat_messages(sender_name)
WHERE sender_name IS NOT NULL AND is_deleted = false;
