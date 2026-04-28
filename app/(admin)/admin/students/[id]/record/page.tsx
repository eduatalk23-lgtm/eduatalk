import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchGradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-status";
import { fetchExpectedModes } from "@/lib/domains/student-record/actions/pipeline-orchestrator-modes";
import {
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import { StudentDetailWrapper } from "../_components/StudentDetailWrapper";
import { StudentRecordSection } from "../_components/student-record/StudentRecordSection";
import { StudentRecordSkeleton } from "../_components/student-record/StudentRecordSkeleton";
import { HandoffLauncher } from "@/components/ai-chat/HandoffLauncher";

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

  // B2: SSR prefetch — 첫 로딩 시 클라이언트 mount 이전에 파이프라인 상태와 예상 모드를 미리 조회.
  // prefetch 실패는 fatal 이 아님 — 클라이언트에서 자동으로 재fetch 한다.
  const queryClient = new QueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
      queryFn: async () => {
        const result = await fetchGradeAwarePipelineStatus(studentId);
        if (!result.success) throw new Error(result.error);
        return result.data!;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: studentRecordKeys.expectedModes(studentId),
      queryFn: async () => {
        const result = await fetchExpectedModes(studentId);
        if (!result.success) throw new Error(result.error);
        return result.data!;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
        <div className="flex flex-none items-center justify-end border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <HandoffLauncher
            from="admin-record"
            studentId={studentId}
            size="sm"
          />
        </div>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<StudentRecordSkeleton />}>
            <StudentRecordSection studentId={studentId} studentName={student.name} />
          </Suspense>
        </div>
      </div>
    </StudentDetailWrapper>
    </HydrationBoundary>
  );
}
