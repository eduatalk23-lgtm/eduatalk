"use server";

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { recordAttendance } from "@/lib/domains/attendance/service";
import { verifyQRCode } from "@/lib/services/qrCodeService";
import { verifyLocationCheckIn } from "@/lib/services/locationService";
import { findAttendanceByStudentAndDate } from "@/lib/domains/attendance/repository";
import { revalidatePath } from "next/cache";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

/**
 * QR 코드로 출석 체크인
 */
export async function checkInWithQRCode(
  qrData: string
): Promise<{ success: boolean; error?: string }> {
  return withErrorHandling(async () => {
    const user = await requireStudentAuth();
    const tenantContext = await getTenantContext();

    // QR 코드 검증
    const verification = verifyQRCode(qrData);
    if (!verification.valid) {
      throw new AppError(
        verification.error || "QR 코드가 유효하지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 테넌트 일치 확인
    if (verification.tenantId !== tenantContext?.tenantId) {
      throw new AppError(
        "다른 학원의 QR 코드입니다.",
        ErrorCode.VALIDATION_ERROR,
        403,
        true
      );
    }

    // 오늘 날짜
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // 기존 기록 확인 (중복 체크 방지)
    const existing = await findAttendanceByStudentAndDate(user.userId, today);
    if (existing && existing.check_in_time) {
      throw new AppError(
        "이미 입실 체크가 완료되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 출석 기록 생성 또는 업데이트
    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_in_time: now,
      check_in_method: "qr",
      status: "present",
    });

    revalidatePath("/attendance/check-in");
    return { success: true };
  });
}

/**
 * 위치 기반 출석 체크인
 */
export async function checkInWithLocation(
  latitude: number,
  longitude: number
): Promise<{ success: boolean; error?: string; distance?: number }> {
  return withErrorHandling(async () => {
    const user = await requireStudentAuth();

    // 위치 검증
    const verification = await verifyLocationCheckIn(latitude, longitude);
    if (!verification.valid) {
      throw new AppError(
        verification.error || "학원 위치에서 너무 멀리 떨어져 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 오늘 날짜
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // 기존 기록 확인 (중복 체크 방지)
    const existing = await findAttendanceByStudentAndDate(user.userId, today);
    if (existing && existing.check_in_time) {
      throw new AppError(
        "이미 입실 체크가 완료되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 출석 기록 생성 또는 업데이트
    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_in_time: now,
      check_in_method: "location",
      status: "present",
    });

    revalidatePath("/attendance/check-in");
    return {
      success: true,
      distance: verification.distance,
    };
  });
}

/**
 * 퇴실 체크
 */
export async function checkOut(): Promise<{ success: boolean; error?: string }> {
  return withErrorHandling(async () => {
    const user = await requireStudentAuth();

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // 기존 기록 확인
    const existing = await findAttendanceByStudentAndDate(user.userId, today);

    if (!existing) {
      throw new AppError(
        "입실 기록이 없습니다. 먼저 입실 체크를 해주세요.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (existing.check_out_time) {
      throw new AppError(
        "이미 퇴실 처리되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 퇴실 기록 업데이트
    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_out_time: now,
      check_out_method: existing.check_in_method || "manual",
    });

    revalidatePath("/attendance/check-in");
    return { success: true };
  });
}

/**
 * 오늘 출석 기록 조회
 */
export async function getTodayAttendance(): Promise<{
  success: boolean;
  data?: {
    id: string;
    attendance_date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    check_in_method: string | null;
    check_out_method: string | null;
    status: string;
  } | null;
  error?: string;
}> {
  return withErrorHandling(async () => {
    const user = await requireStudentAuth();

    const today = new Date().toISOString().slice(0, 10);
    const record = await findAttendanceByStudentAndDate(user.userId, today);

    return {
      success: true,
      data: record
        ? {
            id: record.id,
            attendance_date: record.attendance_date,
            check_in_time: record.check_in_time,
            check_out_time: record.check_out_time,
            check_in_method: record.check_in_method,
            check_out_method: record.check_out_method,
            status: record.status,
          }
        : null,
    };
  });
}

