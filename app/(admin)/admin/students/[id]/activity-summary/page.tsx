import { notFound, redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActivitySummaryPrint } from "../_components/activity-summary/ActivitySummaryPrint";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ActivitySummaryPage({ params }: Props) {
  const { userId, role } = await getCachedUserRole();
  if (!userId || !isAdminRole(role)) redirect("/login");

  const { id: studentId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) notFound();

  return (
    <div className="min-h-dvh bg-white">
      <ActivitySummaryPrint
        studentId={studentId}
        studentName={student.name}
      />
    </div>
  );
}
