/**
 * 플랜 그룹 재조정 Server Actions
 * 
 * 재조정 기능의 미리보기 및 실행을 처리합니다.
 * 
 * @module app/(student)/actions/plan-groups/reschedule
 */

"use server";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import { getPlanGroupWithDetails } from "@/lib/data/planGroups";
import { verifyPlanGroupAccess, getPlanGroupWithDetailsByRole, getStudentIdForPlanGroup } from "@/lib/auth/planGroupAuth";
import {
  calculateReschedulePreview,
  executeRescheduleOperation,
  type RescheduleContext,
  type ReschedulePreviewResult as CoreReschedulePreviewResult,
  type RescheduleResult as CoreRescheduleResult,
} from "@/lib/reschedule/core";

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 미리보기 결과 (타입 호환성을 위해 재export)
 */
export type ReschedulePreviewResult = CoreReschedulePreviewResult;

/**
 * 재조정 실행 결과 (타입 호환성을 위해 재export)
 */
export type RescheduleResult = CoreRescheduleResult;

// ============================================
// 미리보기 함수
// ============================================

/**
 * 재조정 미리보기
 * 
 * DB에 변경을 적용하지 않고 재조정 결과를 미리 확인합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param rescheduleDateRange 재조정할 플랜 범위 (선택, null이면 전체 기간)
 * @param placementDateRange 재조정 플랜 배치 범위 (선택, null이면 자동 계산)
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 미리보기 결과
 */
async function _getReschedulePreview(
  groupId: string,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<ReschedulePreviewResult> {
  // 권한 검증 및 컨텍스트 생성
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();

  // 플랜 그룹 및 관련 데이터 조회
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      access.user.userId,
      access.role,
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

  if (!contents || contents.length === 0) {
    throw new AppError(
      "플랜 콘텐츠를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 학생 ID 결정
  const studentId = getStudentIdForPlanGroup(group, access.user.userId, access.role);

  // 재조정 컨텍스트 생성
  const context: RescheduleContext = {
    userId: access.user.userId,
    studentId,
    role: access.role,
    tenantId: tenantContext.tenantId,
  };

  // 공통 로직 호출
  return calculateReschedulePreview(
    groupId,
    context,
    group,
    contents,
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || null,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || null,
      subject: a.subject || null,
      travel_time: a.travel_time || null,
    })),
    adjustments,
    rescheduleDateRange,
    placementDateRange,
    includeToday
  );
}

export const getReschedulePreview = withErrorHandling(_getReschedulePreview);

// ============================================
// 실행 함수
// ============================================

/**
 * 재조정 실행
 * 
 * 실제로 재조정을 수행하고 DB에 반영합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param adjustments 조정 요청 목록
 * @param reason 재조정 사유 (선택)
 * @param rescheduleDateRange 재조정할 플랜 범위 (선택, null이면 전체 기간)
 * @param placementDateRange 재조정 플랜 배치 범위 (선택, null이면 자동 계산)
 * @param includeToday 오늘 날짜 포함 여부 (기본값: false)
 * @returns 실행 결과
 */
async function _rescheduleContents(
  groupId: string,
  adjustments: AdjustmentInput[],
  reason?: string,
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<RescheduleResult> {
  // 권한 검증 및 컨텍스트 생성
  const access = await verifyPlanGroupAccess();
  const tenantContext = await requireTenantContext();

  // 트랜잭션 외부에서 미리보기 결과 먼저 계산
  const previewResult = await _getReschedulePreview(
    groupId,
    adjustments,
    rescheduleDateRange,
    placementDateRange,
    includeToday
  );

  // 플랜 그룹 조회 (실행 시 필요)
  const { group } = await getPlanGroupWithDetailsByRole(
    groupId,
    access.user.userId,
    access.role,
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

  // 학생 ID 결정
  const studentId = getStudentIdForPlanGroup(group, access.user.userId, access.role);

  // 재조정 컨텍스트 생성
  const context: RescheduleContext = {
    userId: access.user.userId,
    studentId,
    role: access.role,
    tenantId: tenantContext.tenantId,
  };

  // 공통 로직 호출
  return executeRescheduleOperation(
    groupId,
    context,
    group,
    previewResult,
    adjustments,
    reason,
    rescheduleDateRange,
    placementDateRange,
    includeToday
  );
}

export const rescheduleContents = withErrorHandling(_rescheduleContents);

