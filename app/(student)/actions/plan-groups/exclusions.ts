"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getPlanGroupById,
  createPlanExclusions,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 시간 관리 데이터 반영 (제외일)
 */
async function _syncTimeManagementExclusions(
  groupId: string | null,
  periodStart: string,
  periodEnd: string
): Promise<{
  count: number;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "time_management";
  }>;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회 (groupId가 있는 경우만)
  if (groupId) {
    const group = await getPlanGroupById(
      groupId,
      user.userId,
      tenantContext.tenantId
    );
    if (!group) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    // 기존 플랜 그룹인 경우 revalidate
    revalidatePath(`/plan/group/${groupId}/edit`);
  }

  // 학생의 모든 제외일 조회 (시간 관리에 등록된 모든 제외일)
  const allExclusions = await getStudentExclusions(
    user.userId,
    tenantContext.tenantId
  );

  // 기간에 해당하는 제외일 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredExclusions = allExclusions.filter((e) => {
    const exclusionDate = new Date(e.exclusion_date);
    exclusionDate.setHours(0, 0, 0, 0);
    return exclusionDate >= periodStartDate && exclusionDate <= periodEndDate;
  });

  // 최신 제외일 데이터 반환 (source 필드 추가)
  return {
    count: filteredExclusions.length,
    exclusions: filteredExclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
      reason: e.reason || undefined,
      source: "time_management" as const,
    })),
  };
}

/**
 * 플랜 그룹 제외일 추가
 */
async function _addPlanExclusion(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const exclusionDate = formData.get("exclusion_date");
  const exclusionType = formData.get("exclusion_type");
  const reason = formData.get("reason");
  const planGroupId = formData.get("plan_group_id");

  if (!exclusionDate || typeof exclusionDate !== "string") {
    throw new AppError(
      "제외일을 입력해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  if (!exclusionType || typeof exclusionType !== "string") {
    throw new AppError(
      "제외 유형을 선택해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // plan_group_id가 제공되지 않으면 활성 플랜 그룹 찾기
  let targetGroupId =
    planGroupId && typeof planGroupId === "string" ? planGroupId : null;

  if (!targetGroupId) {
    const supabase = await createSupabaseServerClient();
    const { data: activeGroup } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (activeGroup) {
      targetGroupId = activeGroup.id;
    } else {
      // 활성 플랜 그룹이 없으면 가장 최근 draft 또는 saved 플랜 그룹 사용
      const { data: recentGroup } = await supabase
        .from("plan_groups")
        .select("id")
        .eq("student_id", user.userId)
        .in("status", ["draft", "saved"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentGroup) {
        targetGroupId = recentGroup.id;
      } else {
        throw new AppError(
          "제외일을 추가하려면 먼저 플랜 그룹을 생성해주세요.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
    }
  }

  if (!targetGroupId) {
    throw new AppError(
      "제외일을 추가하려면 먼저 플랜 그룹을 생성해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 플랜 그룹별로 제외일 추가
  const result = await createPlanExclusions(
    targetGroupId,
    tenantContext.tenantId,
    [
      {
        exclusion_date: exclusionDate,
        exclusion_type: exclusionType,
        reason: reason && typeof reason === "string" ? reason.trim() : null,
      },
    ]
  );

  if (!result.success) {
    throw new AppError(
      result.error || "제외일 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

/**
 * 플랜 그룹 제외일 삭제
 */
async function _deletePlanExclusion(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const exclusionId = formData.get("exclusion_id");

  if (!exclusionId || typeof exclusionId !== "string") {
    throw new AppError(
      "제외일 ID가 필요합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 제외일 및 플랜 그룹 정보 조회
  const { data: exclusion, error: fetchError } = await supabase
    .from("plan_exclusions")
    .select("id, student_id, plan_group_id, exclusion_date")
    .eq("id", exclusionId)
    .single();

  if (fetchError || !exclusion) {
    throw new AppError(
      "제외일을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 소유권 확인
  if (exclusion.student_id !== user.userId) {
    throw new AppError("권한이 없습니다.", ErrorCode.UNAUTHORIZED, 403, true);
  }

  // 캠프 플랜인 경우 템플릿 제외일인지 확인
  if (exclusion.plan_group_id) {
    const { data: planGroup } = await supabase
      .from("plan_groups")
      .select("camp_template_id, plan_type")
      .eq("id", exclusion.plan_group_id)
      .maybeSingle();

    if (planGroup?.plan_type === "camp" && planGroup.camp_template_id) {
      // 템플릿 데이터 조회하여 제외일이 템플릿에서 온 것인지 확인
      const { getCampTemplate } = await import("@/lib/data/campTemplates");
      const template = await getCampTemplate(planGroup.camp_template_id);

      if (template) {
        const templateData = template.template_data as any;
        const templateExclusions = templateData.exclusions || [];

        // 템플릿 제외일 목록에 해당 제외일이 있는지 확인
        const isTemplateExclusion = templateExclusions.some(
          (te: any) => te.exclusion_date === exclusion.exclusion_date
        );

        if (isTemplateExclusion) {
          throw new AppError(
            "템플릿에서 지정된 제외일은 삭제할 수 없습니다.",
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      }
    }
  }

  const { error } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("id", exclusionId);

  if (error) {
    throw new AppError(
      error.message || "제외일 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: error }
    );
  }

  revalidatePath("/blocks");
  revalidatePath("/plan");
}

export const syncTimeManagementExclusionsAction = withErrorHandling(
  _syncTimeManagementExclusions
);
export const addPlanExclusion = withErrorHandling(_addPlanExclusion);
export const deletePlanExclusion = withErrorHandling(_deletePlanExclusion);

