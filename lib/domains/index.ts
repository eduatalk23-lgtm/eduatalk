/**
 * Domains Public API
 *
 * 모든 도메인 모듈을 중앙에서 export합니다.
 *
 * @example
 * // 도메인 전체 import
 * import { school, score, plan, camp, student, subject, tenant } from "@/lib/domains";
 *
 * // 개별 타입 import
 * import type { School, Region } from "@/lib/domains/school";
 * import type { SchoolScore, MockScore } from "@/lib/domains/score";
 * import type { PlanGroup, StudentPlan } from "@/lib/domains/plan";
 */

// School 도메인
export * as school from "./school";

// Score 도메인
export * as score from "./score";

// Plan 도메인
export * as plan from "./plan";

// Camp 도메인
export * as camp from "./camp";

// Student 도메인
export * as student from "./student";

// Subject 도메인
export * as subject from "./subject";

// Tenant 도메인
export * as tenant from "./tenant";

// 기타 도메인 (향후 추가 예정)
// export * as content from "./content";
// export * as goal from "./goal";
// export * as auth from "./auth";
// export * as block from "./block";
