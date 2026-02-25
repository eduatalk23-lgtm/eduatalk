import { redirect } from 'next/navigation';

/**
 * @deprecated Phase 5: Planner entity removed. Redirects to student plan calendar.
 */
export default async function StudentPlannerPage() {
  redirect('/plan/calendar');
}
