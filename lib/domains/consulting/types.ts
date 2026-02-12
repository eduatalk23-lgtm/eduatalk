export type SessionType =
  | "정기상담"
  | "학부모상담"
  | "진로상담"
  | "성적상담"
  | "긴급상담"
  | "기타";

export const SESSION_TYPES: SessionType[] = [
  "정기상담",
  "학부모상담",
  "진로상담",
  "성적상담",
  "긴급상담",
  "기타",
];

export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  정기상담: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  학부모상담:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  진로상담:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  성적상담:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  긴급상담: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  기타: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
};

// ── 상담 일정 (Consultation Schedule) ──

export type ScheduleStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface ConsultationSchedule {
  id: string;
  tenant_id: string;
  student_id: string;
  consultant_id: string;
  session_type: SessionType;
  enrollment_id: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  visitor: string | null;
  location: string | null;
  description: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  status: ScheduleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // JOIN 결과
  consultant_name?: string;
  program_name?: string;
}

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소",
  no_show: "미참석",
};

export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};
