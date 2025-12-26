"use server";

import { revalidatePath } from "next/cache";
import { getPlanGroupById, getPlanGroupByIdForAdmin, updatePlanGroup } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import type { PlanStatus } from "@/lib/types/plan";
import { verifyPlanGroupAccess, getStudentIdForPlanGroup, getSupabaseClientForStudent } from "@/lib/auth/planGroupAuth";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { isCampMode } from "@/lib/plan/context";
import { getCampTemplate } from "@/lib/data/campTemplates";

/**
 * 플랜 그룹 상태 업데이트
 */
async function _updatePlanGroupStatus(
  groupId: string,
  status: string
): Promise<void> {
  // 권한 검증: 학생, 관리자, 컨설턴트 모두 허용
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();

  // 기존 그룹 조회 - 역할에 따라 조회
  let group;
  if (access.role === "admin" || access.role === "consultant") {
    // 관리자/컨설턴트는 tenantId로 조회
    if (!tenantContext.tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
  } else {
    // 학생은 자신의 ID로 조회
    group = await getPlanGroupById(groupId, access.user.userId);
  }

  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 실제 학생 ID 추출 (관리자가 다른 학생의 플랜을 업데이트할 때 필요)
  const studentId = getStudentIdForPlanGroup(group, access.user.userId, access.role);

  // 상태 전이 검증
  const statusValidation = PlanValidator.validateStatusTransition(
    group.status as PlanStatus,
    status as PlanStatus
  );
  if (!statusValidation.valid) {
    throw new AppError(
      statusValidation.errors.join(", ") || "상태 전이가 불가능합니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // 관리자/컨설턴트가 다른 학생의 플랜 그룹을 업데이트할 때는 Admin 클라이언트 사용
  const supabase = await getSupabaseClientForStudent(
    studentId,
    access.user.userId,
    access.role
  );

  if (!supabase) {
    throw new AppError(
      "Supabase 클라이언트를 생성할 수 없습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }

  // 활성화 시 기존 활성 플랜 그룹을 비활성화
  // 원칙: 학생이 한 번에 하나의 학습에 집중하도록 전체 1개만 활성화
  if (status === "active") {
    const isGroupCampMode = isCampMode(group);

    // 모든 활성 플랜 그룹 조회
    const { data: allActiveGroups, error: activeGroupsError } = await supabase
      .from("plan_groups")
      .select("id, plan_type, camp_template_id, camp_invitation_id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .neq("id", groupId)
      .is("deleted_at", null);

    if (activeGroupsError) {
      console.error(
        "[planGroupActions] 활성 플랜 그룹 조회 실패",
        activeGroupsError
      );
    }

    // 일반 플랜 활성화 시 캠프 제한 체크
    if (!isGroupCampMode && allActiveGroups && allActiveGroups.length > 0) {
      const activeCampGroups = allActiveGroups.filter((g) => isCampMode(g));

      if (activeCampGroups.length > 0) {
        // 캠프 템플릿의 allow_normal_plan_activation 설정 확인
        const campGroup = activeCampGroups[0];
        const template = await getCampTemplate(campGroup.camp_template_id!);

        if (!template?.allow_normal_plan_activation) {
          throw new AppError(
            "캠프 진행 중에는 일반 플랜을 활성화할 수 없습니다.",
            ErrorCode.VALIDATION_ERROR,
            400,
            true
          );
        }
      }
    }

    // 모든 활성 플랜 그룹 비활성화 (모드 무관)
    if (allActiveGroups && allActiveGroups.length > 0) {
      const activeGroupIds = allActiveGroups.map((g) => g.id);
      const { error: deactivateError } = await supabase
        .from("plan_groups")
        .update({ status: "paused" })
        .in("id", activeGroupIds);

      if (deactivateError) {
        console.error(
          "[planGroupActions] 활성 플랜 그룹 비활성화 실패",
          deactivateError
        );
        // 비활성화 실패해도 계속 진행 (경고만)
      }
    }
  }

  // 상태 업데이트
  const result = await updatePlanGroup(groupId, studentId, { status });
  if (!result.success) {
    throw new AppError(
      result.error || "플랜 그룹 상태 업데이트에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/plan");
  revalidatePath(`/plan/group/${groupId}`);
}

export const updatePlanGroupStatus = withErrorHandling(_updatePlanGroupStatus);

