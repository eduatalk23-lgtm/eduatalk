-- Migration: Add trigger to auto-update chat_rooms.updated_at on new message
-- This eliminates the need for a separate UPDATE query in application code

-- Create function to update chat_room updated_at
CREATE OR REPLACE FUNCTION update_chat_room_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms
  SET updated_at = NOW()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on chat_messages table
DROP TRIGGER IF EXISTS trg_chat_message_update_room ON chat_messages;
CREATE TRIGGER trg_chat_message_update_room
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_room_on_message();

-- Add comment for documentation
COMMENT ON FUNCTION update_chat_room_on_message() IS
'Automatically updates chat_rooms.updated_at when a new message is inserted';
