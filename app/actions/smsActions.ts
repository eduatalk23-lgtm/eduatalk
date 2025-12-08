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
  return await withErrorHandling(async () => {
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

    // 학생 정보 조회 (mother_phone, father_phone 사용)
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, mother_phone, father_phone")
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

    // 설정에 따라 수신자 결정
    let recipientPhones: string[] = [];
    
    switch (recipientSetting) {
      case 'mother':
        if (student.mother_phone) {
          recipientPhones = [student.mother_phone];
        }
        break;
      case 'father':
        if (student.father_phone) {
          recipientPhones = [student.father_phone];
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
      default:
        // 기존 로직: 먼저 있는 번호 사용
        const parentContact = student.mother_phone || student.father_phone;
        if (parentContact) {
          recipientPhones = [parentContact];
        }
        break;
    }

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
      학생명: student.name || "학생",
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
    return { success: true, msgId: lastMsgId };
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
  return await withErrorHandling(async () => {
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

    // 학생 정보 일괄 조회 (phone, mother_phone, father_phone 모두 조회)
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name, mother_phone, father_phone")
      .in("id", studentIds);

    // student_profiles 테이블에서 phone 정보 조회
    let profiles: Array<{ id: string; phone?: string | null; mother_phone?: string | null; father_phone?: string | null }> = [];
    if (studentIds.length > 0) {
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from("student_profiles")
          .select("id, phone, mother_phone, father_phone")
          .in("id", studentIds);
        
        if (!profilesError && profilesData) {
          profiles = profilesData;
        }
      } catch (e) {
        // student_profiles 테이블이 없으면 무시
      }
    }

    // 프로필 정보를 학생 정보와 병합
    const studentsWithPhones = (students ?? []).map((student: any) => {
      const profile = profiles.find((p: any) => p.id === student.id);
      return {
        ...student,
        phone: profile?.phone ?? null,
        mother_phone: profile?.mother_phone ?? student.mother_phone ?? null,
        father_phone: profile?.father_phone ?? student.father_phone ?? null,
      };
    });

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

    // 설정에 따라 SMS 발송 대상 준비
    const recipients: Array<{
      phone: string;
      message: string;
      recipientId: string;
    }> = [];

    for (const student of studentsWithPhones) {
      // 설정에 따라 수신자 결정
      let recipientPhones: string[] = [];
      
      switch (recipientSetting) {
        case 'mother':
          if (student.mother_phone) {
            recipientPhones = [student.mother_phone];
          }
          break;
        case 'father':
          if (student.father_phone) {
            recipientPhones = [student.father_phone];
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
        default:
          // 기존 로직: 먼저 있는 번호 사용
          const parentContact = student.mother_phone || student.father_phone;
          if (parentContact) {
            recipientPhones = [parentContact];
          }
          break;
      }

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
  return await withErrorHandling(async () => {
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
    return { success: true, msgId: result.messageKey };
  });
}

/**
 * 여러 학생에게 일괄 일반 SMS 발송
 */
export async function sendBulkGeneralSMS(
  studentIds: string[],
  message: string,
  templateVariables?: Record<string, string>,
  recipientType: "student" | "mother" | "father" = "mother"
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
  return await withErrorHandling(async () => {
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
      .select("id, name")
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

    // student_profiles 테이블에서 phone 정보 조회 (학생 본인 연락처)
    const studentIds = students.map((s: any) => s.id);
    let profiles: Array<{ id: string; phone?: string | null; mother_phone?: string | null; father_phone?: string | null }> = [];
    
    if (studentIds.length > 0) {
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from("student_profiles")
          .select("id, phone, mother_phone, father_phone")
          .in("id", studentIds);
        
        if (!profilesError && profilesData) {
          profiles = profilesData;
        }
      } catch (e) {
        // student_profiles 테이블이 없으면 무시
      }
    }

    // 프로필 정보를 학생 정보와 병합 (student_profiles 우선, 없으면 students 테이블 사용)
    const studentsWithPhones = students.map((s: any) => {
      const profile = profiles.find((p: any) => p.id === s.id);
      return {
        ...s,
        phone: profile?.phone ?? null,
        mother_phone: profile?.mother_phone ?? s.mother_phone ?? null,
        father_phone: profile?.father_phone ?? s.father_phone ?? null,
      };
    });

    // 전송 대상자에 따라 전화번호 선택
    const getPhoneByRecipientType = (student: any, type: "student" | "mother" | "father"): string | null => {
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
  });
}

