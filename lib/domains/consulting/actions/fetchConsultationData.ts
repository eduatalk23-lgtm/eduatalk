"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentPhones } from "@/lib/utils/studentPhoneUtils";
import { getConsultationSchedules } from "./schedule";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  ConsultationSchedule,
  NotificationLogEntry,
} from "../types";

const ACTION_CTX = { domain: "consulting", action: "fetchData" };

export type ConsultingNoteRow = {
  id: string;
  note: string | null;
  created_at: string | null;
  consultant_id: string | null;
  session_type: string | null;
  session_duration: number | null;
  session_date: string | null;
  next_action: string | null;
  follow_up_date: string | null;
  enrollment_id: string | null;
  consultation_schedule_id: string | null;
  is_visible_to_parent: boolean | null;
};

export type StudentPhones = {
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
};

export type ConsultationPanelData = {
  schedules: ConsultationSchedule[];
  consultants: { id: string; name: string }[];
  enrollments: { id: string; program_name: string }[];
  phoneAvailability: { student: boolean; mother: boolean; father: boolean };
  studentPhones: StudentPhones;
  notificationLogs: Record<string, NotificationLogEntry[]>;
  consultingNotes: ConsultingNoteRow[];
  currentUserId: string | null;
};

export async function fetchConsultationData(
  studentId: string
): Promise<ConsultationPanelData> {
  try {
    await requireAdminOrConsultant();
    const { userId } = await getCurrentUserRole();
    const supabase = await createSupabaseServerClient();

    const [consultantsResult, enrollmentResult, schedules, phoneData, notesResult] =
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
        supabase
          .from("student_consulting_notes")
          .select(
            "id,note,created_at,consultant_id,session_type,session_duration,session_date,next_action,follow_up_date,enrollment_id,consultation_schedule_id,is_visible_to_parent"
          )
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    // SMS logs 조회
    const scheduleIds = schedules.map((s) => s.id);
    let notificationLogs: Record<string, NotificationLogEntry[]> = {};

    if (scheduleIds.length > 0) {
      const { data: logs } = await supabase
        .from("sms_logs")
        .select(
          "id, consultation_schedule_id, recipient_phone, status, channel, sent_at, delivered_at, error_message, ppurio_result_code, notification_target"
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
              notification_target: log.notification_target,
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

    return {
      schedules,
      consultants,
      enrollments,
      phoneAvailability: {
        student: !!phoneData?.phone,
        mother: !!phoneData?.mother_phone,
        father: !!phoneData?.father_phone,
      },
      studentPhones: {
        phone: phoneData?.phone ?? null,
        mother_phone: phoneData?.mother_phone ?? null,
        father_phone: phoneData?.father_phone ?? null,
      },
      notificationLogs,
      consultingNotes: (notesResult.data ?? []) as ConsultingNoteRow[],
      currentUserId: userId,
    };
  } catch (error) {
    logActionError(ACTION_CTX, error, { studentId });
    return {
      schedules: [],
      consultants: [],
      enrollments: [],
      phoneAvailability: { student: false, mother: false, father: false },
      studentPhones: { phone: null, mother_phone: null, father_phone: null },
      notificationLogs: {},
      consultingNotes: [],
      currentUserId: null,
    };
  }
}
