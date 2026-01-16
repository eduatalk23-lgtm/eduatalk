-- Fix function search_path vulnerabilities
-- Setting search_path to 'public' prevents search path injection attacks

-- Trigger functions (no arguments)
ALTER FUNCTION public.update_planners_updated_at() SET search_path = public;
ALTER FUNCTION public.update_chat_room_on_message() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Chat functions with arguments
ALTER FUNCTION public.count_unread_by_room_ids(uuid[], uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.get_senders_by_ids(uuid[], uuid[]) SET search_path = public;
ALTER FUNCTION public.get_last_messages_by_room_ids(uuid[]) SET search_path = public;
ALTER FUNCTION public.find_existing_members_batch(uuid, uuid[], text[]) SET search_path = public;
ALTER FUNCTION public.get_chat_messages_since(uuid, timestamptz, integer) SET search_path = public;
ALTER FUNCTION public.get_message_read_counts(uuid, uuid[], uuid) SET search_path = public;
