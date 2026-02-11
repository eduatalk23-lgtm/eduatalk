export type ConsultantRole = "primary" | "secondary" | "assistant";

export type ConsultantAssignment = {
  id: string;
  tenant_id: string;
  student_id: string;
  enrollment_id: string | null;
  consultant_id: string;
  role: ConsultantRole;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ConsultantAssignmentWithDetails = ConsultantAssignment & {
  consultant_name: string;
  program_name: string | null;
};

export type CreateAssignmentInput = {
  student_id: string;
  consultant_id: string;
  enrollment_id?: string | null;
  role?: ConsultantRole;
  notes?: string;
};

export type MyAssignedStudent = {
  id: string;
  name: string;
  phone: string | null;
  grade: number | null;
  role: ConsultantRole;
  program_names: string;
  enrollment_count: number;
};

export const ROLE_LABELS: Record<ConsultantRole, string> = {
  primary: "주담당",
  secondary: "부담당",
  assistant: "보조",
};

export const ROLE_COLORS: Record<ConsultantRole, string> = {
  primary:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  secondary:
    "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  assistant:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
