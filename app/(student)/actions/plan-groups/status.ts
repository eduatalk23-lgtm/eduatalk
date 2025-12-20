"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { getPlanGroupById, updatePlanGroup } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";
import type { PlanStatus } from "@/lib/types/plan";

/**
 * 플랜 그룹 상태 업데이트
 */
async function _updatePlanGroupStatus(
  groupId: string,
  status: string
): Promise<void> {
  const user = await requireStudentAuth();

  // 기존 그룹 조회
  const group = await getPlanGroupById(groupId, user.userId);
  if (!group) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

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

  const supabase = await createSupabaseServerClient();

  // 활성화 시 같은 모드의 다른 활성 플랜 그룹만 비활성화
  // 일반 모드와 캠프 모드는 각각 1개씩 활성화 가능
  if (status === "active") {
    // 현재 활성화하려는 그룹이 캠프 모드인지 확인
    const isCampMode =
      group.plan_type === "camp" ||
      group.camp_template_id !== null ||
      group.camp_invitation_id !== null;

    // 같은 모드의 활성 플랜 그룹만 조회
    const query = supabase
      .from("plan_groups")
      .select("id, plan_type, camp_template_id, camp_invitation_id")
      .eq("student_id", user.userId)
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
      const sameModeGroups = allActiveGroups.filter((g) => {
        const gIsCampMode =
          g.plan_type === "camp" ||
          g.camp_template_id !== null ||
          g.camp_invitation_id !== null;
        return isCampMode === gIsCampMode;
      });

      if (sameModeGroups.length > 0) {
        // 같은 모드의 다른 활성 플랜 그룹들을 "saved" 상태로 변경
        const activeGroupIds = sameModeGroups.map((g) => g.id);
        const { error: deactivateError } = await supabase
          .from("plan_groups")
          .update({ status: "saved" })
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
  const result = await updatePlanGroup(groupId, user.userId, { status });
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

