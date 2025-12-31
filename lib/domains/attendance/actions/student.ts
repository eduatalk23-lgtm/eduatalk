"use server";

/**
 * Student Attendance Actions
 *
 * Student-facing Server Actions for attendance check-in/out.
 */

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { recordAttendance } from "@/lib/domains/attendance/service";
import { verifyQRCode } from "@/lib/services/qrCodeService";
import { verifyLocationCheckIn } from "@/lib/services/locationService";
import { findAttendanceByStudentAndDate } from "@/lib/domains/attendance/repository";
import { revalidatePath } from "next/cache";
import {
  AppError,
  ErrorCode,
  normalizeError,
  getUserFacingMessage,
  logError,
  withErrorHandling,
} from "@/lib/errors";
import {
  logActionError,
  logActionDebug,
  logActionWarn,
} from "@/lib/logging/actionLogger";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendAttendanceSMSIfEnabled } from "@/lib/services/attendanceSMSService";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * QR 코드로 출석 체크인
 */
export async function checkInWithQRCode(
  qrData: string
): Promise<{ success: boolean; error?: string; smsFailure?: string }> {
  try {
    return await withErrorHandling(async () => {
      const stepContext: Record<string, unknown> = {
        function: "checkInWithQRCode",
        timestamp: new Date().toISOString(),
      };

      // Step 1: 인증 확인
      stepContext.step = "authentication";
      const user = await requireStudentAuth();
      stepContext.userId = user.userId;

      // Step 2: 테넌트 컨텍스트
      stepContext.step = "tenant_context";
      const tenantContext = await getTenantContext();
      stepContext.tenantId = tenantContext?.tenantId;

      // Step 3: QR 코드 검증 (DB 기반, 사용 통계 자동 업데이트)
      stepContext.step = "qr_verification";
      stepContext.qrDataLength = qrData?.length || 0;
      stepContext.qrDataPreview = qrData?.substring(0, 50) || "";

      const verification = await verifyQRCode(qrData);
      if (!verification.valid) {
        throw new AppError(
          verification.error || "QR 코드가 유효하지 않습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true,
          { stepContext }
        );
      }
      stepContext.verifiedQRCodeId = verification.qrCodeId;
      stepContext.verifiedTenantId = verification.tenantId;

      // Step 4: 테넌트 일치 확인
      stepContext.step = "tenant_verification";
      if (verification.tenantId !== tenantContext?.tenantId) {
        throw new AppError(
          "다른 학원의 QR 코드입니다.",
          ErrorCode.VALIDATION_ERROR,
          403,
          true,
          {
            stepContext: {
              ...stepContext,
              verificationTenantId: verification.tenantId,
              contextTenantId: tenantContext?.tenantId,
            },
          }
        );
      }

      // Step 5: 날짜 준비
      stepContext.step = "date_preparation";
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      stepContext.today = today;
      stepContext.now = now;

      // Step 6: 기존 기록 확인 (중복 체크 방지)
      stepContext.step = "existing_record_check";
      const existing = await findAttendanceByStudentAndDate(user.userId, today);
      if (existing && existing.check_in_time) {
        throw new AppError(
          "이미 입실 체크가 완료되었습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true,
          {
            stepContext: {
              ...stepContext,
              existingRecordId: existing.id,
              existingCheckInTime: existing.check_in_time,
            },
          }
        );
      }
      stepContext.hasExistingRecord = !!existing;
      stepContext.existingRecordId = existing?.id || null;

      // Step 7: 출석 기록 저장
      stepContext.step = "attendance_record_save";
      try {
        const record = await recordAttendance({
          student_id: user.userId,
          attendance_date: today,
          check_in_time: now,
          check_in_method: "qr",
          status: "present",
        });
        stepContext.recordId = record.id;
        stepContext.recordStatus = record.status;
      } catch (recordError) {
        let errorMessage = "알 수 없는 오류가 발생했습니다.";
        if (recordError instanceof Error) {
          errorMessage = recordError.message;
        } else if (recordError && typeof recordError === "object") {
          if (
            "message" in recordError &&
            typeof recordError.message === "string"
          ) {
            errorMessage = recordError.message;
          } else {
            errorMessage = JSON.stringify(recordError);
          }
        } else {
          errorMessage = String(recordError);
        }

        stepContext.recordError = {
          message: errorMessage,
          code:
            recordError &&
            typeof recordError === "object" &&
            "code" in recordError
              ? (recordError as { code: string }).code
              : undefined,
          details:
            recordError &&
            typeof recordError === "object" &&
            "details" in recordError
              ? (recordError as { details?: unknown }).details
              : undefined,
          hint:
            recordError &&
            typeof recordError === "object" &&
            "hint" in recordError
              ? (recordError as { hint?: string }).hint
              : undefined,
        };

        throw new AppError(errorMessage, ErrorCode.DATABASE_ERROR, 500, true, {
          stepContext,
        });
      }

      // Step 8: SMS 발송 (비동기, 실패해도 출석 기록은 저장됨)
      stepContext.step = "sms_notification";
      try {
        const supabase = await createSupabaseServerClient();

        // 학생 정보 조회
        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("id, name")
          .eq("id", user.userId)
          .single();

        if (studentError) {
          stepContext.smsError = {
            step: "student_fetch",
            error: studentError.message,
            code: studentError.code,
          };
          throw studentError;
        }

        // 학원명 조회
        const { data: tenant, error: tenantError } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", tenantContext?.tenantId)
          .single();

        if (tenantError) {
          stepContext.smsError = {
            step: "tenant_fetch",
            error: tenantError.message,
            code: tenantError.code,
          };
          throw tenantError;
        }

        if (student && tenant) {
          const checkInTime = new Date(now).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const smsResult = await sendAttendanceSMSIfEnabled(
            user.userId,
            "attendance_check_in",
            {
              학원명: tenant.name,
              학생명: student.name || "학생",
              시간: checkInTime,
            },
            true
          );

          stepContext.smsResult = {
            success: smsResult.success,
            skipped: smsResult.skipped,
            errorType: smsResult.errorType,
            error: smsResult.error,
            details: smsResult.details,
          };

          if (smsResult.skipped) {
            logActionDebug(
              { domain: "attendance", action: "checkInWithQRCode" },
              `입실 SMS 발송 건너뛰기: ${smsResult.error}`,
              {
                studentId: user.userId,
                details: smsResult.details,
              }
            );
            stepContext.smsSkipped = true;
          } else if (smsResult.error) {
            logError(
              new AppError(
                smsResult.error || "SMS 발송에 실패했습니다.",
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                500,
                false
              ),
              {
                ...stepContext,
                smsErrorType: smsResult.errorType,
                smsErrorDetails: smsResult.details,
              }
            );
            stepContext.smsError = {
              type: smsResult.errorType || "unknown",
              message: smsResult.error,
              details: smsResult.details,
            };

            try {
              const { data: tenantSettings } = await supabase
                .from("tenants")
                .select("attendance_sms_show_failure_to_user")
                .eq("id", tenantContext?.tenantId)
                .single();

              if (tenantSettings?.attendance_sms_show_failure_to_user) {
                stepContext.smsFailureMessage = smsResult.error;
              }
            } catch (configError) {
              logActionError(
                { domain: "attendance", action: "checkInWithQRCode" },
                configError,
                { step: "sms_config_check" }
              );
            }
          } else {
            stepContext.smsSent = true;
            stepContext.smsMsgId = smsResult.details?.msgId;
          }
        }
      } catch (smsError) {
        const smsErrorInfo = stepContext.smsError as
          | { step?: string }
          | undefined;
        logError(normalizeError(smsError), {
          ...stepContext,
          smsErrorStep: smsErrorInfo?.step || "unknown",
        });
        stepContext.smsError = {
          ...(smsErrorInfo || {}),
          ignored: true,
        };
      }

      revalidatePath("/attendance/check-in");
      return { success: true };
    })();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 위치 기반 출석 체크인
 */
export async function checkInWithLocation(
  latitude: number,
  longitude: number
): Promise<{ success: boolean; error?: string; distance?: number }> {
  const handler = withErrorHandling(async () => {
    const user = await requireStudentAuth();

    const verification = await verifyLocationCheckIn(latitude, longitude);
    if (!verification.valid) {
      throw new AppError(
        verification.error || "학원 위치에서 너무 멀리 떨어져 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const existing = await findAttendanceByStudentAndDate(user.userId, today);
    if (existing && existing.check_in_time) {
      throw new AppError(
        "이미 입실 체크가 완료되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_in_time: now,
      check_in_method: "location",
      status: "present",
    });

    // SMS 발송
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      const { data: student } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", user.userId)
        .single();

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext?.tenantId)
        .single();

      if (student && tenant) {
        const checkInTime = new Date(now).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const smsResult = await sendAttendanceSMSIfEnabled(
          user.userId,
          "attendance_check_in",
          {
            학원명: tenant.name,
            학생명: student.name || "학생",
            시간: checkInTime,
          },
          true
        );

        if (smsResult.skipped) {
          logActionDebug(
            { domain: "attendance", action: "checkInWithLocation" },
            `입실 SMS 발송 건너뛰기: ${smsResult.error}`,
            { studentId: user.userId, details: smsResult.details }
          );
        } else if (smsResult.error) {
          logActionError(
            { domain: "attendance", action: "checkInWithLocation" },
            new Error(smsResult.error),
            {
              studentId: user.userId,
              errorType: smsResult.errorType,
              details: smsResult.details,
            }
          );
        }
      }
    } catch (error) {
      logActionError(
        { domain: "attendance", action: "checkInWithLocation" },
        error,
        { step: "sms_notification" }
      );
    }

    revalidatePath("/attendance/check-in");
    return {
      success: true,
      distance: verification.distance,
    };
  });
  return await handler();
}

/**
 * QR 코드로 출석 체크아웃
 */
export async function checkOutWithQRCode(
  qrData: string
): Promise<{ success: boolean; error?: string; smsFailure?: string }> {
  try {
    return await withErrorHandling(async () => {
      const stepContext: Record<string, unknown> = {
        function: "checkOutWithQRCode",
        timestamp: new Date().toISOString(),
      };

      stepContext.step = "authentication";
      const user = await requireStudentAuth();
      stepContext.userId = user.userId;

      stepContext.step = "tenant_context";
      const tenantContext = await getTenantContext();
      stepContext.tenantId = tenantContext?.tenantId;

      stepContext.step = "qr_verification";
      stepContext.qrDataLength = qrData?.length || 0;
      stepContext.qrDataPreview = qrData?.substring(0, 50) || "";

      const verification = await verifyQRCode(qrData);
      if (!verification.valid) {
        throw new AppError(
          verification.error || "QR 코드가 유효하지 않습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true,
          { stepContext }
        );
      }
      stepContext.verifiedQRCodeId = verification.qrCodeId;
      stepContext.verifiedTenantId = verification.tenantId;

      stepContext.step = "tenant_verification";
      if (verification.tenantId !== tenantContext?.tenantId) {
        throw new AppError(
          "다른 학원의 QR 코드입니다.",
          ErrorCode.VALIDATION_ERROR,
          403,
          true,
          {
            stepContext: {
              ...stepContext,
              verificationTenantId: verification.tenantId,
              contextTenantId: tenantContext?.tenantId,
            },
          }
        );
      }

      stepContext.step = "date_preparation";
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      stepContext.today = today;
      stepContext.now = now;

      stepContext.step = "check_in_record_check";
      const existing = await findAttendanceByStudentAndDate(user.userId, today);
      if (!existing) {
        throw new AppError(
          "입실 기록이 없습니다. 먼저 입실 체크를 해주세요.",
          ErrorCode.NOT_FOUND,
          404,
          true,
          { stepContext }
        );
      }
      stepContext.existingRecordId = existing.id;
      stepContext.existingCheckInTime = existing.check_in_time;
      stepContext.existingCheckInMethod = existing.check_in_method;

      stepContext.step = "check_out_status_check";
      if (existing.check_out_time) {
        throw new AppError(
          "이미 퇴실 처리되었습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true,
          {
            stepContext: {
              ...stepContext,
              existingCheckOutTime: existing.check_out_time,
            },
          }
        );
      }

      stepContext.step = "attendance_record_update";
      try {
        const record = await recordAttendance({
          student_id: user.userId,
          attendance_date: today,
          check_out_time: now,
          check_out_method: "qr",
        });
        stepContext.recordId = record.id;
        stepContext.recordStatus = record.status;
      } catch (recordError) {
        let errorMessage = "알 수 없는 오류가 발생했습니다.";
        if (recordError instanceof Error) {
          errorMessage = recordError.message;
        } else if (recordError && typeof recordError === "object") {
          if (
            "message" in recordError &&
            typeof recordError.message === "string"
          ) {
            errorMessage = recordError.message;
          } else {
            errorMessage = JSON.stringify(recordError);
          }
        } else {
          errorMessage = String(recordError);
        }

        stepContext.recordError = {
          message: errorMessage,
          code:
            recordError &&
            typeof recordError === "object" &&
            "code" in recordError
              ? (recordError as { code: string }).code
              : undefined,
          details:
            recordError &&
            typeof recordError === "object" &&
            "details" in recordError
              ? (recordError as { details?: unknown }).details
              : undefined,
          hint:
            recordError &&
            typeof recordError === "object" &&
            "hint" in recordError
              ? (recordError as { hint?: string }).hint
              : undefined,
        };

        throw new AppError(errorMessage, ErrorCode.DATABASE_ERROR, 500, true, {
          stepContext,
        });
      }

      // SMS 발송
      stepContext.step = "sms_notification";
      try {
        const supabase = await createSupabaseServerClient();

        const { data: student, error: studentError } = await supabase
          .from("students")
          .select("id, name")
          .eq("id", user.userId)
          .single();

        if (studentError) {
          stepContext.smsError = {
            step: "student_fetch",
            error: studentError.message,
            code: studentError.code,
          };
          throw studentError;
        }

        const { data: tenant, error: tenantError } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", tenantContext?.tenantId)
          .single();

        if (tenantError) {
          stepContext.smsError = {
            step: "tenant_fetch",
            error: tenantError.message,
            code: tenantError.code,
          };
          throw tenantError;
        }

        if (student && tenant) {
          const checkOutTime = new Date(now).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const smsResult = await sendAttendanceSMSIfEnabled(
            user.userId,
            "attendance_check_out",
            {
              학원명: tenant.name,
              학생명: student.name || "학생",
              시간: checkOutTime,
            },
            true
          );

          stepContext.smsResult = {
            success: smsResult.success,
            skipped: smsResult.skipped,
            errorType: smsResult.errorType,
            error: smsResult.error,
            details: smsResult.details,
          };

          if (smsResult.skipped) {
            logActionDebug(
              { domain: "attendance", action: "checkOutWithQRCode" },
              `퇴실 SMS 발송 건너뛰기: ${smsResult.error}`,
              {
                studentId: user.userId,
                details: smsResult.details,
              }
            );
            stepContext.smsSkipped = true;
          } else if (smsResult.error) {
            logError(
              new AppError(
                smsResult.error || "SMS 발송에 실패했습니다.",
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                500,
                false
              ),
              {
                ...stepContext,
                smsErrorType: smsResult.errorType,
                smsErrorDetails: smsResult.details,
              }
            );
            stepContext.smsError = {
              type: smsResult.errorType || "unknown",
              message: smsResult.error,
              details: smsResult.details,
            };

            try {
              const { data: tenantSettings } = await supabase
                .from("tenants")
                .select("attendance_sms_show_failure_to_user")
                .eq("id", tenantContext?.tenantId)
                .single();

              if (tenantSettings?.attendance_sms_show_failure_to_user) {
                stepContext.smsFailureMessage = smsResult.error;
              }
            } catch (configError) {
              logActionError(
                { domain: "attendance", action: "checkOutWithQRCode" },
                configError,
                { step: "sms_config_check" }
              );
            }
          } else {
            stepContext.smsSent = true;
            stepContext.smsMsgId = smsResult.details?.msgId;
          }
        }
      } catch (smsError) {
        const smsErrorInfo = stepContext.smsError as
          | { step?: string }
          | undefined;
        logError(normalizeError(smsError), {
          ...stepContext,
          smsErrorStep: smsErrorInfo?.step || "unknown",
        });
        stepContext.smsError = {
          ...(smsErrorInfo || {}),
          ignored: true,
        };
      }

      revalidatePath("/attendance/check-in");

      const smsFailureMessage = stepContext.smsFailureMessage as
        | string
        | undefined;

      return {
        success: true,
        ...(smsFailureMessage && { smsFailure: smsFailureMessage }),
      };
    })();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 위치 기반 출석 체크아웃
 */
export async function checkOutWithLocation(
  latitude: number,
  longitude: number
): Promise<{ success: boolean; error?: string; distance?: number }> {
  const handler = withErrorHandling(async () => {
    const user = await requireStudentAuth();

    const verification = await verifyLocationCheckIn(latitude, longitude);
    if (!verification.valid) {
      throw new AppError(
        verification.error || "학원 위치에서 너무 멀리 떨어져 있습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

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

    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_out_time: now,
      check_out_method: "location",
    });

    // SMS 발송
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      const { data: student } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", user.userId)
        .single();

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext?.tenantId)
        .single();

      if (student && tenant) {
        const checkOutTime = new Date(now).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const smsResult = await sendAttendanceSMSIfEnabled(
          user.userId,
          "attendance_check_out",
          {
            학원명: tenant.name,
            학생명: student.name || "학생",
            시간: checkOutTime,
          },
          true
        );

        if (smsResult.skipped) {
          logActionDebug(
            { domain: "attendance", action: "checkOutWithLocation" },
            `퇴실 SMS 발송 건너뛰기: ${smsResult.error}`,
            { studentId: user.userId, details: smsResult.details }
          );
        } else if (smsResult.error) {
          logActionError(
            { domain: "attendance", action: "checkOutWithLocation" },
            new Error(smsResult.error),
            {
              studentId: user.userId,
              errorType: smsResult.errorType,
              details: smsResult.details,
            }
          );
        }
      }
    } catch (error) {
      logActionError(
        { domain: "attendance", action: "checkOutWithLocation" },
        error,
        { step: "sms_notification" }
      );
    }

    revalidatePath("/attendance/check-in");
    return {
      success: true,
      distance: verification.distance,
    };
  });
  return await handler();
}

/**
 * 퇴실 체크
 */
export async function checkOut(): Promise<{
  success: boolean;
  error?: string;
}> {
  const handler = withErrorHandling(async () => {
    const user = await requireStudentAuth();

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

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

    await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_out_time: now,
      check_out_method: existing.check_in_method || "manual",
    });

    // SMS 발송
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      const { data: student } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", user.userId)
        .single();

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext?.tenantId)
        .single();

      if (student && tenant) {
        const checkOutTime = new Date(now).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const smsResult = await sendAttendanceSMSIfEnabled(
          user.userId,
          "attendance_check_out",
          {
            학원명: tenant.name,
            학생명: student.name || "학생",
            시간: checkOutTime,
          },
          true
        );

        if (smsResult.skipped) {
          logActionDebug(
            { domain: "attendance", action: "checkOut" },
            `퇴실 SMS 발송 건너뛰기: ${smsResult.error}`,
            { studentId: user.userId, details: smsResult.details }
          );
        } else if (smsResult.error) {
          logActionError(
            { domain: "attendance", action: "checkOut" },
            new Error(smsResult.error),
            {
              studentId: user.userId,
              errorType: smsResult.errorType,
              details: smsResult.details,
            }
          );
        }
      }
    } catch (error) {
      logActionError(
        { domain: "attendance", action: "checkOut" },
        error,
        { step: "sms_notification" }
      );
    }

    revalidatePath("/attendance/check-in");
    return { success: true };
  });
  return await handler();
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
  const handler = withErrorHandling(async () => {
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
  return await handler();
}

/**
 * 오늘 출석 관련 SMS 발송 상태 조회
 */
export async function getTodayAttendanceSMSStatus(): Promise<{
  success: boolean;
  data?: {
    checkInSMS?: {
      status: "pending" | "sent" | "delivered" | "failed";
      sentAt: string | null;
      errorMessage: string | null;
    } | null;
    checkOutSMS?: {
      status: "pending" | "sent" | "delivered" | "failed";
      sentAt: string | null;
      errorMessage: string | null;
    } | null;
  } | null;
  error?: string;
}> {
  const handler = withErrorHandling(async () => {
    const user = await requireStudentAuth();
    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();

    if (!tenantContext?.tenantId) {
      return {
        success: true,
        data: null,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    const { data: smsLogs, error } = await supabase
      .from("sms_logs")
      .select("id, status, sent_at, error_message, message_content, created_at")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("recipient_id", user.userId)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .or("message_content.ilike.%입실%,message_content.ilike.%퇴실%")
      .order("created_at", { ascending: false });

    if (error) {
      logActionError(
        { domain: "attendance", action: "getTodayAttendanceSMSStatus" },
        error,
        { step: "sms_log_query" }
      );
      return {
        success: true,
        data: null,
      };
    }

    const checkInSMS = smsLogs?.find((log) =>
      log.message_content.includes("입실")
    );
    const checkOutSMS = smsLogs?.find((log) =>
      log.message_content.includes("퇴실")
    );

    return {
      success: true,
      data: {
        checkInSMS: checkInSMS
          ? {
              status: checkInSMS.status as
                | "pending"
                | "sent"
                | "delivered"
                | "failed",
              sentAt: checkInSMS.sent_at,
              errorMessage: checkInSMS.error_message,
            }
          : null,
        checkOutSMS: checkOutSMS
          ? {
              status: checkOutSMS.status as
                | "pending"
                | "sent"
                | "delivered"
                | "failed",
              sentAt: checkOutSMS.sent_at,
              errorMessage: checkOutSMS.error_message,
            }
          : null,
      },
    };
  });
  return await handler();
}
