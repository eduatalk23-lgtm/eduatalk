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
import { AppError, ErrorCode } from "@/lib/errors";
import { getStudentPhones, getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import type { ActionResponse } from "@/lib/types/actionResponse";

/**
 * 테넌트 설정과 학생 정보를 기반으로 SMS 수신자 전화번호 목록 결정
 */
function determineRecipientPhones(
  recipientSetting: 'mother' | 'father' | 'both' | 'auto',
  student: { mother_phone: string | null; father_phone: string | null }
): string[] {
  const recipientPhones: string[] = [];
  
  switch (recipientSetting) {
    case 'mother':
      if (student.mother_phone) {
        recipientPhones.push(student.mother_phone);
      }
      break;
    case 'father':
      if (student.father_phone) {
        recipientPhones.push(student.father_phone);
      }
      break;
    case 'both':
      if (student.mother_phone) {
        recipientPhones.push(student.mother_phone);
      }
      if (student.father_phone) {
        recipientPhones.push(student.father_phone);
      }
      break;
    case 'auto':
    default: {
      // 기존 로직: 먼저 있는 번호 사용
      const parentContact = student.mother_phone || student.father_phone;
      if (parentContact) {
        recipientPhones.push(parentContact);
      }
      break;
    }
  }
  
  return recipientPhones;
}

/**
 * 출석 관련 SMS 발송 (내부 사용, 권한 체크 없음)
 * 학생 직접 체크인/체크아웃 시 사용
 */
async function _sendAttendanceSMSInternal(
  studentId: string,
  templateType:
    | "attendance_check_in"
    | "attendance_check_out"
    | "attendance_absent"
    | "attendance_late",
  variables: Record<string, string>
): Promise<{ msgId?: string }> {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 테넌트 SMS 수신자 설정 조회
  const supabase = await createSupabaseServerClient();
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("attendance_sms_recipient")
    .eq("id", tenantContext.tenantId)
    .single();

  if (tenantError) {
    console.error("[SMS] 테넌트 설정 조회 실패:", tenantError);
    throw new AppError(
      "테넌트 설정을 조회하는 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const recipientSetting = (tenant?.attendance_sms_recipient as 'mother' | 'father' | 'both' | 'auto') ?? 'auto';

  // 학생 전화번호 정보 조회 (공통 헬퍼 함수 사용)
  const studentPhoneData = await getStudentPhones(studentId);

  if (!studentPhoneData) {
    throw new AppError(
      "학생 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 설정에 따라 수신자 결정 (공통 함수 사용)
  const recipientPhones = determineRecipientPhones(recipientSetting, {
    mother_phone: studentPhoneData.mother_phone,
    father_phone: studentPhoneData.father_phone,
  });

  if (recipientPhones.length === 0) {
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
    학생명: studentPhoneData.name || "학생",
  });

  // SMS 발송 (여러 수신자인 경우 각각 발송)
  let lastMsgId: string | undefined;
  for (const recipientPhone of recipientPhones) {
    const result = await sendSMS({
      recipientPhone,
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

    lastMsgId = result.messageKey;
  }

  revalidatePath("/admin/sms");
  return { msgId: lastMsgId };
}

export const sendAttendanceSMSInternal = withActionResponse(_sendAttendanceSMSInternal);

/**
 * 출석 관련 SMS 발송 (관리자 전용)
 * 관리자 액션에서 사용
 */
async function _sendAttendanceSMS(
  studentId: string,
  templateType:
    | "attendance_check_in"
    | "attendance_check_out"
    | "attendance_absent"
    | "attendance_late",
  variables: Record<string, string>
): Promise<{ msgId?: string }> {
  await requireAdminAuth();
  const result = await _sendAttendanceSMSInternal(studentId, templateType, variables);
  return result;
}

export const sendAttendanceSMS = withActionResponse(_sendAttendanceSMS);

/**
 * 여러 학생에게 일괄 출석 SMS 발송
 */
async function _sendBulkAttendanceSMS(
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

  // 테넌트 SMS 수신자 설정 조회
  const supabase = await createSupabaseServerClient();
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("attendance_sms_recipient")
    .eq("id", tenantContext.tenantId)
    .single();

  if (tenantError) {
    console.error("[SMS] 테넌트 설정 조회 실패:", tenantError);
    throw new AppError(
      "테넌트 설정을 조회하는 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  const recipientSetting = (tenant?.attendance_sms_recipient as 'mother' | 'father' | 'both' | 'auto') ?? 'auto';

  // 학생 전화번호 정보 일괄 조회 (공통 헬퍼 함수 사용)
  const studentsWithPhones = await getStudentPhonesBatch(studentIds);

  if (studentsWithPhones.length === 0) {
    throw new AppError(
      "학생 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 설정에 따라 SMS 발송 대상 준비
  const recipients: Array<{
    phone: string;
    message: string;
    recipientId: string;
  }> = [];

  for (const student of studentsWithPhones) {
    // 설정에 따라 수신자 결정 (공통 함수 사용)
    const recipientPhones = determineRecipientPhones(recipientSetting, {
      mother_phone: student.mother_phone,
      father_phone: student.father_phone,
    });

    // 각 수신자에게 SMS 발송 대상 추가
    for (const recipientPhone of recipientPhones) {
      recipients.push({
        phone: recipientPhone,
        message: formatSMSTemplate(templateType, {
          ...variables,
          학생명: student.name || "학생",
        }),
        recipientId: student.id,
      });
    }
  }

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
}

export const sendBulkAttendanceSMS = withActionResponse(_sendBulkAttendanceSMS);

/**
 * 일반 SMS 발송 (공지사항 등)
 */
async function _sendGeneralSMS(
  recipientPhone: string,
  message: string,
  recipientId?: string
): Promise<{ msgId?: string }> {
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
  return { msgId: result.messageKey };
}

export const sendGeneralSMS = withActionResponse(_sendGeneralSMS);

/**
 * 여러 학생에게 일괄 일반 SMS 발송
 */
async function _sendBulkGeneralSMS(
  studentIds: string[],
  message: string,
  templateVariables?: Record<string, string>,
  recipientType: "student" | "mother" | "father" = "mother"
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
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

  // 학생 전화번호 정보 일괄 조회 (공통 헬퍼 함수 사용)
  const studentsWithPhones = await getStudentPhonesBatch(studentIds);

  if (studentsWithPhones.length === 0) {
    throw new AppError(
      "학생 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학원명 조회
  const supabase = await createSupabaseServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantContext.tenantId)
    .single();

  const academyName = tenant?.name || "학원";

  // 전송 대상자에 따라 전화번호 선택
  const getPhoneByRecipientType = (student: { phone: string | null; mother_phone: string | null; father_phone: string | null }, type: "student" | "mother" | "father"): string | null => {
    switch (type) {
      case "student":
        return student.phone;
      case "mother":
        return student.mother_phone;
      case "father":
        return student.father_phone;
      default:
        return student.mother_phone ?? student.father_phone ?? student.phone;
    }
  };

  // SMS 발송 대상 준비 (선택한 대상자 타입에 따라)
  const recipients = studentsWithPhones
    .map((student) => {
      const phone = getPhoneByRecipientType(student, recipientType);
      return { ...student, selectedPhone: phone };
    })
    .filter((student) => student.selectedPhone)
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
        phone: student.selectedPhone!,
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
}

export const sendBulkGeneralSMS = withActionResponse(_sendBulkGeneralSMS);
