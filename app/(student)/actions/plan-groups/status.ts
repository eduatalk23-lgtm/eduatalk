"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPlanGroupById, updatePlanGroup } from "@/lib/data/planGroups";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { PlanValidator } from "@/lib/validation/planValidator";

/**
 * 플랜 그룹 상태 업데이트
 */
async function _updatePlanGroupStatus(
  groupId: string,
  status: string
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

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
    group.status as any,
    status as any
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

  // 활성화 시 다른 활성 플랜 그룹 비활성화 (1개만 활성 가능)
  if (status === "active") {
    // 현재 활성 상태인 다른 플랜 그룹 조회
    const { data: activeGroups, error: activeGroupsError } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("student_id", user.userId)
      .eq("status", "active")
      .neq("id", groupId)
      .is("deleted_at", null);

    if (activeGroupsError) {
      console.error(
        "[planGroupActions] 활성 플랜 그룹 조회 실패",
        activeGroupsError
      );
    } else if (activeGroups && activeGroups.length > 0) {
      // 다른 활성 플랜 그룹들을 "saved" 상태로 변경
      const activeGroupIds = activeGroups.map((g) => g.id);
      const { error: deactivateError } = await supabase
        .from("plan_groups")
        .update({ status: "saved" })
        .in("id", activeGroupIds);

      if (deactivateError) {
        console.error(
          "[planGroupActions] 다른 활성 플랜 그룹 비활성화 실패",
          deactivateError
        );
        // 비활성화 실패해도 계속 진행 (경고만)
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

