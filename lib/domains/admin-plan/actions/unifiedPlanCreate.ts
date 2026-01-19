"use server";

/**
 * Unified Plan Creation
 *
 * 모든 플랜 추가 기능(빠른 추가, 단발성 추가, 콘텐츠 추가)을 통합한 액션
 *
 * @module lib/domains/admin-plan/actions/unifiedPlanCreate
 */

import { revalidatePlanCache } from "@/lib/domains/plan/utils/cacheInvalidation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { withErrorHandling } from "@/lib/errors";
import {
  logActionSuccess,
  logActionError,
  logActionDebug,
} from "@/lib/logging/actionLogger";
import { createPlanEvent } from "./planEvent";
import { createAutoContentPlanGroupAction } from "./createAutoContentPlanGroup";
import { selectPlanGroupForPlanner } from "@/lib/domains/admin-plan/utils/planGroupSelector";

// ============================================
// 타입 정의
// ============================================

/**
 * 통합 플랜 생성 입력
 */
export interface UnifiedPlanInput {
  // 필수 필드
  studentId: string;
  tenantId: string;
  planDate: string; // YYYY-MM-DD
  title: string;

  // 설명
  description?: string;

  // 콘텐츠 정보
  contentType?: "book" | "lecture" | "custom" | "free";
  contentId?: string;
  flexibleContentId?: string;

  // 범위 정보
  rangeStart?: number;
  rangeEnd?: number;
  customRangeDisplay?: string;

  // 시간 정보
  estimatedMinutes?: number;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm

  // 플래너/플랜그룹 연결
  plannerId?: string;
  planGroupId?: string;

  // 컨테이너 타입
  containerType?: "daily" | "weekly";

  // 단발성/빠른 추가 옵션
  isAdhoc?: boolean;
  tags?: string[];
  color?: string;
  icon?: string;
  priority?: number;

  // 반복 옵션
  isRecurring?: boolean;
  recurrenceRule?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    endDate?: string;
    daysOfWeek?: number[];
  };

  // 자유 학습 옵션
  isFreeLearning?: boolean;
  freeLearningType?: string;

  // 교과 정보 (콘텐츠 모드)
  curriculum?: string; // '2022 개정' | '2015 개정'
  subjectArea?: string; // '국어' | '수학' | '영어' | '과학' | '사회'
  subjectName?: string; // 과목명 자유 입력

  // 마스터 콘텐츠 연결
  linkMasterContent?: boolean;

  // 분량 정보
  totalVolume?: number; // 일일 학습량 계산용

  // 배치 모드
  distributionMode?: "today" | "period" | "weekly";
  periodStartDate?: string; // 기간 배치 시작일 (YYYY-MM-DD)
  periodEndDate?: string; // 기간 배치 종료일 (YYYY-MM-DD)

  // 스케줄러 옵션
  useScheduler?: boolean; // 자동 시간 배정
}

/**
 * 통합 플랜 생성 결과
 */
export interface UnifiedPlanResult {
  success: boolean;
  error?: string;
  planId?: string;
  planGroupId?: string;
  flexibleContentId?: string;
  createdPlans?: Array<{
    id: string;
    planDate: string;
  }>;
}

/**
 * 플랜 그룹 확보 결과
 */
interface EnsurePlanGroupResult {
  success: boolean;
  planGroupId?: string;
  isNewGroup?: boolean;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

const LOG_CONTEXT = { domain: "admin-plan", action: "createUnifiedPlan" };

/**
 * 플랜 그룹 확보 함수
 *
 * 기존 planGroupId가 있으면 사용하고, 없으면 플래너 기반으로 선택/생성
 */
export async function ensurePlanGroup(input: {
  plannerId?: string;
  planGroupId?: string;
  studentId: string;
  tenantId: string;
  planDate: string;
  title: string;
  isAdhoc?: boolean;
}): Promise<EnsurePlanGroupResult> {
  const supabase = await createSupabaseServerClient();

  // Case 1: 기존 planGroupId가 제공된 경우
  if (input.planGroupId) {
    const { data: existingGroup } = await supabase
      .from("plan_groups")
      .select("id")
      .eq("id", input.planGroupId)
      .single();

    if (!existingGroup) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }
    return { success: true, planGroupId: input.planGroupId, isNewGroup: false };
  }

  // Case 2: plannerId가 제공된 경우 - 플래너 기반 선택/생성
  if (input.plannerId) {
    logActionDebug(LOG_CONTEXT, "플래너 기반 플랜그룹 선택 시작", {
      plannerId: input.plannerId,
    });

    const selectResult = await selectPlanGroupForPlanner(input.plannerId, {
      studentId: input.studentId,
      preferPeriod: { start: input.planDate, end: input.planDate },
    });

    if (selectResult.status === "found" || selectResult.status === "multiple") {
      logActionDebug(LOG_CONTEXT, "기존 플랜그룹 선택됨", {
        planGroupId: selectResult.planGroupId,
        status: selectResult.status,
      });
      return {
        success: true,
        planGroupId: selectResult.planGroupId!,
        isNewGroup: false,
      };
    }

    // 새 플랜 그룹 생성 - createAutoContentPlanGroupAction 사용
    logActionDebug(LOG_CONTEXT, "새 플랜그룹 자동 생성 시작", {
      plannerId: input.plannerId,
    });

    const createResult = await createAutoContentPlanGroupAction({
      tenantId: input.tenantId,
      studentId: input.studentId,
      plannerId: input.plannerId,
      contentTitle: input.title,
      targetDate: input.planDate,
      planPurpose: input.isAdhoc ? "adhoc" : "content",
    });

    if (!createResult.success || !createResult.groupId) {
      return {
        success: false,
        error: createResult.error || "플랜 그룹 생성에 실패했습니다.",
      };
    }

    logActionDebug(LOG_CONTEXT, "새 플랜그룹 생성 완료", {
      planGroupId: createResult.groupId,
    });

    return {
      success: true,
      planGroupId: createResult.groupId,
      isNewGroup: true,
    };
  }

  // Case 3: 레거시 - plannerId 없이 독립 Plan Group 생성
  logActionDebug(LOG_CONTEXT, "독립 플랜그룹 생성 (레거시 모드)");

  const { data: newGroup, error } = await supabase
    .from("plan_groups")
    .insert({
      student_id: input.studentId,
      tenant_id: input.tenantId,
      name: `${input.title} (${input.planDate})`,
      plan_purpose: null,
      period_start: input.planDate,
      period_end: input.planDate,
      status: "active",
      plan_mode: input.isAdhoc ? "quick" : "content_based",
      is_single_day: true,
      creation_mode: input.isAdhoc ? "quick" : "content_based",
      // Phase 3.3: 단일 콘텐츠 모드 기본값
      is_single_content: true,
    })
    .select("id")
    .single();

  if (error || !newGroup) {
    return {
      success: false,
      error: error?.message || "플랜 그룹 생성에 실패했습니다.",
    };
  }

  return {
    success: true,
    planGroupId: newGroup.id,
    isNewGroup: true,
  };
}

/**
 * 자유 학습 콘텐츠 생성
 */
async function createFreeLearningContent(input: {
  tenantId: string;
  studentId: string;
  title: string;
  freeLearningType?: string;
  estimatedMinutes?: number;
}): Promise<{ success: boolean; contentId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("flexible_contents")
    .insert({
      tenant_id: input.tenantId,
      student_id: input.studentId,
      content_type: "free",
      title: input.title,
      item_type: input.freeLearningType || "free",
      estimated_minutes: input.estimatedMinutes || 30,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "콘텐츠 생성 실패" };
  }

  return { success: true, contentId: data.id };
}

// ============================================
// 메인 함수
// ============================================

/**
 * 통합 플랜 생성 함수
 *
 * 모든 플랜 타입(빠른 추가, 단발성, 콘텐츠 기반)을 하나의 함수로 처리합니다.
 *
 * @param input 플랜 생성 입력
 * @returns 생성 결과
 */
async function _createUnifiedPlan(
  input: UnifiedPlanInput
): Promise<UnifiedPlanResult> {
  // 1. 인증 검증
  const { userId } = await requireAdminOrConsultant({ requireTenant: true });
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  logActionDebug(LOG_CONTEXT, "통합 플랜 생성 시작", {
    studentId: input.studentId,
    title: input.title,
    isAdhoc: input.isAdhoc,
    isFreeLearning: input.isFreeLearning,
  });

  // 2. 입력 검증
  if (!input.title?.trim()) {
    return { success: false, error: "제목은 필수입니다." };
  }

  if (!input.planDate) {
    return { success: false, error: "날짜는 필수입니다." };
  }

  // 3. 콘텐츠 확보 (자유 학습인 경우 flexible_contents 생성)
  let effectiveFlexibleContentId = input.flexibleContentId;
  let effectiveContentType = input.contentType || "free";

  if (input.isFreeLearning && !input.flexibleContentId) {
    logActionDebug(LOG_CONTEXT, "자유 학습 콘텐츠 생성");

    const contentResult = await createFreeLearningContent({
      tenantId: input.tenantId,
      studentId: input.studentId,
      title: input.title,
      freeLearningType: input.freeLearningType,
      estimatedMinutes: input.estimatedMinutes,
    });

    if (!contentResult.success) {
      return { success: false, error: contentResult.error };
    }

    effectiveFlexibleContentId = contentResult.contentId;
    effectiveContentType = "free";
  }

  // 4. 플랜 그룹 확보
  const planGroupResult = await ensurePlanGroup({
    plannerId: input.plannerId,
    planGroupId: input.planGroupId,
    studentId: input.studentId,
    tenantId: input.tenantId,
    planDate: input.planDate,
    title: input.title,
    isAdhoc: input.isAdhoc,
  });

  if (!planGroupResult.success || !planGroupResult.planGroupId) {
    return { success: false, error: planGroupResult.error };
  }

  // 5. student_plan 레코드 생성
  const planData = {
    student_id: input.studentId,
    tenant_id: input.tenantId,
    plan_group_id: planGroupResult.planGroupId,
    plan_date: input.planDate,

    // 콘텐츠 정보
    content_type: effectiveContentType,
    content_id: input.contentId || null,
    flexible_content_id: effectiveFlexibleContentId || null,
    content_title: input.title,
    custom_title: input.title,

    // 범위 정보
    planned_start_page_or_time: input.rangeStart || null,
    planned_end_page_or_time: input.rangeEnd || null,
    custom_range_display: input.customRangeDisplay || null,

    // 시간 정보
    estimated_minutes: input.estimatedMinutes || 30,
    start_time: input.startTime || null,
    end_time: input.endTime || null,

    // 컨테이너 및 상태
    container_type: input.containerType || "daily",
    status: "pending",
    is_active: true,

    // 단발성/빠른 추가 필드 (새로 추가된 컬럼)
    description: input.description || null,
    is_adhoc: input.isAdhoc || false,
    tags: input.tags || [],
    color: input.color || null,
    icon: input.icon || null,
    priority: input.priority || 0,

    // 반복 관련
    is_recurring: input.isRecurring || false,
    recurrence_rule: input.recurrenceRule || null,

    // 메타데이터
    block_index: 0,
    order_index: 0,
    created_by: userId,
    created_at: now,
    updated_at: now,
  };

  const { data: createdPlan, error: insertError } = await supabase
    .from("student_plan")
    .insert(planData)
    .select("id, plan_date")
    .single();

  if (insertError || !createdPlan) {
    logActionError(LOG_CONTEXT, insertError || "플랜 생성 실패", {
      studentId: input.studentId,
      planDate: input.planDate,
    });
    return { success: false, error: insertError?.message || "플랜 생성에 실패했습니다." };
  }

  // 6. 이벤트 로깅
  await createPlanEvent({
    tenant_id: input.tenantId,
    student_id: input.studentId,
    student_plan_id: createdPlan.id,
    plan_group_id: planGroupResult.planGroupId,
    event_type: input.isAdhoc ? "unified_adhoc_created" : "unified_plan_created",
    event_category: "plan_item",
    payload: {
      title: input.title,
      planDate: input.planDate,
      isAdhoc: input.isAdhoc,
      isFreeLearning: input.isFreeLearning,
      contentType: effectiveContentType,
    },
    new_state: planData as unknown as Record<string, unknown>,
    actor_id: userId,
    actor_type: "admin",
  });

  // 7. 캐시 재검증
  revalidatePlanCache({
    groupId: planGroupResult.planGroupId,
    studentId: input.studentId,
    includeAdmin: true,
  });

  logActionSuccess(LOG_CONTEXT, {
    planId: createdPlan.id,
    planGroupId: planGroupResult.planGroupId,
    studentId: input.studentId,
    isAdhoc: input.isAdhoc,
    isNewGroup: planGroupResult.isNewGroup,
  });

  return {
    success: true,
    planId: createdPlan.id,
    planGroupId: planGroupResult.planGroupId,
    flexibleContentId: effectiveFlexibleContentId,
    createdPlans: [{ id: createdPlan.id, planDate: input.planDate }],
  };
}

export const createUnifiedPlan = withErrorHandling(_createUnifiedPlan);

// ============================================
// 레거시 호환 래퍼
// ============================================

/**
 * @deprecated Use createUnifiedPlan instead
 *
 * 이 함수는 하위 호환성을 위해 유지됩니다.
 * 내부적으로 createUnifiedPlan을 호출합니다.
 */
export async function createUnifiedAdhocPlan(
  input: Omit<UnifiedPlanInput, "isAdhoc">
): Promise<UnifiedPlanResult> {
  return createUnifiedPlan({
    ...input,
    isAdhoc: true,
  });
}
