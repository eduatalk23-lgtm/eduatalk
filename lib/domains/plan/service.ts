/**
 * Plan 도메인 Service
 *
 * 이 파일은 비즈니스 로직을 담당합니다.
 * - 데이터 변환 및 가공
 * - 비즈니스 규칙 적용
 * - Repository 호출 및 에러 처리
 */

import * as repository from "./repository";
import type {
  PlanGroup,
  Plan,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
} from "@/lib/types/plan";
import type {
  PlanGroupFilters,
  StudentPlanFilters,
  PlanGroupCreateResult,
  PlanGroupUpdateResult,
  PlanActionResult,
} from "./types";

// ============================================
// Plan Group Service
// ============================================

/**
 * 플랜 그룹 목록 조회
 */
export async function getPlanGroups(
  filters: PlanGroupFilters
): Promise<PlanGroup[]> {
  try {
    return await repository.findPlanGroups(filters);
  } catch (error) {
    console.error("[plan/service] 플랜 그룹 조회 실패:", error);
    return [];
  }
}

/**
 * 플랜 그룹 단건 조회
 */
export async function getPlanGroupById(
  groupId: string,
  studentId: string,
  tenantId?: string | null
): Promise<PlanGroup | null> {
  try {
    return await repository.findPlanGroupById(groupId, studentId, tenantId);
  } catch (error) {
    console.error("[plan/service] 플랜 그룹 조회 실패:", error);
    return null;
  }
}

/**
 * 플랜 그룹 생성
 */
export async function createPlanGroup(
  data: Partial<PlanGroup>
): Promise<PlanGroupCreateResult> {
  try {
    // 필수 필드 검증
    if (!data.student_id) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!data.period_start || !data.period_end) {
      return { success: false, error: "학습 기간이 필요합니다." };
    }

    // 기간 유효성 검증
    if (new Date(data.period_start) > new Date(data.period_end)) {
      return { success: false, error: "시작일이 종료일보다 늦을 수 없습니다." };
    }

    const planGroup = await repository.insertPlanGroup(data);
    return { success: true, planGroupId: planGroup.id, planGroup };
  } catch (error) {
    console.error("[plan/service] 플랜 그룹 생성 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "플랜 그룹 생성에 실패했습니다.",
    };
  }
}

/**
 * 플랜 그룹 수정
 */
export async function updatePlanGroup(
  groupId: string,
  studentId: string,
  updates: Partial<PlanGroup>
): Promise<PlanGroupUpdateResult> {
  try {
    // 기존 데이터 확인
    const existing = await repository.findPlanGroupById(groupId, studentId);
    if (!existing) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    // 기간 유효성 검증
    const periodStart = updates.period_start || existing.period_start;
    const periodEnd = updates.period_end || existing.period_end;
    if (new Date(periodStart) > new Date(periodEnd)) {
      return { success: false, error: "시작일이 종료일보다 늦을 수 없습니다." };
    }

    const planGroup = await repository.updatePlanGroupById(
      groupId,
      studentId,
      updates
    );
    return { success: true, planGroup };
  } catch (error) {
    console.error("[plan/service] 플랜 그룹 수정 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "플랜 그룹 수정에 실패했습니다.",
    };
  }
}

/**
 * 플랜 그룹 삭제 (soft delete)
 */
export async function deletePlanGroup(
  groupId: string,
  studentId: string
): Promise<PlanGroupUpdateResult> {
  try {
    // 기존 데이터 확인
    const existing = await repository.findPlanGroupById(groupId, studentId);
    if (!existing) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    await repository.softDeletePlanGroup(groupId, studentId);
    return { success: true };
  } catch (error) {
    console.error("[plan/service] 플랜 그룹 삭제 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "플랜 그룹 삭제에 실패했습니다.",
    };
  }
}

/**
 * 플랜 그룹 상태 변경
 */
export async function updatePlanGroupStatus(
  groupId: string,
  studentId: string,
  status: string
): Promise<PlanGroupUpdateResult> {
  // 상태 전이 규칙 검증
  const validStatuses = [
    "draft",
    "saved",
    "active",
    "paused",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return { success: false, error: "유효하지 않은 상태입니다." };
  }

  return updatePlanGroup(groupId, studentId, { status: status as any });
}

// ============================================
// Plan Content Service
// ============================================

/**
 * 플랜 콘텐츠 목록 조회
 */
export async function getPlanContents(
  planGroupId: string
): Promise<PlanContent[]> {
  try {
    return await repository.findPlanContents(planGroupId);
  } catch (error) {
    console.error("[plan/service] 플랜 콘텐츠 조회 실패:", error);
    return [];
  }
}

/**
 * 플랜 콘텐츠 일괄 저장 (기존 삭제 후 새로 생성)
 */
export async function savePlanContents(
  planGroupId: string,
  contents: Array<Partial<PlanContent>>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기존 콘텐츠 삭제
    await repository.deletePlanContentsByGroupId(planGroupId);

    // 새 콘텐츠 생성
    if (contents.length > 0) {
      const contentsWithGroupId = contents.map((c, index) => ({
        ...c,
        plan_group_id: planGroupId,
        display_order: c.display_order ?? index,
      }));
      await repository.insertPlanContents(contentsWithGroupId);
    }

    return { success: true };
  } catch (error) {
    console.error("[plan/service] 플랜 콘텐츠 저장 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "플랜 콘텐츠 저장에 실패했습니다.",
    };
  }
}

// ============================================
// Student Plan Service
// ============================================

/**
 * 학생 플랜 목록 조회
 */
export async function getStudentPlans(
  filters: StudentPlanFilters
): Promise<Plan[]> {
  try {
    return await repository.findStudentPlans(filters);
  } catch (error) {
    console.error("[plan/service] 플랜 조회 실패:", error);
    return [];
  }
}

/**
 * 학생 플랜 단건 조회
 */
export async function getStudentPlanById(
  planId: string,
  studentId: string
): Promise<Plan | null> {
  try {
    return await repository.findStudentPlanById(planId, studentId);
  } catch (error) {
    console.error("[plan/service] 플랜 조회 실패:", error);
    return null;
  }
}

/**
 * 학생 플랜 생성
 */
export async function createStudentPlan(
  plan: Partial<Plan>
): Promise<PlanActionResult> {
  try {
    if (!plan.student_id) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!plan.plan_date) {
      return { success: false, error: "플랜 날짜가 필요합니다." };
    }

    const planId = await repository.insertStudentPlan(plan);
    return { success: true, planId };
  } catch (error) {
    console.error("[plan/service] 플랜 생성 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 생성에 실패했습니다.",
    };
  }
}

/**
 * 학생 플랜 일괄 생성
 */
export async function createStudentPlans(
  plans: Array<Partial<Plan>>
): Promise<{ success: boolean; error?: string; planIds?: string[] }> {
  try {
    if (plans.length === 0) {
      return { success: true, planIds: [] };
    }

    const planIds = await repository.insertStudentPlans(plans);
    return { success: true, planIds };
  } catch (error) {
    console.error("[plan/service] 플랜 일괄 생성 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "플랜 일괄 생성에 실패했습니다.",
    };
  }
}

/**
 * 학생 플랜 수정
 */
export async function updateStudentPlan(
  planId: string,
  studentId: string,
  updates: Partial<Plan>
): Promise<PlanActionResult> {
  try {
    // 기존 데이터 확인
    const existing = await repository.findStudentPlanById(planId, studentId);
    if (!existing) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    await repository.updateStudentPlanById(planId, studentId, updates);
    return { success: true, planId };
  } catch (error) {
    console.error("[plan/service] 플랜 수정 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 수정에 실패했습니다.",
    };
  }
}

/**
 * 학생 플랜 삭제
 */
export async function deleteStudentPlan(
  planId: string,
  studentId: string
): Promise<PlanActionResult> {
  try {
    // 기존 데이터 확인
    const existing = await repository.findStudentPlanById(planId, studentId);
    if (!existing) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    await repository.deleteStudentPlanById(planId, studentId);
    return { success: true };
  } catch (error) {
    console.error("[plan/service] 플랜 삭제 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 삭제에 실패했습니다.",
    };
  }
}

/**
 * 플랜 그룹의 모든 플랜 삭제
 */
export async function deleteStudentPlansByGroupId(
  planGroupId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await repository.deleteStudentPlansByGroupId(planGroupId, studentId);
    return { success: true };
  } catch (error) {
    console.error("[plan/service] 플랜 일괄 삭제 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "플랜 일괄 삭제에 실패했습니다.",
    };
  }
}

// ============================================
// Plan Exclusion Service
// ============================================

/**
 * 제외일 목록 조회
 */
export async function getPlanExclusions(
  studentId: string,
  tenantId?: string | null
): Promise<PlanExclusion[]> {
  try {
    return await repository.findPlanExclusions(studentId, tenantId);
  } catch (error) {
    console.error("[plan/service] 제외일 조회 실패:", error);
    return [];
  }
}

/**
 * 제외일 생성
 */
export async function createPlanExclusion(
  exclusion: Partial<PlanExclusion>
): Promise<{ success: boolean; error?: string; exclusion?: PlanExclusion }> {
  try {
    if (!exclusion.student_id) {
      return { success: false, error: "학생 ID가 필요합니다." };
    }

    if (!exclusion.exclusion_date) {
      return { success: false, error: "제외일이 필요합니다." };
    }

    const created = await repository.insertPlanExclusion(exclusion);
    return { success: true, exclusion: created };
  } catch (error) {
    console.error("[plan/service] 제외일 생성 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "제외일 생성에 실패했습니다.",
    };
  }
}

/**
 * 제외일 삭제
 */
export async function deletePlanExclusion(
  exclusionId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await repository.deletePlanExclusionById(exclusionId, studentId);
    return { success: true };
  } catch (error) {
    console.error("[plan/service] 제외일 삭제 실패:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "제외일 삭제에 실패했습니다.",
    };
  }
}

// ============================================
// Academy Schedule Service
// ============================================

/**
 * 학원 일정 목록 조회
 */
export async function getAcademySchedules(
  studentId: string,
  tenantId?: string | null
): Promise<AcademySchedule[]> {
  try {
    return await repository.findAcademySchedules(studentId, tenantId);
  } catch (error) {
    console.error("[plan/service] 학원 일정 조회 실패:", error);
    return [];
  }
}

// ============================================
// 비즈니스 로직
// ============================================

/**
 * 특정 날짜에 활성화된 플랜 그룹 조회
 */
export async function getActivePlanGroupsForDate(
  studentId: string,
  date: string,
  tenantId?: string | null
): Promise<PlanGroup[]> {
  try {
    const planGroups = await repository.findPlanGroups({
      studentId,
      tenantId,
      status: ["active", "saved"],
    });

    return planGroups.filter((group) => {
      const start = new Date(group.period_start);
      const end = new Date(group.period_end);
      const targetDate = new Date(date);
      return targetDate >= start && targetDate <= end;
    });
  } catch (error) {
    console.error("[plan/service] 활성 플랜 그룹 조회 실패:", error);
    return [];
  }
}

/**
 * 오늘 날짜의 플랜 조회
 */
export async function getTodayPlans(
  studentId: string,
  tenantId?: string | null
): Promise<Plan[]> {
  const today = new Date().toISOString().slice(0, 10);
  return getStudentPlans({
    studentId,
    tenantId,
    planDate: today,
  });
}

/**
 * 플랜 진행률 계산
 */
export function calculatePlanProgress(plans: Plan[]): number {
  if (plans.length === 0) return 0;

  const completedCount = plans.filter(
    (plan) => plan.progress !== null && plan.progress >= 100
  ).length;

  return Math.round((completedCount / plans.length) * 100);
}

