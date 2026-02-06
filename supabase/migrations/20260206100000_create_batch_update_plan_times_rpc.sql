-- Migration: Create batch_update_plan_times RPC function
-- Description: Atomic batch update for plan times during unified reorder

-- Drop if exists (for idempotency)
DROP FUNCTION IF EXISTS batch_update_plan_times(jsonb);

-- Create the RPC function
CREATE OR REPLACE FUNCTION batch_update_plan_times(
  plan_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_update jsonb;
BEGIN
  -- Validate input
  IF plan_updates IS NULL OR jsonb_array_length(plan_updates) = 0 THEN
    RAISE EXCEPTION 'plan_updates cannot be empty';
  END IF;

  -- Update each plan in a single transaction
  FOR plan_update IN SELECT * FROM jsonb_array_elements(plan_updates)
  LOOP
    UPDATE student_plans
    SET
      start_time = plan_update->>'new_start_time',
      end_time = plan_update->>'new_end_time',
      sequence = (plan_update->>'new_sequence')::integer,
      updated_at = now()
    WHERE id = (plan_update->>'plan_id')::uuid;

    -- Check if update was successful
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan not found: %', plan_update->>'plan_id';
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION batch_update_plan_times(jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION batch_update_plan_times(jsonb) IS
'Atomically updates multiple plan times in a single transaction.
Used by unified reorder feature to ensure data consistency.
Input format: [{"plan_id": "uuid", "new_start_time": "HH:mm", "new_end_time": "HH:mm", "new_sequence": 1}, ...]';
