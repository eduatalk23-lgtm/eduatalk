"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  getPlanGroupById,
  getPlanGroupByIdForAdmin,
  createPlanExclusions,
  createStudentExclusions,
  getStudentExclusions,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

/**
 * 시간 관리 데이터 반영 (제외일)
 * 관리자/컨설턴트 모드에서도 사용 가능하도록 수정
 */
async function _syncTimeManagementExclusions(
  groupId: string | null,
  periodStart: string,
  periodEnd: string,
  studentId?: string
): Promise<{
  count: number;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "time_management";
  }>;
}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 관리자/컨설턴트 모드일 때는 studentId 파라미터 필수
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  let targetStudentId: string;

  const supabase = await createSupabaseServerClient();

  // 플랜 그룹 조회 (groupId가 있는 경우만)
  if (groupId) {
    let group;
    if (isAdminOrConsultant) {
      // 관리자 모드: getPlanGroupByIdForAdmin 사용
      group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      // 관리자 모드에서 studentId가 없으면 플랜 그룹에서 student_id 가져오기
      targetStudentId = studentId || group.student_id;
      if (!targetStudentId) {
        throw new AppError(
          "학생 ID를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
    } else {
      // 학생 모드: 기존 로직
      group = await getPlanGroupById(
        groupId,
        userId,
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
      targetStudentId = userId;
      // 기존 플랜 그룹인 경우 revalidate
      revalidatePath(`/plan/group/${groupId}/edit`);
    }
  } else {
    // groupId가 없는 경우
    if (isAdminOrConsultant) {
      // 관리자 모드: studentId 파라미터 필수
      if (!studentId) {
        // 템플릿 모드에서는 빈 결과 반환
        return {
          count: 0,
          exclusions: [],
        };
      }
      targetStudentId = studentId;
    } else {
      // 학생 모드: 현재 사용자 ID 사용
      targetStudentId = userId;
    }
  }

  // 학생의 모든 제외일 조회 (시간 관리에 등록된 모든 제외일)
  const allExclusions = await getStudentExclusions(
    targetStudentId,
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
 * 플랜 그룹 찾기 헬퍼 함수
 * 활성 플랜 그룹 → draft/saved 플랜 그룹 순서로 찾기
 */
async function findTargetPlanGroup(
  userId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // 1. 활성 플랜 그룹 찾기
  const { data: activeGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("student_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (activeGroup) {
    return activeGroup.id;
  }

  // 2. 활성 플랜 그룹이 없으면 가장 최근 draft 또는 saved 플랜 그룹 사용
  const { data: recentGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("student_id", userId)
    .in("status", ["draft", "saved"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return recentGroup?.id || null;
}

/**
 * 플랜 그룹 제외일 추가
 * 플랜 그룹이 없어도 시간 관리 영역에 제외일을 추가할 수 있음
 */
async function _addPlanExclusion(formData: FormData): Promise<void> {
  const user = await requireStudentAuth();
  const tenantContext = await requireTenantContext();

  const exclusionDate = formData.get("exclusion_date");
  const exclusionType = formData.get("exclusion_type");
  const reason = formData.get("reason");
  const planGroupId = formData.get("plan_group_id");

  // 입력 검증
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

  // plan_group_id가 제공되지 않으면 플랜 그룹 찾기
  const targetGroupId =
    planGroupId && typeof planGroupId === "string"
      ? planGroupId
      : await findTargetPlanGroup(user.userId);

  const exclusionData = {
    exclusion_date: exclusionDate,
    exclusion_type: exclusionType,
    reason: reason && typeof reason === "string" ? reason.trim() : null,
  };

  // 플랜 그룹이 있으면 플랜 그룹별로, 없으면 시간 관리 영역에 저장
  const result = targetGroupId
    ? await createPlanExclusions(targetGroupId, tenantContext.tenantId, [
        exclusionData,
      ])
    : await createStudentExclusions(user.userId, tenantContext.tenantId, [
        exclusionData,
      ]);

  if (!result.success) {
    // 중복 에러인 경우 VALIDATION_ERROR로 처리
    const isDuplicateError = result.error?.includes("이미 등록된 제외일");
    throw new AppError(
      result.error || "제외일 추가에 실패했습니다.",
      isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
      isDuplicateError ? 400 : 500,
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
  const user = await requireStudentAuth();

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
      const templateData = template?.template_data as Record<string, unknown> | null;

      if (templateData?.exclusions && Array.isArray(templateData.exclusions)) {
        const templateExclusions = templateData.exclusions as Array<{ exclusion_date: string }>;

        // 템플릿 제외일 목록에 해당 제외일이 있는지 확인
        const isTemplateExclusion = templateExclusions.some(
          (te) => te.exclusion_date === exclusion.exclusion_date
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

