-- Add metadata JSONB column to chat_messages for extensible features (mentions, etc.)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN chat_messages.metadata IS 'Extensible metadata: mentions, etc. Example: {"mentions": [{"userId": "...", "userType": "student", "name": "홍길동"}]}';
