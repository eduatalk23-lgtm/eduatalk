/**
 * 캐싱 전략 통일
 * unstable_cache 사용 패턴 통일 및 캐시 키 명명 규칙
 */

import { unstable_cache } from "next/cache";

/**
 * 캐시 재검증 시간 (초)
 */
export const CACHE_REVALIDATE_TIME = {
  SHORT: 60, // 1분 - 자주 변경되는 데이터
  MEDIUM: 300, // 5분 - 보통 변경 빈도
  LONG: 600, // 10분 - 자주 변경되지 않는 데이터
  VERY_LONG: 3600, // 1시간 - 거의 변경되지 않는 데이터
} as const;

/**
 * 캐시 태그
 */
export const CACHE_TAGS = {
  // 학생 관련
  STUDENT: "student",
  STUDENT_STATS: "student:stats",
  STUDENT_PLANS: "student:plans",
  STUDENT_SCORES: "student:scores",
  STUDENT_CONTENTS: "student:contents",
  
  // 플랜 그룹 관련
  PLAN_GROUP: "plan-group",
  PLAN_GROUP_LIST: "plan-group:list",
  PLAN_GROUP_DETAIL: "plan-group:detail",
  
  // 플랜 관련
  PLAN: "plan",
  PLAN_LIST: "plan:list",
  
  // 콘텐츠 관련
  CONTENT: "content",
  MASTER_CONTENT: "master-content",
  
  // 스케줄 관련
  SCHEDULE: "schedule",
  SCHEDULE_CALCULATION: "schedule:calculation",
  
  // 대시보드 관련
  DASHBOARD: "dashboard",
  DASHBOARD_STATS: "dashboard:stats",
} as const;

/**
 * 캐시 키 생성 헬퍼
 * 일관된 캐시 키 명명 규칙 적용
 * 
 * @example
 * createCacheKey("student", studentId, "plans") // "student:${studentId}:plans"
 * createCacheKey("plan-group", groupId) // "plan-group:${groupId}"
 */
export function createCacheKey(
  ...parts: Array<string | number | null | undefined>
): string {
  return parts
    .filter((part) => part !== null && part !== undefined)
    .map((part) => String(part))
    .join(":");
}

/**
 * 캐시된 함수 실행
 * unstable_cache를 일관된 패턴으로 사용
 * 
 * @param fn - 캐시할 함수
 * @param keyParts - 캐시 키 파트들
 * @param options - 캐시 옵션
 */
export function withCache<T>(
  fn: () => Promise<T>,
  keyParts: Array<string | number | null | undefined>,
  options: {
    tags?: string[];
    revalidate?: number;
  } = {}
): Promise<T> {
  const cacheKey = createCacheKey(...keyParts);
  const { tags = [], revalidate = CACHE_REVALIDATE_TIME.MEDIUM } = options;

  return unstable_cache(
    fn,
    [cacheKey],
    {
      tags,
      revalidate,
    }
  )();
}

/**
 * 학생별 캐시 키 생성
 */
export function createStudentCacheKey(
  studentId: string,
  ...additionalParts: Array<string | number | null | undefined>
): string {
  return createCacheKey("student", studentId, ...additionalParts);
}

/**
 * 플랜 그룹별 캐시 키 생성
 */
export function createPlanGroupCacheKey(
  groupId: string,
  ...additionalParts: Array<string | number | null | undefined>
): string {
  return createCacheKey("plan-group", groupId, ...additionalParts);
}

/**
 * 캐시 무효화 헬퍼 (revalidateTag 사용)
 * 
 * @example
 * await invalidateCache(CACHE_TAGS.STUDENT_PLANS);
 * await invalidateCache(CACHE_TAGS.PLAN_GROUP, groupId);
 */
export async function invalidateCache(
  tag: string,
  ...additionalTags: string[]
): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  revalidateTag(tag);
  for (const additionalTag of additionalTags) {
    revalidateTag(additionalTag);
  }
}

