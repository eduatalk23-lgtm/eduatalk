"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import {
  recordAttendance,
  getAttendanceRecords,
  getAttendanceByStudent,
  calculateAttendanceStats,
  deleteAttendanceRecord as deleteRecord,
} from "@/lib/domains/attendance/service";
import type {
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceFilters,
} from "@/lib/domains/attendance/types";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 출석 기록 생성 또는 수정
 */
export async function recordAttendanceAction(
  input: CreateAttendanceRecordInput
): Promise<{ success: boolean; error?: string }> {
  return withErrorHandling(async () => {
    await requireAdminAuth();

    // 입력 검증
    if (!input.student_id) {
      throw new AppError(
        "학생 ID가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    if (!input.attendance_date) {
      throw new AppError(
        "출석 날짜가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    await recordAttendance(input);

    revalidatePath("/admin/attendance");
    revalidatePath(`/admin/students/${input.student_id}`);
    return { success: true };
  });
}

/**
 * 출석 기록 조회
 */
export async function getAttendanceRecordsAction(
  filters: AttendanceFilters
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    student_id: string;
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    check_in_method: string | null;
    check_out_method: string | null;
    status: string;
    notes: string | null;
    created_at: string;
  }>;
  error?: string;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();

    const records = await getAttendanceRecords(filters);

    return {
      success: true,
      data: records.map((record) => ({
        id: record.id,
        student_id: record.student_id,
        attendance_date: record.attendance_date,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        check_in_method: record.check_in_method,
        check_out_method: record.check_out_method,
        status: record.status,
        notes: record.notes,
        created_at: record.created_at,
      })),
    };
  });
}

/**
 * 학생별 출석 기록 조회
 */
export async function getAttendanceByStudentAction(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    notes: string | null;
  }>;
  error?: string;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();

    const records = await getAttendanceByStudent(studentId, startDate, endDate);

    return {
      success: true,
      data: records.map((record) => ({
        id: record.id,
        attendance_date: record.attendance_date,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        status: record.status,
        notes: record.notes,
      })),
    };
  });
}

/**
 * 출석 통계 조회
 */
export async function getAttendanceStatisticsAction(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: {
    total_days: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    early_leave_count: number;
    excused_count: number;
    attendance_rate: number;
    late_rate: number;
    absent_rate: number;
  };
  error?: string;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();

    const stats = await calculateAttendanceStats(
      studentId,
      startDate,
      endDate
    );

    return {
      success: true,
      data: stats,
    };
  });
}

/**
 * 출석 기록 삭제
 */
export async function deleteAttendanceRecordAction(
  recordId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  return withErrorHandling(async () => {
    await requireAdminAuth();

    await deleteRecord(recordId);

    revalidatePath("/admin/attendance");
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  });
}

