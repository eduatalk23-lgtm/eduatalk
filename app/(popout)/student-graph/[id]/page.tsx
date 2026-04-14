import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentRecordGraph } from "@/app/(admin)/admin/students/[id]/_components/student-record/graph/StudentRecordGraph";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentGraphStandalonePage({ params }: Props) {
  const { id: studentId } = await params;

  const supabase = await createSupabaseServerClient();
  const [profileResult, studentResult] = await Promise.all([
    supabase.from("user_profiles").select("id, name").eq("id", studentId).maybeSingle(),
    supabase.from("students").select("tenant_id").eq("id", studentId).maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data || !studentResult.data?.tenant_id) {
    notFound();
  }

  return (
    <StudentRecordGraph
      studentId={studentId}
      tenantId={studentResult.data.tenant_id}
      studentName={profileResult.data.name ?? null}
      variant="standalone"
    />
  );
}
