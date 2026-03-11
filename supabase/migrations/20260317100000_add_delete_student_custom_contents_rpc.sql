-- RPC function to delete student_custom_contents bypassing prevent_content_deletion trigger
-- Used by deleteStudent when cleaning up content before student deletion
CREATE OR REPLACE FUNCTION delete_student_custom_contents(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the trigger, delete, then re-enable
  ALTER TABLE student_custom_contents DISABLE TRIGGER prevent_custom_content_deletion;
  DELETE FROM student_custom_contents WHERE student_id = p_student_id;
  ALTER TABLE student_custom_contents ENABLE TRIGGER prevent_custom_content_deletion;
END;
$$;

-- Only allow service_role to call this function
REVOKE ALL ON FUNCTION delete_student_custom_contents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_student_custom_contents(uuid) FROM anon;
REVOKE ALL ON FUNCTION delete_student_custom_contents(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION delete_student_custom_contents(uuid) TO service_role;
