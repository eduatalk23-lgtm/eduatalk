/**
 * 플랜 관련 캐시 무효화 유틸리티
 *
 * 플랜 생성/수정/삭제 시 일관된 캐시 무효화를 위한 헬퍼 함수들
 *
 * @module lib/domains/plan/utils/cacheInvalidation
 */

import { revalidatePath } from "next/cache";

/**
 * 플랜 캐시 무효화 옵션
 */
export interface RevalidatePlanCacheOptions {
  /** 학생 ID (관리자 페이지 무효화에 필요) */
  studentId?: string;
  /** 플랜 그룹 ID (그룹 상세 페이지 무효화에 필요) */
  groupId?: string;
  /** 캘린더 페이지 무효화 여부 (기본: true) */
  includeCalendar?: boolean;
  /** 관리자 페이지 무효화 여부 (기본: studentId가 있으면 true) */
  includeAdmin?: boolean;
}

/**
 * 플랜 관련 페이지 캐시 무효화 (표준)
 *
 * 플랜 생성/수정/삭제 후 호출하여 관련 페이지들의 캐시를 무효화합니다.
 *
 * 무효화되는 경로:
 * - `/plan` - 플랜 목록 페이지
 * - `/today` - 오늘의 학습 페이지
 * - `/plan/calendar` - 플랜 캘린더 페이지 (옵션)
 * - `/plan/group/${groupId}` - 플랜 그룹 상세 페이지 (groupId 제공 시)
 * - `/admin/students/${studentId}/plans` - 관리자 플랜 관리 페이지 (studentId 제공 시)
 *
 * @example
 * ```typescript
 * // 기본 사용 (학생 컨텍스트)
 * revalidatePlanCache();
 *
 * // 관리자 컨텍스트
 * revalidatePlanCache({ studentId: "student-uuid" });
 *
 * // 그룹 상세 페이지도 무효화
 * revalidatePlanCache({ groupId: "group-uuid" });
 *
 * // 전체 옵션
 * revalidatePlanCache({
 *   studentId: "student-uuid",
 *   groupId: "group-uuid",
 *   includeCalendar: true,
 *   includeAdmin: true,
 * });
 * ```
 */
export function revalidatePlanCache(options: RevalidatePlanCacheOptions = {}): void {
  const {
    studentId,
    groupId,
    includeCalendar = true,
    includeAdmin = !!studentId,
  } = options;

  // 기본 경로 (항상 무효화)
  revalidatePath("/plan");
  revalidatePath("/today");

  // 캘린더 페이지 (옵션)
  if (includeCalendar) {
    revalidatePath("/plan/calendar");
  }

  // 그룹 상세 페이지 (groupId 제공 시)
  if (groupId) {
    revalidatePath(`/plan/group/${groupId}`);
  }

  // 관리자 페이지 (studentId 제공 시)
  if (includeAdmin && studentId) {
    revalidatePath(`/admin/students/${studentId}/plans`);
  }
}

/**
 * 플랜 그룹 생성 후 캐시 무효화
 *
 * 플랜 그룹 생성 시 사용하는 편의 함수
 */
export function revalidateAfterPlanGroupCreate(
  groupId: string,
  studentId?: string
): void {
  revalidatePlanCache({
    groupId,
    studentId,
    includeCalendar: true,
  });
}

/**
 * 플랜 생성 후 캐시 무효화
 *
 * 개별 플랜 생성 시 사용하는 편의 함수
 */
export function revalidateAfterPlanCreate(studentId?: string): void {
  revalidatePlanCache({
    studentId,
    includeCalendar: true,
  });
}

/**
 * 플랜 삭제 후 캐시 무효화
 *
 * 플랜 또는 플랜 그룹 삭제 시 사용하는 편의 함수
 */
export function revalidateAfterPlanDelete(
  groupId?: string,
  studentId?: string
): void {
  revalidatePlanCache({
    groupId,
    studentId,
    includeCalendar: true,
  });
}
