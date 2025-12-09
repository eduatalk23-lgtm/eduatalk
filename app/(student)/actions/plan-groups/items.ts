"use server";

/**
 * 논리 플랜 아이템 Server Actions
 * @module app/(student)/actions/plan-groups/items
 * @see docs/refactoring/03_phase_todo_list.md [P2-5]
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import {
  getPlanGroupItems,
  createPlanGroupItem,
  createPlanGroupItems,
  updatePlanGroupItem,
  deletePlanGroupItem,
  deletePlanGroupItemsByGroupId,
} from "@/lib/data/planGroupItems";
import { getPlanGroupById } from "@/lib/data/planGroups";
import type { PlanGroupItem, PlanGroupItemInput } from "@/lib/types/plan";

// ============================================
// 조회
// ============================================

/**
 * 플랜 그룹의 논리 플랜 아이템 목록 조회
 */
async function _getLogicalPlans(planGroupId: string): Promise<PlanGroupItem[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 플랜 그룹 접근 권한 확인
  const planGroup = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!planGroup) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  return getPlanGroupItems(planGroupId, tenantContext.tenantId);
}

export const getLogicalPlans = withErrorHandling(_getLogicalPlans);

// ============================================
// 생성
// ============================================

/**
 * 논리 플랜 아이템 단일 생성
 */
async function _createLogicalPlan(
  planGroupId: string,
  input: PlanGroupItemInput
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 플랜 그룹 접근 권한 확인
  const planGroup = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!planGroup) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플랜 그룹 상태 확인 (draft 또는 saved만 수정 가능)
  if (planGroup.status !== "draft" && planGroup.status !== "saved") {
    throw new AppError(
      "활성화된 플랜 그룹은 수정할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return createPlanGroupItem(planGroupId, tenantContext.tenantId, input);
}

export const createLogicalPlan = withErrorHandling(_createLogicalPlan);

/**
 * 논리 플랜 아이템 일괄 생성
 */
async function _createLogicalPlans(
  planGroupId: string,
  inputs: PlanGroupItemInput[]
): Promise<{ success: boolean; itemIds?: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 플랜 그룹 접근 권한 확인
  const planGroup = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!planGroup) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플랜 그룹 상태 확인
  if (planGroup.status !== "draft" && planGroup.status !== "saved") {
    throw new AppError(
      "활성화된 플랜 그룹은 수정할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return createPlanGroupItems(planGroupId, tenantContext.tenantId, inputs);
}

export const createLogicalPlans = withErrorHandling(_createLogicalPlans);

// ============================================
// 수정
// ============================================

/**
 * 논리 플랜 아이템 업데이트
 */
async function _updateLogicalPlan(
  itemId: string,
  updates: Partial<PlanGroupItemInput>
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 논리 플랜 아이템 조회 및 권한 확인
  const items = await getPlanGroupItems("", tenantContext.tenantId);
  const item = items.find((i) => i.id === itemId);

  if (!item) {
    // 직접 쿼리해서 확인
    const { getPlanGroupItemById } = await import("@/lib/data/planGroupItems");
    const itemData = await getPlanGroupItemById(itemId, tenantContext.tenantId);

    if (!itemData) {
      throw new AppError(
        "논리 플랜 아이템을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 플랜 그룹 접근 권한 확인
    const planGroup = await getPlanGroupById(
      itemData.plan_group_id,
      user.userId,
      tenantContext.tenantId
    );
    if (!planGroup) {
      throw new AppError(
        "플랜 그룹을 찾을 수 없거나 접근 권한이 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 플랜 그룹 상태 확인
    if (planGroup.status !== "draft" && planGroup.status !== "saved") {
      throw new AppError(
        "활성화된 플랜 그룹은 수정할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  return updatePlanGroupItem(itemId, updates);
}

export const updateLogicalPlan = withErrorHandling(_updateLogicalPlan);

// ============================================
// 삭제
// ============================================

/**
 * 논리 플랜 아이템 삭제
 */
async function _deleteLogicalPlan(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 논리 플랜 아이템 조회 및 권한 확인
  const { getPlanGroupItemById } = await import("@/lib/data/planGroupItems");
  const itemData = await getPlanGroupItemById(itemId, tenantContext.tenantId);

  if (!itemData) {
    throw new AppError(
      "논리 플랜 아이템을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플랜 그룹 접근 권한 확인
  const planGroup = await getPlanGroupById(
    itemData.plan_group_id,
    user.userId,
    tenantContext.tenantId
  );
  if (!planGroup) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없거나 접근 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 플랜 그룹 상태 확인
  if (planGroup.status !== "draft" && planGroup.status !== "saved") {
    throw new AppError(
      "활성화된 플랜 그룹은 수정할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return deletePlanGroupItem(itemId);
}

export const deleteLogicalPlan = withErrorHandling(_deleteLogicalPlan);

/**
 * 플랜 그룹의 모든 논리 플랜 아이템 삭제
 */
async function _deleteAllLogicalPlans(
  planGroupId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("인증이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const tenantContext = await requireTenantContext();

  // 플랜 그룹 접근 권한 확인
  const planGroup = await getPlanGroupById(
    planGroupId,
    user.userId,
    tenantContext.tenantId
  );
  if (!planGroup) {
    throw new AppError(
      "플랜 그룹을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 플랜 그룹 상태 확인
  if (planGroup.status !== "draft" && planGroup.status !== "saved") {
    throw new AppError(
      "활성화된 플랜 그룹은 수정할 수 없습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  return deletePlanGroupItemsByGroupId(planGroupId);
}

export const deleteAllLogicalPlans = withErrorHandling(_deleteAllLogicalPlans);
