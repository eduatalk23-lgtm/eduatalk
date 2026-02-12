import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getConsultationSchedules } from "@/lib/domains/consulting/actions/schedule";
import { ConsultationScheduleForm } from "./ConsultationScheduleForm";
import { ConsultationScheduleList } from "./ConsultationScheduleList";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";

type ConsultationScheduleSectionProps = {
  studentId: string;
};

export async function ConsultationScheduleSection({
  studentId,
}: ConsultationScheduleSectionProps) {
  const { userId } = await getCurrentUserRole();
  const supabase = await createSupabaseServerClient();

  // 컨설턴트 목록 + 수강 프로그램 + 일정 병렬 조회
  const [consultantsResult, enrollmentResult, schedules] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, name")
      .in("role", ["consultant", "admin"])
      .order("name"),
    supabase
      .from("enrollments")
      .select("id, programs(name)")
      .eq("student_id", studentId)
      .eq("status", "active"),
    getConsultationSchedules(studentId),
  ]);

  const consultants = (consultantsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "이름 없음",
  }));

  const enrollments = (enrollmentResult.data ?? []).map((e) => {
    const prog = e.programs as unknown;
    const name =
      prog && typeof prog === "object" && "name" in prog
        ? (prog as { name: string }).name
        : Array.isArray(prog) && prog.length > 0
          ? (prog[0] as { name: string }).name
          : "프로그램";
    return { id: e.id, program_name: name };
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-6 rounded-lg border p-6 shadow-sm",
        borderDefault,
        bgSurface
      )}
    >
      <h2 className={cn("text-xl font-semibold", textPrimary)}>상담 일정</h2>

      <ConsultationScheduleForm
        studentId={studentId}
        consultants={consultants}
        enrollments={enrollments}
        defaultConsultantId={userId ?? undefined}
      />

      <ConsultationScheduleList
        schedules={schedules}
        studentId={studentId}
      />
    </div>
  );
}

export function ConsultationScheduleSectionSkeleton() {
  return (
    <div className={cn("rounded-lg border p-6", borderDefault, bgSurface)}>
      <div className="space-y-4">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
