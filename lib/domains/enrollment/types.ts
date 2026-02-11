export type EnrollmentStatus = "active" | "completed" | "cancelled" | "suspended";

export type EnrollmentWithProgram = {
  id: string;
  tenant_id: string;
  student_id: string;
  program_id: string;
  status: EnrollmentStatus;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  price: number | null;
  price_note: string | null;
  consultant_id: string | null;
  auto_end_on_expiry: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  program_name: string;
  program_code: string;
  consultant_name?: string | null;
};

export type CreateEnrollmentInput = {
  student_id: string;
  program_id: string;
  start_date: string;
  notes?: string;
  price?: number | null;
  price_note?: string;
  consultant_id?: string | null;
};

export type ExpiringEnrollment = {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name: string;
  program_id: string;
  program_name: string;
  start_date: string;
  end_date: string;
  days_until_expiry: number;
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: "수강중",
  completed: "수료",
  cancelled: "취소",
  suspended: "중단",
};

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};
