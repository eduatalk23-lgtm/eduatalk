/**
 * 출석 관리 관련 타입 정의
 */

import type { AttendanceRecord } from "@/lib/domains/attendance/types";

export type AttendanceTableRow = AttendanceRecord & {
  student_name: string | null;
};

