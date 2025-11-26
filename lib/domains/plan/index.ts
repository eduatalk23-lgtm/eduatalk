/**
 * Plan 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 plan 도메인에 접근합니다.
 */

// Types
export * from "./types";

// Service (비즈니스 로직)
export * as service from "./service";

// Repository는 외부에 노출하지 않음 (service를 통해 접근)

/**
 * 사용 예시:
 *
 * // 플랜 그룹 조회
 * import { plan } from "@/lib/domains";
 * const groups = await plan.service.getPlanGroups({ studentId: "..." });
 *
 * // 오늘 플랜 조회
 * const todayPlans = await plan.service.getTodayPlans(studentId);
 *
 * // 플랜 진행률 계산
 * const progress = plan.service.calculatePlanProgress(plans);
 */
