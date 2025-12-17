"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import {
  createPlanExclusions,
  createStudentExclusions,
  applyTimeManagementFilter,
} from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { resolveTargetStudentId } from "@/lib/utils/planGroupAuth";

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
  const supabase = await createSupabaseServerClient();

  // 학생 ID 결정 (인증/권한 체크 포함)
  let targetStudentId: string;
  let tenantId: string;
  
  try {
    const resolved = await resolveTargetStudentId(groupId, studentId);
    targetStudentId = resolved.targetStudentId;
    tenantId = resolved.tenantId;
  } catch (error) {
    // 템플릿 모드에서 studentId가 없으면 빈 결과 반환 (기존 동작 유지)
    if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR && !groupId && !studentId) {
      return {
        count: 0,
        exclusions: [],
      };
    }
    throw error;
  }

  // 시간 관리 영역 및 다른 플랜 그룹의 제외일 조회
  // - plan_group_id가 NULL인 제외일 (시간 관리 영역)
  // - plan_group_id가 현재 그룹이 아닌 다른 그룹의 제외일
  let timeManagementExclusionsQuery = supabase
    .from("plan_exclusions")
    .select("id,tenant_id,student_id,plan_group_id,exclusion_date,exclusion_type,reason,created_at")
    .eq("student_id", targetStudentId);

  if (tenantId) {
    timeManagementExclusionsQuery = timeManagementExclusionsQuery.eq("tenant_id", tenantId);
  }

  // plan_group_id 필터링 적용 (현재 그룹 제외)
  timeManagementExclusionsQuery = applyTimeManagementFilter(
    timeManagementExclusionsQuery,
    groupId
  );

  const { data: allExclusions, error } = await timeManagementExclusionsQuery;

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[_syncTimeManagementExclusions] 쿼리 오류:", error);
    }
    // 에러 발생 시 빈 배열 반환 (기존 동작 유지)
    return {
      count: 0,
      exclusions: [],
    };
  }

  // 기간에 해당하는 제외일 필터링
  const periodStartDate = new Date(periodStart);
  periodStartDate.setHours(0, 0, 0, 0);
  const periodEndDate = new Date(periodEnd);
  periodEndDate.setHours(23, 59, 59, 999);

  const filteredExclusions = (allExclusions || []).filter((e) => {
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

      if (template?.template_data?.exclusions) {
        const templateExclusions = template.template_data.exclusions;

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

