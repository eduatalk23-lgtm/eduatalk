/**
 * Parent Domain Types
 */

// Settings types
export type StudentAttendanceNotificationSettings = {
  attendance_check_in_enabled: boolean | null;
  attendance_check_out_enabled: boolean | null;
  attendance_absent_enabled: boolean | null;
  attendance_late_enabled: boolean | null;
};

// Link request types
export type SearchableStudent = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
};

export type LinkRequest = {
  id: string;
  studentId: string;
  studentName: string | null;
  grade: string | null;
  class: string | null;
  relation: string;
  is_approved: boolean | null;
  created_at: string;
};

export type ParentRelation = "father" | "mother" | "guardian" | "other";

// Utils types
export type LinkedStudent = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  relation: string;
};
