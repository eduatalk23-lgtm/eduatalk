"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { findLeadByPhone } from "@/lib/data/salesLeads";
import { scoreNewLead, scoreLeadActivity } from "./scoring";
import { createAutoTask } from "./tasks";
import { sendMissedCallNotification } from "./notifications";
import type {
  CrmActionResult,
  ConsultationInput,
  ActivityType,
  PipelineStatus,
  RegistrationChecklist,
  SalesLead,
} from "../types";

const CRM_PATH = "/admin/crm";

export async function createConsultationRecord(
  input: ConsultationInput
): Promise<CrmActionResult<{ activityId: string; leadId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!input.contactPhone?.trim()) {
      return { success: false, error: "전화번호를 입력해주세요." };
    }

    if (!input.consultationResult) {
      return { success: false, error: "상담 결과를 선택해주세요." };
    }

    const supabase = await createSupabaseServerClient();
    const performedBy = input.performedBy || userId;

    // 1. 리드 찾기 또는 생성
    let leadId: string;

    // 기존 리드 업데이트용 payload 생성 헬퍼
    const buildUpdatePayload = () => {
      const payload: Record<string, unknown> = {};
      if (input.contactName) payload.contact_name = input.contactName;
      if (input.studentName) payload.student_name = input.studentName;
      if (input.studentGrade) payload.student_grade = input.studentGrade;
      if (input.studentSchool)
        payload.student_school_name = input.studentSchool;
      if (input.region) payload.region = input.region;
      if (input.programId) payload.program_id = input.programId;
      return payload;
    };

    if (input.existingLeadId) {
      leadId = input.existingLeadId;

      const updatePayload = buildUpdatePayload();
      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from("sales_leads")
          .update(updatePayload)
          .eq("id", leadId);
      }
    } else {
      // 전화번호로 기존 리드 검색
      const existingLead = await findLeadByPhone(
        input.contactPhone.trim(),
        tenantId
      );

      if (existingLead) {
        leadId = existingLead.id;

        const updatePayload = buildUpdatePayload();
        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from("sales_leads")
            .update(updatePayload)
            .eq("id", leadId);
        }
      } else {
        // 새 리드 생성
        const contactNameValue =
          input.contactName || input.studentName || "미확인";

        const { data: newLead, error: leadError } = await supabase
          .from("sales_leads")
          .insert({
            tenant_id: tenantId,
            created_by: userId,
            contact_name: contactNameValue,
            contact_phone: input.contactPhone.trim(),
            student_name: input.studentName || null,
            student_grade: input.studentGrade || null,
            student_school_name: input.studentSchool || null,
            region: input.region || null,
            lead_source: input.leadSource,
            program_id: input.programId || null,
            assigned_to: performedBy,
            pipeline_status: "new" as PipelineStatus,
          })
          .select("id")
          .single();

        if (leadError || !newLead) {
          logActionError(
            {
              domain: "crm",
              action: "createConsultationRecord.createLead",
              tenantId,
              userId,
            },
            leadError
          );
          return { success: false, error: "리드 생성에 실패했습니다." };
        }

        leadId = newLead.id;

        // 프로그램 코드 조회 (스코어링용)
        let programCode: string | null = null;
        if (input.programId) {
          const { data: program } = await supabase
            .from("programs")
            .select("code")
            .eq("id", input.programId)
            .maybeSingle();
          programCode = program?.code ?? null;
        }

        scoreNewLead(leadId, {
          lead_source: input.leadSource,
          program_code: programCode,
          student_grade: input.studentGrade ?? null,
        }).catch(() => {});

        createAutoTask(leadId, "new", performedBy).catch(() => {});
      }
    }

    // 2. 활동 유형 매핑
    let activityType: ActivityType;
    switch (input.consultationResult) {
      case "consultation_done":
        activityType = "consultation";
        break;
      case "absent_sms":
        activityType = "phone_call";
        break;
      case "sms_info":
        activityType = "sms";
        break;
      case "spam":
        activityType = "consultation";
        break;
    }

    // 3. 활동 기록 생성
    const { data: activity, error: activityError } = await supabase
      .from("lead_activities")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        activity_type: activityType,
        title: getConsultationTitle(input.consultationResult),
        description: input.description?.trim() || null,
        performed_by: performedBy,
        activity_date: input.activityDate || new Date().toISOString(),
        metadata: {
          consultation_result: input.consultationResult,
          caller_type: input.callerType,
          ...(input.consultationResult === "spam" && { is_spam: true }),
        },
      })
      .select("id")
      .single();

    if (activityError || !activity) {
      logActionError(
        {
          domain: "crm",
          action: "createConsultationRecord.addActivity",
          tenantId,
          userId,
        },
        activityError
      );
      return { success: false, error: "활동 기록 생성에 실패했습니다." };
    }

    // 4. 파이프라인 상태 업데이트
    let newStatus: PipelineStatus | null = null;
    switch (input.consultationResult) {
      case "consultation_done":
        newStatus = "consulting_done";
        break;
      case "absent_sms":
      case "sms_info":
        newStatus = "contacted";
        break;
      case "spam":
        newStatus = "spam";
        break;
    }

    if (newStatus) {
      await supabase
        .from("sales_leads")
        .update({
          pipeline_status: newStatus,
          ...(newStatus === "spam" && { is_spam: true }),
        })
        .eq("id", leadId);
    }

    // 5. 체크리스트 업데이트
    if (input.checklist && Object.keys(input.checklist).length > 0) {
      const { data: lead } = await supabase
        .from("sales_leads")
        .select("registration_checklist")
        .eq("id", leadId)
        .maybeSingle();

      const currentChecklist =
        (lead?.registration_checklist as RegistrationChecklist) ?? {
          registered: false,
          documents: false,
          sms_sent: false,
          payment: false,
        };

      await supabase
        .from("sales_leads")
        .update({
          registration_checklist: { ...currentChecklist, ...input.checklist },
        })
        .eq("id", leadId);
    }

    // 6. 참여도 스코어링 (비동기)
    scoreLeadActivity(leadId, activityType).catch(() => {});

    // 7. 부재 안내 발송 (absent_sms인 경우)
    if (input.consultationResult === "absent_sms") {
      sendMissedCallNotification(leadId, { skipActivityLog: true })
        .then(async (result) => {
          // 발송 결과를 기존 활동 metadata에 반영
          await supabase
            .from("lead_activities")
            .update({
              metadata: {
                consultation_result: input.consultationResult,
                caller_type: input.callerType,
                missedCallSent: true,
                missedCallSuccess: result.success,
              },
            })
            .eq("id", activity.id);
        })
        .catch(() => {});
    }

    revalidatePath(CRM_PATH);
    revalidatePath(`${CRM_PATH}/leads`);
    return { success: true, data: { activityId: activity.id, leadId } };
  } catch (error) {
    logActionError(
      { domain: "crm", action: "createConsultationRecord" },
      error
    );
    return { success: false, error: "상담 기록 등록에 실패했습니다." };
  }
}

export async function lookupLeadByPhone(
  phone: string
): Promise<CrmActionResult<SalesLead | null>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!phone?.trim()) {
      return { success: true, data: null };
    }

    const lead = await findLeadByPhone(phone.trim(), tenantId);
    return { success: true, data: lead };
  } catch (error) {
    logActionError({ domain: "crm", action: "lookupLeadByPhone" }, error);
    return { success: false, error: "리드 조회에 실패했습니다." };
  }
}

function getConsultationTitle(result: ConsultationInput["consultationResult"]): string {
  switch (result) {
    case "consultation_done":
      return "전화 상담 완료";
    case "absent_sms":
      return "부재 - 문자 발송";
    case "sms_info":
      return "문자 안내 발송";
    case "spam":
      return "스팸 처리";
  }
}
