import { redirect } from 'next/navigation';

/**
 * @deprecated Phase 5: Planner entity removed. Redirects to plans page (which redirects to calendar).
 */
export default async function PlannerRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/students/${id}/plans`);
}
