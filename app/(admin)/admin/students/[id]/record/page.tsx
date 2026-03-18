import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
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
        <PageContainer widthType="LIST">
          <div className="flex flex-col gap-6 pb-0 md:gap-8">
            <PageHeader
              title={`${student.name ?? "이름 없음"} 생기부`}
              backHref="/admin/students"
              backLabel="학생 목록으로"
            />
          </div>
        </PageContainer>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<StudentRecordSkeleton />}>
            <StudentRecordSection studentId={studentId} studentName={student.name} />
          </Suspense>
        </div>
      </div>
    </StudentDetailWrapper>
  );
}
