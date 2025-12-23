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

  // 활성화 시 같은 모드의 다른 활성 플랜 그룹만 비활성화
  // 일반 모드와 캠프 모드는 각각 1개씩 활성화 가능
  if (status === "active") {
    // 현재 활성화하려는 그룹이 캠프 모드인지 확인
    const isGroupCampMode = isCampMode(group);

    // 같은 모드의 활성 플랜 그룹만 조회
    const query = supabase
      .from("plan_groups")
      .select("id, plan_type, camp_template_id, camp_invitation_id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .neq("id", groupId)
      .is("deleted_at", null);

    const { data: allActiveGroups, error: activeGroupsError } = await query;

    if (activeGroupsError) {
      console.error(
        "[planGroupActions] 활성 플랜 그룹 조회 실패",
        activeGroupsError
      );
    } else if (allActiveGroups && allActiveGroups.length > 0) {
      // 같은 모드의 활성 플랜 그룹만 필터링
      const sameModeGroups = allActiveGroups.filter(
        (g) => isGroupCampMode === isCampMode(g)
      );

      if (sameModeGroups.length > 0) {
        // 같은 모드의 다른 활성 플랜 그룹들을 "paused" 상태로 변경
        // (active → paused는 유효한 상태 전환, active → saved는 아님)
        const activeGroupIds = sameModeGroups.map((g) => g.id);
        const { error: deactivateError } = await supabase
          .from("plan_groups")
          .update({ status: "paused" })
          .in("id", activeGroupIds);

        if (deactivateError) {
          console.error(
            "[planGroupActions] 같은 모드의 다른 활성 플랜 그룹 비활성화 실패",
            deactivateError
          );
          // 비활성화 실패해도 계속 진행 (경고만)
        }
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

