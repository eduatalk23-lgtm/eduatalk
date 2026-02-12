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

  // 컨설턴트 목록 조회 (같은 테넌트)
  const { data: consultantsData } = await supabase
    .from("admin_users")
    .select("id, name")
    .in("role", ["consultant", "admin"])
    .order("name");

  const consultants = (consultantsData ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "이름 없음",
  }));

  // 일정 목록 조회
  const schedules = await getConsultationSchedules(studentId);

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
