/**
 * CategoryNav 유틸리티 함수
 * 복잡한 렌더링 로직과 계산 로직을 분리
 */

import type { NavigationCategory, NavigationItem, NavigationRole } from "./categoryConfig";
import { isItemActive } from "./resolveActiveCategory";
import type { URLSearchParams } from "next/navigation";

/**
 * href에서 쿼리 파라미터를 분리하여 pathname과 queryParams로 반환
 */
export function parseHref(href: string): { pathname: string; queryParams: Record<string, string> } {
  const [pathname, queryString] = href.split("?");
  const queryParams: Record<string, string> = {};
  
  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      queryParams[key] = value;
    });
  }
  
  return { pathname: pathname || href, queryParams };
}

/**
 * 두 쿼리 파라미터 객체가 일치하는지 확인
 */
function matchQueryParams(
  currentParams: URLSearchParams | null,
  itemQueryParams?: Record<string, string>
): boolean {
  // item에 queryParams가 없으면 쿼리 파라미터 매칭 불필요
  if (!itemQueryParams || Object.keys(itemQueryParams).length === 0) {
    return true;
  }
  
  // currentParams가 없으면 item에 queryParams가 있으면 매칭 실패
  if (!currentParams) {
    return false;
  }
  
  // item의 모든 queryParams가 currentParams에 일치하는지 확인
  for (const [key, value] of Object.entries(itemQueryParams)) {
    if (currentParams.get(key) !== value) {
      return false;
    }
  }
  
  return true;
}

/**
 * 경로가 특정 href와 매칭되는지 확인
 */
export function isPathActive(
  pathname: string,
  href: string,
  exactMatch: boolean = false,
  searchParams?: URLSearchParams | null,
  itemQueryParams?: Record<string, string>
): boolean {
  // href에서 쿼리 파라미터 분리
  const { pathname: hrefPathname, queryParams: hrefQueryParams } = parseHref(href);
  
  // pathname 매칭 확인
  let pathnameMatches = false;
  if (exactMatch) {
    pathnameMatches = pathname === hrefPathname;
  } else {
    pathnameMatches = pathname === hrefPathname || pathname.startsWith(`${hrefPathname}/`);
  }
  
  if (!pathnameMatches) {
    return false;
  }
  
  // 쿼리 파라미터가 있는 경우 매칭 확인
  const hasQueryParams = itemQueryParams && Object.keys(itemQueryParams).length > 0;
  const hasHrefQueryParams = Object.keys(hrefQueryParams).length > 0;
  
  if (hasQueryParams || hasHrefQueryParams) {
    // itemQueryParams가 있으면 그것을 우선 사용, 없으면 href에서 파싱한 것 사용
    const paramsToMatch = itemQueryParams || hrefQueryParams;
    return matchQueryParams(searchParams || null, paramsToMatch);
  }
  
  return true;
}

/**
 * 카테고리가 단일 아이템인지 확인
 */
export function isSingleItemCategory(category: NavigationCategory): boolean {
  return category.items.length === 1 && !category.items[0]?.children;
}

/**
 * 단일 아이템 카테고리의 href 추출
 */
export function getSingleItemHref(category: NavigationCategory): string | null {
  if (!isSingleItemCategory(category)) {
    return null;
  }
  return category.items[0]?.href ?? null;
}

/**
 * 단일 아이템 카테고리의 활성 상태 확인
 */
export function isSingleItemActive(
  category: NavigationCategory,
  pathname: string,
  searchParams: URLSearchParams | null
): boolean {
  if (!isSingleItemCategory(category) || !category.items[0]) {
    return false;
  }
  return isItemActive(pathname, category.items[0], searchParams);
}

/**
 * 카테고리 인덱스 찾기
 */
export function getCategoryIndex(
  categoryId: string,
  categories: NavigationCategory[]
): number {
  return categories.findIndex((c) => c.id === categoryId);
}

/**
 * 카테고리 ARIA 라벨 생성
 */
export function getCategoryAriaLabel(
  category: NavigationCategory,
  isCollapsed: boolean
): string | undefined {
  if (!isCollapsed) {
    return undefined;
  }
  
  if (isSingleItemCategory(category) && category.items[0]) {
    return `${category.label} - ${category.items[0].label}`;
  }
  
  return category.label;
}

/**
 * 카테고리 설명 텍스트 생성
 */
export function getCategoryDescription(
  category: NavigationCategory
): string {
  return `${category.label} 카테고리, ${category.items.length}개의 메뉴 항목`;
}

/**
 * 키보드 네비게이션 헬퍼 함수
 */
export function getNextCategoryIndex(
  currentIndex: number,
  totalCategories: number
): number {
  return (currentIndex + 1) % totalCategories;
}

export function getPrevCategoryIndex(
  currentIndex: number,
  totalCategories: number
): number {
  return currentIndex === 0 ? totalCategories - 1 : currentIndex - 1;
}

/**
 * 타입 검색을 위한 카테고리 찾기
 */
export function findCategoryBySearch(
  search: string,
  categories: NavigationCategory[],
  fromCategoryId?: string | null
): NavigationCategory | null {
  const searchLower = search.toLowerCase();
  let startIndex = 0;

  if (fromCategoryId) {
    const fromIndex = categories.findIndex((c) => c.id === fromCategoryId);
    if (fromIndex !== -1) {
      startIndex = fromIndex + 1;
    }
  }

  // 현재 위치부터 검색
  for (let i = startIndex; i < categories.length; i++) {
    const category = categories[i];
    if (category.label.toLowerCase().startsWith(searchLower)) {
      return category;
    }
  }

  // 처음부터 다시 검색
  for (let i = 0; i < startIndex; i++) {
    const category = categories[i];
    if (category.label.toLowerCase().startsWith(searchLower)) {
      return category;
    }
  }

  return null;
}

/**
 * 카테고리 아이템 필터링 (역할 기반)
 */
export function filterCategoryItemsByRole(
  items: NavigationItem[],
  role: NavigationRole
): NavigationItem[] {
  return items.filter((item) => {
    if (!item.roles) {
      return true;
    }
    return item.roles.includes(role);
  });
}

