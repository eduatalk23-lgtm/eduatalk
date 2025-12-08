"use server";

import { revalidatePath } from "next/cache";
import { sendSMS, sendBulkSMS } from "@/lib/services/smsService";
import {
  formatSMSTemplate,
  type SMSTemplateType,
} from "@/lib/services/smsTemplates";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 출석 관련 SMS 발송
 */
export async function sendAttendanceSMS(
  studentId: string,
  templateType:
    | "attendance_check_in"
    | "attendance_check_out"
    | "attendance_absent"
    | "attendance_late",
  variables: Record<string, string>
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  return withErrorHandling(async () => {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 학생 정보 조회
    const supabase = await createSupabaseServerClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, parent_contact")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error("[SMS] 학생 정보 조회 실패:", studentError);
      throw new AppError(
        "학생 정보를 조회하는 중 오류가 발생했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!student) {
      throw new AppError(
        "학생 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (!student.parent_contact) {
      throw new AppError(
        "학부모 연락처가 등록되지 않았습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 템플릿 포맷팅
    const message = formatSMSTemplate(templateType, {
      ...variables,
      학생명: student.name || "학생",
    });

    // SMS 발송
    const result = await sendSMS({
      recipientPhone: student.parent_contact,
      message,
      recipientId: studentId,
      tenantId: tenantContext.tenantId,
    });

    if (!result.success) {
      throw new AppError(
        result.error || "SMS 발송에 실패했습니다.",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        500,
        true
      );
    }

    revalidatePath("/admin/sms");
    return { success: true, msgId: result.msgId };
  });
}

/**
 * 여러 학생에게 일괄 출석 SMS 발송
 */
export async function sendBulkAttendanceSMS(
  studentIds: string[],
  templateType:
    | "attendance_check_in"
    | "attendance_check_out"
    | "attendance_absent"
    | "attendance_late",
  variables: Record<string, string>
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 학생 정보 일괄 조회
    const supabase = await createSupabaseServerClient();
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name, parent_contact")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[SMS] 학생 정보 조회 실패:", studentsError);
      throw new AppError(
        "학생 정보를 조회하는 중 오류가 발생했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!students || students.length === 0) {
      throw new AppError(
        "학생 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // SMS 발송 대상 준비
    const recipients = students
      .filter((student) => student.parent_contact)
      .map((student) => ({
        phone: student.parent_contact!,
        message: formatSMSTemplate(templateType, {
          ...variables,
          학생명: student.name || "학생",
        }),
        recipientId: student.id,
      }));

    if (recipients.length === 0) {
      throw new AppError(
        "발송 가능한 학부모 연락처가 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 대량 발송
    const result = await sendBulkSMS(
      recipients,
      tenantContext.tenantId
    );

    // 결과 매핑 (studentId 포함)
    const errors = result.errors.map((err, index) => {
      const recipient = recipients[index];
      return {
        studentId: recipient.recipientId || "",
        error: err.error,
      };
    });

    revalidatePath("/admin/sms");
    return {
      success: result.success,
      failed: result.failed,
      errors,
    };
  });
}

/**
 * 일반 SMS 발송 (공지사항 등)
 */
export async function sendGeneralSMS(
  recipientPhone: string,
  message: string,
  recipientId?: string
): Promise<{ success: boolean; msgId?: string; error?: string }> {
  return withErrorHandling(async () => {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const result = await sendSMS({
      recipientPhone,
      message,
      recipientId,
      tenantId: tenantContext.tenantId,
    });

    if (!result.success) {
      throw new AppError(
        result.error || "SMS 발송에 실패했습니다.",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        500,
        true
      );
    }

    revalidatePath("/admin/sms");
    return { success: true, msgId: result.msgId };
  });
}

/**
 * 여러 학생에게 일괄 일반 SMS 발송
 */
export async function sendBulkGeneralSMS(
  studentIds: string[],
  message: string,
  templateVariables?: Record<string, string>
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
  return withErrorHandling(async () => {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    if (!studentIds || studentIds.length === 0) {
      throw new AppError(
        "발송 대상 학생을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 학생 정보 일괄 조회
    const supabase = await createSupabaseServerClient();
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name, parent_contact")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[SMS] 학생 정보 조회 실패:", studentsError);
      throw new AppError(
        "학생 정보를 조회하는 중 오류가 발생했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    if (!students || students.length === 0) {
      throw new AppError(
        "학생 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 학원명 조회
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantContext.tenantId)
      .single();

    const academyName = tenant?.name || "학원";

    // SMS 발송 대상 준비 (학부모 연락처가 있는 학생만)
    const recipients = students
      .filter((student) => student.parent_contact)
      .map((student) => {
        // 각 학생별로 메시지 변수 치환
        let finalMessage = message;
        
        // 학생명 자동 치환 (항상)
        finalMessage = finalMessage.replace(
          /\{학생명\}/g,
          student.name || "학생"
        );
        
        // 학원명 자동 치환 (항상)
        finalMessage = finalMessage.replace(/\{학원명\}/g, academyName);
        
        // 템플릿 변수가 있으면 추가 변수 치환
        if (templateVariables) {
          for (const [key, value] of Object.entries(templateVariables)) {
            if (key !== "학생명" && key !== "학원명" && value) {
              finalMessage = finalMessage.replace(
                new RegExp(`\\{${key}\\}`, "g"),
                value
              );
            }
          }
        }

        return {
          phone: student.parent_contact!,
          message: finalMessage,
          recipientId: student.id,
        };
      });

    if (recipients.length === 0) {
      throw new AppError(
        "발송 가능한 학부모 연락처가 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 대량 발송
    const result = await sendBulkSMS(recipients, tenantContext.tenantId);

    // 결과 매핑 (studentId 포함)
    const errors = result.errors.map((err, index) => {
      const recipient = recipients[index];
      return {
        studentId: recipient.recipientId || "",
        error: err.error,
      };
    });

    revalidatePath("/admin/sms");
    return {
      success: result.success,
      failed: result.failed,
      errors,
    };
  });
}

