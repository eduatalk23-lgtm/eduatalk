/**
 * Attendance 도메인 Service
 * 출석 비즈니스 로직
 */

import * as repository from "./repository";
import type {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceStatistics,
  AttendanceFilters,
} from "./types";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 출석 기록 생성 또는 수정
 */
export async function recordAttendance(
  input: CreateAttendanceRecordInput
): Promise<AttendanceRecord> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 기존 기록 확인
  const existing = await repository.findAttendanceByStudentAndDate(
    input.student_id,
    input.attendance_date
  );

  if (existing) {
    // 기존 기록 수정
    return repository.updateAttendanceRecord(existing.id, {
      check_in_time: input.check_in_time,
      check_out_time: input.check_out_time,
      check_in_method: input.check_in_method,
      check_out_method: input.check_out_method,
      status: input.status,
      notes: input.notes,
    });
  } else {
    // 새 기록 생성
    return repository.insertAttendanceRecord(tenantContext.tenantId, input);
  }
}

/**
 * 출석 기록 조회
 */
export async function getAttendanceRecords(
  filters: AttendanceFilters
): Promise<AttendanceRecord[]> {
  const tenantContext = await getTenantContext();

  return repository.findAttendanceRecordsByDateRange(
    filters,
    tenantContext?.tenantId ?? null
  );
}

/**
 * 학생별 출석 기록 조회
 */
export async function getAttendanceByStudent(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  return repository.findAttendanceRecordsByStudent(
    studentId,
    startDate,
    endDate
  );
}

/**
 * 출석 통계 계산
 */
export async function calculateAttendanceStats(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceStatistics> {
  const records = await repository.findAttendanceRecordsByStudent(
    studentId,
    startDate,
    endDate
  );

  const totalDays = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const earlyLeaveCount = records.filter(
    (r) => r.status === "early_leave"
  ).length;
  const excusedCount = records.filter((r) => r.status === "excused").length;

  const attendanceRate =
    totalDays > 0 ? (presentCount / totalDays) * 100 : 0;
  const lateRate = totalDays > 0 ? (lateCount / totalDays) * 100 : 0;
  const absentRate = totalDays > 0 ? (absentCount / totalDays) * 100 : 0;

  return {
    total_days: totalDays,
    present_count: presentCount,
    absent_count: absentCount,
    late_count: lateCount,
    early_leave_count: earlyLeaveCount,
    excused_count: excusedCount,
    attendance_rate: Math.round(attendanceRate * 100) / 100,
    late_rate: Math.round(lateRate * 100) / 100,
    absent_rate: Math.round(absentRate * 100) / 100,
  };
}

/**
 * 출석 기록 삭제
 */
export async function deleteAttendanceRecord(
  recordId: string
): Promise<void> {
  await repository.deleteAttendanceRecord(recordId);
}

