-- Safety net: auto-create event_study_data for study events
-- Ensures no study event is orphaned without task tracking

CREATE OR REPLACE FUNCTION auto_create_event_study_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'study' THEN
    INSERT INTO event_study_data (event_id)
    VALUES (NEW.id)
    ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_create_event_study_data ON calendar_events;

CREATE TRIGGER tr_auto_create_event_study_data
AFTER INSERT ON calendar_events
FOR EACH ROW
EXECUTE FUNCTION auto_create_event_study_data();
