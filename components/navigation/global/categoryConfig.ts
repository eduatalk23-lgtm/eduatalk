/**
 * 전역 카테고리 네비게이션 설정
 * 역할별(학생/관리자/학부모) 카테고리 구조를 정의합니다.
 */

import type { NavigationRole, NavigationItem, NavigationCategory } from "./types";
import { studentCategories } from "./configs/studentCategories";
import { adminCategories } from "./configs/adminCategories";
import { parentCategories } from "./configs/parentCategories";
import { superadminCategories } from "./configs/superadminCategories";

// 타입 재export (하위 호환성 유지)
export type { NavigationRole, NavigationItem, NavigationCategory } from "./types";

/**
 * 역할별 카테고리 설정 맵
 */
export const categoryConfig: Record<NavigationRole, NavigationCategory[]> = {
  student: studentCategories,
  admin: adminCategories,
  parent: parentCategories,
  superadmin: superadminCategories,
  consultant: adminCategories, // consultant는 admin과 동일한 카테고리 사용
};

/**
 * 역할별 카테고리 설정 조회
 */
export function getCategoriesForRole(
  role: NavigationRole
): NavigationCategory[] {
  return categoryConfig[role] || [];
}

/**
 * 모든 카테고리 아이템 플랫 목록 생성 (검색/필터링 용)
 */
export function getAllNavigationItems(role: NavigationRole): NavigationItem[] {
  const categories = getCategoriesForRole(role);
  const items: NavigationItem[] = [];

  function collectItems(
    items: NavigationItem[],
    categoryItems: NavigationItem[]
  ) {
    for (const item of categoryItems) {
      // 역할 체크
      if (item.roles && !item.roles.includes(role)) {
        continue;
      }
      items.push(item);
      if (item.children) {
        collectItems(items, item.children);
      }
    }
  }

  for (const category of categories) {
    collectItems(items, category.items);
  }

  return items;
}
