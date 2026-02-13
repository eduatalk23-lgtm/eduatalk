import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getConsultationSchedules } from "@/lib/domains/consulting/actions/schedule";
import { getStudentPhones } from "@/lib/utils/studentPhoneUtils";
import { ConsultationScheduleForm } from "./ConsultationScheduleForm";
import { ConsultationScheduleList } from "./ConsultationScheduleList";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  bgSurface,
  borderDefault,
} from "@/lib/utils/darkMode";
import type { NotificationLogEntry } from "@/lib/domains/consulting/types";

export type PhoneAvailability = {
  student: boolean;
  mother: boolean;
  father: boolean;
};

type ConsultationScheduleSectionProps = {
  studentId: string;
};

export async function ConsultationScheduleSection({
  studentId,
}: ConsultationScheduleSectionProps) {
  const { userId } = await getCurrentUserRole();
  const supabase = await createSupabaseServerClient();

  // 컨설턴트 목록 + 수강 프로그램 + 일정 + 연락처 병렬 조회
  const [consultantsResult, enrollmentResult, schedules, phoneData] =
    await Promise.all([
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
      getStudentPhones(studentId),
    ]);

  const phoneAvailability: PhoneAvailability = {
    student: !!phoneData?.phone,
    mother: !!phoneData?.mother_phone,
    father: !!phoneData?.father_phone,
  };

  // 상담 일정 ID들로 sms_logs 일괄 조회
  const scheduleIds = schedules.map((s) => s.id);
  let notificationLogs: Record<string, NotificationLogEntry[]> = {};

  if (scheduleIds.length > 0) {
    const { data: logs } = await supabase
      .from("sms_logs")
      .select(
        "id, consultation_schedule_id, recipient_phone, status, channel, sent_at, delivered_at, error_message, ppurio_result_code"
      )
      .in("consultation_schedule_id", scheduleIds)
      .order("sent_at", { ascending: false });

    if (logs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notificationLogs = (logs as any[]).reduce(
        (acc: Record<string, NotificationLogEntry[]>, log) => {
          const key = log.consultation_schedule_id as string;
          if (!acc[key]) acc[key] = [];
          acc[key].push({
            id: log.id,
            recipient_phone: log.recipient_phone,
            status: log.status,
            channel: log.channel,
            sent_at: log.sent_at,
            delivered_at: log.delivered_at,
            error_message: log.error_message,
            ppurio_result_code: log.ppurio_result_code,
          });
          return acc;
        },
        {}
      );
    }
  }

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
        phoneAvailability={phoneAvailability}
      />

      <ConsultationScheduleList
        schedules={schedules}
        studentId={studentId}
        consultants={consultants}
        enrollments={enrollments}
        phoneAvailability={phoneAvailability}
        notificationLogs={notificationLogs}
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
