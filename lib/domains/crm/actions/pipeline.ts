"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { createAutoTask } from "./tasks";
import type {
  CrmActionResult,
  PipelineStatus,
  RegistrationChecklist,
  PipelineStats,
} from "../types";

const CRM_PATH = "/admin/crm";

export async function updatePipelineStatus(
  leadId: string,
  newStatus: PipelineStatus
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 상태 조회 + 테넌트 확인
    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("pipeline_status, tenant_id, assigned_to")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const previousStatus = lead.pipeline_status;

    // 상태 업데이트
    const { error: updateError } = await supabase
      .from("sales_leads")
      .update({ pipeline_status: newStatus })
      .eq("id", leadId);

    if (updateError) {
      logActionError(
        { domain: "crm", action: "updatePipelineStatus", tenantId, userId },
        updateError,
        { leadId, previousStatus, newStatus }
      );
      return { success: false, error: updateError.message };
    }

    // status_change 활동 자동 생성
    await supabase.from("lead_activities").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      activity_type: "status_change",
      title: `상태 변경: ${previousStatus} → ${newStatus}`,
      previous_status: previousStatus,
      new_status: newStatus,
      performed_by: userId,
    });

    // SLA 기반 자동 태스크 생성 (비동기, 실패해도 상태 변경은 성공)
    createAutoTask(leadId, newStatus, lead.assigned_to).catch(() => {});

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "crm", action: "updatePipelineStatus" },
      error,
      { leadId, newStatus }
    );
    return { success: false, error: "상태 변경에 실패했습니다." };
  }
}

export async function updateRegistrationChecklist(
  leadId: string,
  checklist: Partial<RegistrationChecklist>
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("registration_checklist, tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const currentChecklist =
      (lead.registration_checklist as RegistrationChecklist) ?? {
        registered: false,
        documents: false,
        sms_sent: false,
        payment: false,
      };

    const updatedChecklist = { ...currentChecklist, ...checklist };

    const { error } = await supabase
      .from("sales_leads")
      .update({ registration_checklist: updatedChecklist })
      .eq("id", leadId);

    if (error) {
      logActionError(
        {
          domain: "crm",
          action: "updateRegistrationChecklist",
          tenantId,
          userId,
        },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "crm", action: "updateRegistrationChecklist" },
      error,
      { leadId }
    );
    return { success: false, error: "체크리스트 업데이트에 실패했습니다." };
  }
}

export async function convertLead(
  leadId: string,
  options: { existingStudentId?: string; newStudentData?: { name: string; grade?: number; school_name?: string } }
): Promise<CrmActionResult<{ studentId: string }>> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id, pipeline_status, lead_source, program_id, student_name")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (lead.pipeline_status === "converted") {
      return { success: false, error: "이미 전환된 리드입니다." };
    }

    let studentId: string;

    if (options.existingStudentId) {
      // 기존 학생에 연결
      studentId = options.existingStudentId;

      // 학생의 CRM 컬럼 업데이트
      await supabase
        .from("students")
        .update({
          lead_source: lead.lead_source,
          program_id: lead.program_id,
        })
        .eq("id", studentId);
    } else if (options.newStudentData) {
      // 신규 학생 생성
      const { data: newStudent, error: createError } = await supabase
        .from("students")
        .insert({
          name: options.newStudentData.name,
          tenant_id: tenantId,
          lead_source: lead.lead_source,
          program_id: lead.program_id,
        })
        .select("id")
        .single();

      if (createError || !newStudent) {
        logActionError(
          { domain: "crm", action: "convertLead", tenantId, userId },
          createError ?? new Error("Student creation returned no data"),
          { leadId }
        );
        return { success: false, error: "학생 생성에 실패했습니다." };
      }

      studentId = newStudent.id;
    } else {
      return {
        success: false,
        error: "기존 학생 ID 또는 신규 학생 정보가 필요합니다.",
      };
    }

    // 수강 등록 자동 생성
    if (lead.program_id) {
      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          program_id: lead.program_id,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
          created_by: userId,
          notes: "CRM 리드 전환 자동 등록",
        });
      if (enrollmentError) {
        logActionError(
          { domain: "crm", action: "convertLead", tenantId, userId },
          enrollmentError,
          { leadId, studentId, context: "enrollment auto-creation" }
        );
        // Non-fatal: 전환 자체는 실패하지 않음
      }
    }

    // 리드를 전환 상태로 업데이트
    const previousStatus = lead.pipeline_status;
    const { error: updateError } = await supabase
      .from("sales_leads")
      .update({
        student_id: studentId,
        pipeline_status: "converted",
        converted_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      logActionError(
        { domain: "crm", action: "convertLead", tenantId, userId },
        updateError,
        { leadId, studentId }
      );
      return { success: false, error: updateError.message };
    }

    // 전환 활동 기록
    await supabase.from("lead_activities").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      activity_type: "status_change",
      title: `등록 전환 완료 (학생 ID: ${studentId})`,
      previous_status: previousStatus,
      new_status: "converted",
      performed_by: userId,
    });

    revalidatePath(CRM_PATH);
    revalidatePath("/admin/students");
    return { success: true, data: { studentId } };
  } catch (error) {
    logActionError({ domain: "crm", action: "convertLead" }, error, {
      leadId,
    });
    return { success: false, error: "리드 전환에 실패했습니다." };
  }
}

export async function assignLead(
  leadId: string,
  assignedTo: string | null
): Promise<CrmActionResult> {
  try {
    const { userId, role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase
      .from("sales_leads")
      .update({ assigned_to: assignedTo })
      .eq("id", leadId);

    if (error) {
      logActionError(
        { domain: "crm", action: "assignLead", tenantId, userId },
        error,
        { leadId, assignedTo }
      );
      return { success: false, error: error.message };
    }

    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (error) {
    logActionError({ domain: "crm", action: "assignLead" }, error, {
      leadId,
      assignedTo,
    });
    return { success: false, error: "담당자 배정에 실패했습니다." };
  }
}

export async function getPipelineStats(): Promise<
  CrmActionResult<PipelineStats[]>
> {
  try {
    const { role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("sales_leads")
      .select("pipeline_status");

    if (role !== "superadmin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      logActionError(
        { domain: "crm", action: "getPipelineStats", tenantId },
        error
      );
      return { success: false, error: error.message };
    }

    // 상태별 집계
    const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
      const status = row.pipeline_status;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const stats: PipelineStats[] = Object.entries(counts).map(
      ([status, count]) => ({
        status: status as PipelineStatus,
        count,
      })
    );

    return { success: true, data: stats };
  } catch (error) {
    logActionError({ domain: "crm", action: "getPipelineStats" }, error);
    return { success: false, error: "파이프라인 통계 조회에 실패했습니다." };
  }
}
