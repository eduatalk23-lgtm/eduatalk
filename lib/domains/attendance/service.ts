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
  ValidationResult,
  ValidationError,
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

  // 통합 검증 수행
  const validation = await validateAttendanceRecord(input, existing);
  if (!validation.valid) {
    // 첫 번째 에러 메시지를 사용하여 AppError 생성
    const firstError = validation.errors[0];
    throw new AppError(
      firstError.message,
      ErrorCode.VALIDATION_ERROR,
      400,
      true,
      {
        validationErrors: validation.errors,
      }
    );
  }

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

// ============================================
// 검증 함수
// ============================================

/**
 * 입실/퇴실 시간 검증
 */
export function validateAttendanceTimes(
  record: AttendanceRecord | CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null
): ValidationResult {
  const errors: ValidationError[] = [];
  const now = new Date();

  // check_in_time과 check_out_time 추출
  const checkInTime =
    "check_in_time" in record ? record.check_in_time : null;
  const checkOutTime =
    "check_out_time" in record ? record.check_out_time : null;

  // 1. check_out_time이 있으면 check_in_time도 있어야 함
  if (checkOutTime && !checkInTime) {
    // 기존 기록의 입실 시간 확인
    const existingCheckInTime = existingRecord?.check_in_time;
    if (!existingCheckInTime) {
      errors.push({
        field: "check_out_time",
        message: "퇴실 시간이 있으면 입실 시간도 필요합니다.",
        code: "CHECK_OUT_WITHOUT_CHECK_IN",
      });
    }
  }

  // 2. check_in_time과 check_out_time이 모두 있으면 시간 순서 검증
  // 입력값에 없으면 기존 기록의 값을 사용
  const finalCheckInTime = checkInTime ?? existingRecord?.check_in_time ?? null;
  const finalCheckOutTime = checkOutTime ?? null;

  if (finalCheckInTime && finalCheckOutTime) {
    const checkIn = new Date(finalCheckInTime);
    const checkOut = new Date(finalCheckOutTime);

    // check_in_time이 check_out_time보다 이전이어야 함
    if (checkIn >= checkOut) {
      errors.push({
        field: "check_out_time",
        message: "퇴실 시간은 입실 시간보다 이후여야 합니다.",
        code: "CHECK_OUT_BEFORE_CHECK_IN",
      });
    }

    // 같은 날짜인지 확인 (타임존 고려)
    const checkInDate = checkIn.toISOString().slice(0, 10);
    const checkOutDate = checkOut.toISOString().slice(0, 10);
    if (checkInDate !== checkOutDate) {
      errors.push({
        field: "check_out_time",
        message: "입실과 퇴실은 같은 날짜여야 합니다.",
        code: "DIFFERENT_DATE",
      });
    }
  }

  // 3. 미래 시간 검증
  if (checkInTime) {
    const checkIn = new Date(checkInTime);
    if (checkIn > now) {
      errors.push({
        field: "check_in_time",
        message: "입실 시간은 미래 시간일 수 없습니다.",
        code: "FUTURE_CHECK_IN_TIME",
      });
    }
  }

  if (checkOutTime) {
    const checkOut = new Date(checkOutTime);
    if (checkOut > now) {
      errors.push({
        field: "check_out_time",
        message: "퇴실 시간은 미래 시간일 수 없습니다.",
        code: "FUTURE_CHECK_OUT_TIME",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 입실/퇴실 방법 일관성 검증
 */
export function validateAttendanceMethodConsistency(
  record: AttendanceRecord | CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null
): ValidationResult {
  const errors: ValidationError[] = [];

  // check_in_method와 check_out_method 추출
  const checkInMethod =
    "check_in_method" in record ? record.check_in_method : null;
  const checkOutMethod =
    "check_out_method" in record ? record.check_out_method : null;

  // check_out_method가 있으면 check_in_method도 있어야 함
  if (checkOutMethod && !checkInMethod) {
    // 기존 기록의 입실 방법 확인
    const existingCheckInMethod = existingRecord?.check_in_method;
    if (!existingCheckInMethod) {
      errors.push({
        field: "check_out_method",
        message: "퇴실 방법이 있으면 입실 방법도 필요합니다.",
        code: "CHECK_OUT_METHOD_WITHOUT_CHECK_IN_METHOD",
      });
    }
  }

  // 입력값에 없으면 기존 기록의 값을 사용
  const finalCheckInMethod = checkInMethod ?? existingRecord?.check_in_method ?? null;

  // QR 입실인 경우 퇴실도 QR이어야 함
  if (finalCheckInMethod === "qr" && checkOutMethod && checkOutMethod !== "qr") {
    errors.push({
      field: "check_out_method",
      message: "QR 코드로 입실한 경우 퇴실도 QR 코드로 해야 합니다.",
      code: "QR_CHECK_IN_REQUIRES_QR_CHECK_OUT",
    });
  }

  // 위치 입실인 경우 퇴실은 위치 또는 수동 가능
  if (
    finalCheckInMethod === "location" &&
    checkOutMethod &&
    checkOutMethod !== "location" &&
    checkOutMethod !== "manual"
  ) {
    errors.push({
      field: "check_out_method",
      message: "위치 기반 입실인 경우 퇴실은 위치 기반 또는 수동으로 해야 합니다.",
      code: "LOCATION_CHECK_IN_INVALID_CHECK_OUT",
    });
  }

  // 수동 입실인 경우 퇴실은 수동 가능 (다른 방법도 허용할 수 있으나 일관성을 위해 수동 권장)
  // 이 검증은 선택사항이므로 주석 처리
  // if (checkInMethod === "manual" && checkOutMethod && checkOutMethod !== "manual") {
  //   errors.push({
  //     field: "check_out_method",
  //     message: "수동 입실인 경우 퇴실도 수동으로 해야 합니다.",
  //     code: "MANUAL_CHECK_IN_REQUIRES_MANUAL_CHECK_OUT",
  //   });
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 중복 처리 방지 검증
 */
export async function validateNoDuplicateAttendance(
  studentId: string,
  date: string,
  input: CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // 기존 기록이 있으면 중복 체크
  if (existingRecord) {
    // 입력값에서 check_in_time과 check_out_time 추출
    const inputCheckInTime =
      "check_in_time" in input ? input.check_in_time : undefined;
    const inputCheckOutTime =
      "check_out_time" in input ? input.check_out_time : undefined;

    // 입실 시간 업데이트 시에만 중복 체크 수행
    if (inputCheckInTime !== undefined && existingRecord.check_in_time) {
      errors.push({
        field: "check_in_time",
        message: "이미 입실 기록이 있습니다.",
        code: "DUPLICATE_CHECK_IN",
      });
    }

    // 퇴실 시간 업데이트 시에만 중복 체크 수행
    if (inputCheckOutTime !== undefined && existingRecord.check_out_time) {
      errors.push({
        field: "check_out_time",
        message: "이미 퇴실 기록이 있습니다.",
        code: "DUPLICATE_CHECK_OUT",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 통합 검증 함수
 */
export async function validateAttendanceRecord(
  input: CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // 1. 시간 검증 (기존 기록 정보 전달)
  const timeValidation = validateAttendanceTimes(input, existingRecord);
  if (!timeValidation.valid) {
    errors.push(...timeValidation.errors);
  }

  // 2. 방법 일관성 검증 (기존 기록 정보 전달)
  const methodValidation = validateAttendanceMethodConsistency(input, existingRecord);
  if (!methodValidation.valid) {
    errors.push(...methodValidation.errors);
  }

  // 3. 중복 처리 방지 검증 (CreateAttendanceRecordInput인 경우만)
  if ("student_id" in input && "attendance_date" in input) {
    const duplicateValidation = await validateNoDuplicateAttendance(
      input.student_id,
      input.attendance_date,
      input,
      existingRecord
    );
    if (!duplicateValidation.valid) {
      errors.push(...duplicateValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

