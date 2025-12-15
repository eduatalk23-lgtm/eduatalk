/**
 * 네비게이션 관련 유틸리티 함수
 */

import type { NavigationRole, NavigationCategory } from "@/components/navigation/global/types";
import type { ActiveCategoryInfo } from "@/components/navigation/global/resolveActiveCategory";
import { resolveActiveCategory } from "@/components/navigation/global/resolveActiveCategory";

/**
 * 캠프 모드인지 확인
 * @param pathname 현재 경로
 * @param searchParams URL 쿼리 파라미터
 * @returns 캠프 모드 여부
 */
export function isCampMode(
  pathname: string | null,
  searchParams: URLSearchParams | null
): boolean {
  if (!pathname) return false;
  
  return (
    (pathname.startsWith("/plan/group/") && searchParams?.get("camp") === "true") ||
    pathname.startsWith("/camp/")
  );
}

/**
 * pathname이 null일 경우 빈 문자열로 변환
 * @param pathname 현재 경로
 * @returns null이 아닌 pathname
 */
export function ensurePathname(pathname: string | null): string {
  return pathname || "";
}

/**
 * 네비게이션에서 사용할 역할로 매핑
 * consultant는 admin 카테고리를 사용하도록 매핑
 * @param role 원본 역할
 * @returns 네비게이션에서 사용할 역할
 */
export function mapRoleForNavigation(role: NavigationRole | "consultant"): NavigationRole {
  if (role === "consultant") {
    return "admin";
  }
  return role;
}

/**
 * 캠프 모드를 고려한 활성 카테고리 정보 계산
 * 캠프 모드인 경우 "캠프 관리" 카테고리를 활성화
 * @param pathname 현재 경로
 * @param role 사용자 역할
 * @param searchParams URL 쿼리 파라미터
 * @param categories 카테고리 목록
 * @param campMode 캠프 모드 여부
 * @returns 활성 카테고리 정보
 */
export function getActiveCategoryWithCampMode(
  pathname: string,
  role: NavigationRole,
  searchParams: URLSearchParams | null,
  categories: NavigationCategory[],
  campMode: boolean
): ActiveCategoryInfo | null {
  let active = resolveActiveCategory(pathname, role, searchParams);
  
  // 캠프 모드인 경우 "캠프 관리" 카테고리 활성화
  if (campMode && role === "student") {
    const campCategory = categories.find((cat) => cat.id === "camp");
    if (campCategory) {
      active = {
        category: campCategory,
        activeItem: campCategory.items[0] || null,
        isCategoryActive: true,
      };
    }
  }
  
  return active;
}

