/**
 * 플랜 완료 관련 타입 및 유틸리티
 *
 * Event + Task 레이어 분리:
 * - 이벤트 상태: calendar_events.status (confirmed/tentative/cancelled)
 * - 완료 여부: event_study_data.done (boolean, 단일 진실 공급원)
 */

// ============================================
// 완료 판정 헬퍼
// ============================================
// NOTE: 의도적인 3-way 분리 (2026-04-06)
// 이 파일의 isCompletedPlan은 event_study_done을 우선 사용하는 새로운 방식입니다.
// 하지만 event_study_done은 캘린더 페이지 enrichment 경로에서만 사용 가능합니다.
// 따라서 다음 두 레거시 헬퍼는 아직 마이그레이션할 수 없습니다:
// - lib/utils/planUtils.ts :: isCompletedPlan (status + actual_end_time)
// - lib/utils/planStatusUtils.ts :: isCompletedPlan (status only)
// 모든 쿼리 포인트에서 event_study_done을 enrichment한 후에 통합 가능합니다.

/**
 * 플랜 완료 여부를 판정합니다.
 *
 * - event_study_done이 있으면 그것을 단일 진실 공급원으로 사용
 * - 없으면 레거시 필드(status, actual_end_time)로 폴백
 */
export function isCompletedPlan(plan: {
  event_study_done?: boolean | null;
  status?: string | null;
  actual_end_time?: string | null;
}): boolean {
  if (plan.event_study_done != null) return plan.event_study_done;
  return plan.status === "completed" || plan.actual_end_time != null;
}

// ============================================
// 학생 권한 타입
// ============================================

/**
 * 학생 플랜 권한 설정
 * plan_groups.student_permissions JSONB 필드에 저장
 */
export interface StudentPlanPermissions {
  /** 단발성 플랜 추가 가능 여부 */
  canAddAdHoc: boolean;
  /** 메모 편집 가능 여부 */
  canEditMemo: boolean;
  /** 플랜 이동 가능 여부 */
  canMovePlans: boolean;
  /** 색상 변경 가능 여부 */
  canChangeColor: boolean;
  /** 완료 처리 가능 여부 */
  canComplete: boolean;
}

/**
 * 기본 학생 권한
 */
export const DEFAULT_STUDENT_PERMISSIONS: StudentPlanPermissions = {
  canAddAdHoc: true,
  canEditMemo: true,
  canMovePlans: false,
  canChangeColor: true,
  canComplete: true,
};

/**
 * 학생 권한을 파싱합니다.
 */
export function parseStudentPermissions(
  permissions: unknown
): StudentPlanPermissions {
  if (!permissions || typeof permissions !== "object") {
    return DEFAULT_STUDENT_PERMISSIONS;
  }

  const p = permissions as Record<string, unknown>;

  return {
    canAddAdHoc:
      typeof p.canAddAdHoc === "boolean"
        ? p.canAddAdHoc
        : DEFAULT_STUDENT_PERMISSIONS.canAddAdHoc,
    canEditMemo:
      typeof p.canEditMemo === "boolean"
        ? p.canEditMemo
        : DEFAULT_STUDENT_PERMISSIONS.canEditMemo,
    canMovePlans:
      typeof p.canMovePlans === "boolean"
        ? p.canMovePlans
        : DEFAULT_STUDENT_PERMISSIONS.canMovePlans,
    canChangeColor:
      typeof p.canChangeColor === "boolean"
        ? p.canChangeColor
        : DEFAULT_STUDENT_PERMISSIONS.canChangeColor,
    canComplete:
      typeof p.canComplete === "boolean"
        ? p.canComplete
        : DEFAULT_STUDENT_PERMISSIONS.canComplete,
  };
}
