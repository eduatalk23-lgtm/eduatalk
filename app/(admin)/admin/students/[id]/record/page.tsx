import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentDetailWrapper } from "../_components/StudentDetailWrapper";
import { StudentRecordSection } from "../_components/student-record/StudentRecordSection";
import { StudentRecordSkeleton } from "../_components/student-record/StudentRecordSkeleton";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StudentRecordPage({ params }: Props) {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const { id: studentId } = await params;

  const supabase = await createSupabaseServerClient();
  const studentResult = await supabase
    .from("user_profiles")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentResult.error || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data;

  return (
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <Suspense fallback={<StudentRecordSkeleton />}>
            <StudentRecordSection studentId={studentId} studentName={student.name} />
          </Suspense>
        </div>
      </div>
    </StudentDetailWrapper>
  );
}
