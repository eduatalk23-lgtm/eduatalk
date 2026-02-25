/**
 * 플랜 완료 관련 타입 및 유틸리티
 *
 * Event + Task 레이어 분리:
 * - 이벤트 상태: calendar_events.status (confirmed/tentative/cancelled)
 * - 완료 여부: event_study_data.done (boolean, 단일 진실 공급원)
 */

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
