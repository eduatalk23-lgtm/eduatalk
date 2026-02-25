-- Drop academies table
-- Academy metadata (name, travel_time) is now derived from calendar_events
-- via virtual entity pattern (grouping by academy name from event titles)

DROP TABLE IF EXISTS academies CASCADE;
