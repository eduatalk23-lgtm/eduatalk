-- Remove duplicate indexes to improve performance
-- Each pair has identical definitions, keeping the more descriptive or shorter names

-- chat_message_reactions: keep idx_chat_reactions_message_id
DROP INDEX IF EXISTS public.idx_reactions_message_id;

-- chat_messages: keep idx_chat_messages_reply_to
DROP INDEX IF EXISTS public.idx_chat_messages_reply_to_id;

-- chat_room_members: keep idx_chat_room_members_active_room (more descriptive)
DROP INDEX IF EXISTS public.idx_chat_room_members_room_id;

-- chat_room_members: keep idx_chat_room_members_last_read (more descriptive)
DROP INDEX IF EXISTS public.idx_chat_room_members_room_read;

-- chat_room_members: keep idx_chat_room_members_user (shorter)
DROP INDEX IF EXISTS public.idx_chat_room_members_user_active;

-- student_milestone_settings: keep idx_milestone_settings_student (shorter)
DROP INDEX IF EXISTS public.idx_student_milestone_settings_student_id;
