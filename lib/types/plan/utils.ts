/**
 * Plan 유틸리티 함수
 *
 * 플랜 관련 클라이언트/서버 공통 유틸리티 함수를 정의합니다.
 */

/**
 * 플랜 시작 가능 여부를 판단하는 정보를 담은 타입
 */
export type LearningStartInfo = {
  /** 학습 시작 가능 여부 */
  canStart: boolean;
  /** 시작 불가 사유 (canStart가 false인 경우) */
  reason?: string;
  /** 시작 불가 코드 (프로그램적 처리용) */
  code?: "virtual" | "completed" | "already_running";
};

/**
 * 플랜의 학습 시작 가능 여부를 판단합니다.
 *
 * @param plan - 플랜 객체 (is_virtual, actual_end_time 필드 필요)
 * @returns 학습 시작 가능 여부와 사유
 *
 * @example
 * ```ts
 * const info = canStartLearning(plan);
 * if (!info.canStart) {
 *   showToast(info.reason);
 * }
 * ```
 */
export function canStartLearning(plan: {
  is_virtual?: boolean | null;
  actual_end_time?: string | null;
}): LearningStartInfo {
  // 가상 플랜 (콘텐츠 미연결)
  if (plan.is_virtual === true) {
    return {
      canStart: false,
      reason: "콘텐츠가 연결되지 않은 플랜입니다. 먼저 콘텐츠를 연결해주세요.",
      code: "virtual",
    };
  }

  // 이미 완료된 플랜
  if (plan.actual_end_time) {
    return {
      canStart: false,
      reason: "이미 완료된 플랜입니다.",
      code: "completed",
    };
  }

  return { canStart: true };
}

/**
 * 플랜이 가상 플랜인지 확인합니다.
 *
 * @param plan - 플랜 객체
 * @returns 가상 플랜 여부
 */
export function isVirtualPlan(plan: { is_virtual?: boolean | null }): boolean {
  return plan.is_virtual === true;
}

/**
 * 플랜이 완료되었는지 확인합니다.
 *
 * @param plan - 플랜 객체 (progress 또는 actual_end_time 필드 필요)
 * @returns 완료 여부
 */
export function isPlanCompleted(plan: {
  progress?: number | null;
  actual_end_time?: string | null;
}): boolean {
  return (plan.progress != null && plan.progress >= 100) || !!plan.actual_end_time;
}
