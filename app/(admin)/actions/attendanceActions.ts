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
import { sendAttendanceSMSIfEnabled } from "@/lib/services/attendanceSMSService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

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

    const record = await recordAttendance(input);

    // 출석 기록 저장 후 자동 SMS 발송 (비동기, 실패해도 출석 기록은 저장됨)
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      // 학생 정보 조회
      const { data: student } = await supabase
        .from("students")
        .select("id, name, mother_phone, father_phone")
        .eq("id", input.student_id)
        .single();

      // student_profiles 테이블에서 phone 정보 조회 (선택사항)
      let profile: { phone?: string | null; mother_phone?: string | null; father_phone?: string | null } | null = null;
      try {
        const { data: profileData } = await supabase
          .from("student_profiles")
          .select("phone, mother_phone, father_phone")
          .eq("id", input.student_id)
          .maybeSingle();
        if (profileData) {
          profile = profileData;
        }
      } catch (e) {
        // student_profiles 테이블이 없으면 무시
      }

      // 학원명 조회
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext?.tenantId)
        .single();

      // 학부모 연락처 확인 (mother_phone 또는 father_phone이 있는지)
      const hasParentContact = 
        profile?.mother_phone || 
        profile?.father_phone || 
        student?.mother_phone || 
        student?.father_phone;

      // 학부모 연락처가 있고, 출석 상태에 따라 SMS 발송
      if (hasParentContact && tenant?.name) {
        const academyName = tenant.name;
        const studentName = student.name || "학생";
        const attendanceDate = new Date(input.attendance_date).toLocaleDateString(
          "ko-KR",
          { month: "long", day: "numeric" }
        );

        // 입실 알림: present 상태이고 check_in_time이 있는 경우
        if (
          record.status === "present" &&
          record.check_in_time &&
          !record.check_out_time
        ) {
          const checkInTime = new Date(
            `${input.attendance_date}T${record.check_in_time}`
          ).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          await sendAttendanceSMSIfEnabled(
            input.student_id,
            "attendance_check_in",
            {
              학원명: academyName,
              학생명: studentName,
              시간: checkInTime,
            },
            false // 관리자가 기록한 경우
          );
        }

        // 퇴실 알림: present 상태이고 check_out_time이 있는 경우
        if (
          record.status === "present" &&
          record.check_out_time
        ) {
          const checkOutTime = new Date(
            `${input.attendance_date}T${record.check_out_time}`
          ).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          await sendAttendanceSMSIfEnabled(
            input.student_id,
            "attendance_check_out",
            {
              학원명: academyName,
              학생명: studentName,
              시간: checkOutTime,
            },
            false // 관리자가 기록한 경우
          );
        }

        // 결석 알림: absent 상태인 경우
        if (record.status === "absent") {
          await sendAttendanceSMSIfEnabled(
            input.student_id,
            "attendance_absent",
            {
              학원명: academyName,
              학생명: studentName,
              날짜: attendanceDate,
            },
            false // 관리자가 기록한 경우
          );
        }

        // 지각 알림: late 상태인 경우
        if (record.status === "late" && record.check_in_time) {
          const checkInTime = new Date(
            `${input.attendance_date}T${record.check_in_time}`
          ).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          await sendAttendanceSMSIfEnabled(
            input.student_id,
            "attendance_late",
            {
              학원명: academyName,
              학생명: studentName,
              시간: checkInTime,
            },
            false // 관리자가 기록한 경우
          );
        }
      }
    } catch (error) {
      // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
      console.error("[Attendance] SMS 발송 중 오류:", error);
    }

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

