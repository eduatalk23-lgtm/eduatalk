"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import {
  recordAttendance,
  getAttendanceRecords,
  getAttendanceByStudent,
  calculateAttendanceStats,
  deleteAttendanceRecord as deleteRecord,
  validateAttendanceRecord,
} from "@/lib/domains/attendance/service";
import type {
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceFilters,
} from "@/lib/domains/attendance/types";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { sendAttendanceSMSIfEnabled } from "@/lib/services/attendanceSMSService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getStudentPhones } from "@/lib/utils/studentPhoneUtils";
import type { UpdateAttendanceRecordRequest, AttendanceRecordHistory } from "@/lib/types/attendance";

/**
 * 출석 기록 생성 또는 수정
 */
export async function recordAttendanceAction(
  input: CreateAttendanceRecordInput
): Promise<{ 
  success: boolean; 
  error?: string;
  smsResult?: { 
    success: boolean; 
    error?: string; 
    skipped?: boolean;
  };
}> {
  const handler = withErrorHandling(async () => {
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
    let smsResult: { success: boolean; error?: string; skipped?: boolean } | undefined;
    
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      // 학생 기본 정보 조회
      const { data: student } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", input.student_id)
        .single();

      // getStudentPhones 함수를 사용하여 연락처 정보 조회 (통합 로직)
      const phoneData = await getStudentPhones(input.student_id);

      // 학원명 및 SMS 설정 조회
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, attendance_sms_show_failure_to_user")
        .eq("id", tenantContext?.tenantId)
        .single();

      // 학부모 연락처 확인 (mother_phone 또는 father_phone이 있는지)
      const hasParentContact = 
        phoneData?.mother_phone || 
        phoneData?.father_phone;

      // 학부모 연락처가 있고, 출석 상태에 따라 SMS 발송
      if (hasParentContact && tenant?.name) {
        const academyName = tenant.name;
        const studentName = student?.name || "학생";
        const attendanceDate = new Date(input.attendance_date).toLocaleDateString(
          "ko-KR",
          { month: "long", day: "numeric" }
        );

        let smsType: "attendance_check_in" | "attendance_check_out" | "attendance_absent" | "attendance_late" | null = null;
        let smsVariables: Record<string, string> = {};

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

          smsType = "attendance_check_in";
          smsVariables = {
            학원명: academyName,
            학생명: studentName,
            시간: checkInTime,
          };
        }
        // 퇴실 알림: present 상태이고 check_out_time이 있는 경우
        else if (
          record.status === "present" &&
          record.check_out_time
        ) {
          const checkOutTime = new Date(
            `${input.attendance_date}T${record.check_out_time}`
          ).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          smsType = "attendance_check_out";
          smsVariables = {
            학원명: academyName,
            학생명: studentName,
            시간: checkOutTime,
          };
        }
        // 결석 알림: absent 상태인 경우
        else if (record.status === "absent") {
          smsType = "attendance_absent";
          smsVariables = {
            학원명: academyName,
            학생명: studentName,
            날짜: attendanceDate,
          };
        }
        // 지각 알림: late 상태인 경우
        else if (record.status === "late" && record.check_in_time) {
          const checkInTime = new Date(
            `${input.attendance_date}T${record.check_in_time}`
          ).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          smsType = "attendance_late";
          smsVariables = {
            학원명: academyName,
            학생명: studentName,
            시간: checkInTime,
          };
        }

        // SMS 발송
        if (smsType) {
          const result = await sendAttendanceSMSIfEnabled(
            input.student_id,
            smsType,
            smsVariables,
            false // 관리자가 기록한 경우
          );

          // SMS 발송 결과 저장 (설정에 따라 사용자에게 표시)
          smsResult = {
            success: result.success,
            error: result.error,
            skipped: result.skipped,
          };
        }
      }
    } catch (error) {
      // SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리
      console.error("[Attendance] SMS 발송 중 오류:", error);
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      smsResult = {
        success: false,
        error: errorMessage,
        skipped: false,
      };
    }

    revalidatePath("/admin/attendance");
    revalidatePath(`/admin/students/${input.student_id}`);
    return { 
      success: true,
      smsResult,
    };
  });
  return await handler();
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
  const handler = withErrorHandling(async () => {
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
  return await handler();
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
  const handler = withErrorHandling(async () => {
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
  return await handler();
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
  const handler = withErrorHandling(async () => {
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
  return await handler();
}

/**
 * 출석 기록 삭제
 */
export async function deleteAttendanceRecordAction(
  recordId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const handler = withErrorHandling(async () => {
    await requireAdminAuth();

    await deleteRecord(recordId);

    revalidatePath("/admin/attendance");
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  });
  return await handler();
}

/**
 * 출석 기록 수정
 */
export async function updateAttendanceRecord(
  recordId: string,
  updates: UpdateAttendanceRecordRequest
): Promise<{ success: boolean; error?: string }> {
  const handler = withErrorHandling(async () => {
    // 1. 관리자 인증 확인
    const admin = await requireAdminAuth();
    
    // 2. 테넌트 컨텍스트 확인
    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404
      );
    }
    
    // Admin Client 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500
      );
    }
    
    // 3. 기존 기록 조회 및 원본 백업
    const { data: existingRecord, error: fetchError } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("id", recordId)
      .eq("tenant_id", tenantContext.tenantId)
      .single();
    
    if (fetchError || !existingRecord) {
      throw new AppError(
        "출석 기록을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404
      );
    }
    
    // 4. 수정 데이터 준비
    const updateData: Partial<typeof existingRecord> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.check_in_time !== undefined) {
      updateData.check_in_time = updates.check_in_time;
    }
    if (updates.check_out_time !== undefined) {
      updateData.check_out_time = updates.check_out_time;
    }
    if (updates.check_in_method !== undefined) {
      updateData.check_in_method = updates.check_in_method;
    }
    if (updates.check_out_method !== undefined) {
      updateData.check_out_method = updates.check_out_method;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
    
    // 5. 검증 (수정된 데이터 기준)
    const updatedRecord = { ...existingRecord, ...updateData };
    // 검증을 위해 student_id와 attendance_date를 포함한 전체 입력 객체 생성
    const validationInput: UpdateAttendanceRecordInput = {
      ...updateData,
    };
    const validation = await validateAttendanceRecord(validationInput, existingRecord);
    if (!validation.valid) {
      throw new AppError(
        validation.errors[0]?.message || "검증 실패",
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }
    
    // 6. 트랜잭션: 기록 수정 + 이력 저장
    const { data: updatedRows, error: updateError } = await supabase
      .from("attendance_records")
      .update(updateData)
      .eq("id", recordId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();
    
    if (updateError) {
      throw new AppError(
        `출석 기록 수정 실패: ${updateError.message}`,
        ErrorCode.DATABASE_ERROR,
        500
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new AppError(
        "출석 기록을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404
      );
    }
    
    // 7. 수정 이력 저장
    const { error: historyError } = await supabase
      .from("attendance_record_history")
      .insert({
        attendance_record_id: recordId,
        tenant_id: tenantContext.tenantId,
        student_id: existingRecord.student_id,
        before_data: existingRecord,
        after_data: updatedRecord,
        modified_by: admin.userId,
        reason: updates.reason,
      });
    
    if (historyError) {
      // 이력 저장 실패는 경고만 하고 롤백하지 않음 (기록 수정은 성공)
      console.error("[attendance] 수정 이력 저장 실패:", historyError);
    }
    
    revalidatePath("/admin/attendance");
    revalidatePath(`/admin/attendance/${recordId}/edit`);
    
    return { success: true };
  });

  return await handler();
}

/**
 * 출석 기록 수정 이력 조회
 */
export async function getAttendanceRecordHistory(
  recordId: string
): Promise<{ data: AttendanceRecordHistory[] | null; error?: string }> {
  const handler = withErrorHandling(async () => {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();
    
    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404
      );
    }
    
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("attendance_record_history")
      .select("*")
      .eq("attendance_record_id", recordId)
      .eq("tenant_id", tenantContext.tenantId)
      .order("modified_at", { ascending: false });
    
    if (error) {
      throw new AppError(
        `이력 조회 실패: ${error.message}`,
        ErrorCode.DATABASE_ERROR,
        500
      );
    }
    
    return { data: data as AttendanceRecordHistory[] | null };
  });

  return await handler();
}
