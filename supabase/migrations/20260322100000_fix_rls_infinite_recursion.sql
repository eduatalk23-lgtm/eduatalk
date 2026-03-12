-- Fix: RLS infinite recursion between calendar_events ↔ consultation_event_data
--
-- Problem: consultation_event_data_admin_all policy queries calendar_events,
-- while calendar_events RLS policies query consultation_event_data → infinite loop.
-- This causes all calendar_events queries to return HTTP 500.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to check admin access
-- for consultation_event_data, breaking the circular dependency.

-- 1. Create SECURITY DEFINER helper to check admin access without triggering RLS
CREATE OR REPLACE FUNCTION public.rls_check_consultation_admin(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_events ce
    JOIN public.admin_users au ON au.tenant_id = ce.tenant_id
    WHERE ce.id = p_event_id
      AND au.id = auth.uid()
  );
$$;

-- 2. Replace the policy that causes the circular dependency
DROP POLICY IF EXISTS consultation_event_data_admin_all ON consultation_event_data;
CREATE POLICY consultation_event_data_admin_all ON consultation_event_data
  FOR ALL USING (rls_check_consultation_admin(event_id));
