/**
 * CategoryNav 유틸리티 함수
 * 복잡한 렌더링 로직과 계산 로직을 분리
 */

import type { NavigationCategory, NavigationItem, NavigationRole } from "./categoryConfig";
import { isItemActive } from "./resolveActiveCategory";
import type { URLSearchParams } from "next/navigation";

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

