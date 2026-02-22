/**
 * 현재 경로에 대한 활성 카테고리 및 아이템 확인
 */

import type {
  NavigationCategory,
  NavigationItem,
  NavigationRole,
} from "./categoryConfig";
import { getCategoriesForRole } from "./categoryConfig";
import { parseHref, isPathActive } from "./categoryNavUtils";

export type ActiveCategoryInfo = {
  category: NavigationCategory;
  activeItem: NavigationItem | null;
  isCategoryActive: boolean;
};

/**
 * 두 쿼리 파라미터 객체가 일치하는지 확인
 */
function matchQueryParams(
  currentParams: URLSearchParams | null,
  itemQueryParams?: Record<string, string>
): boolean {
  if (!itemQueryParams || Object.keys(itemQueryParams).length === 0) {
    return true;
  }

  if (!currentParams) {
    return false;
  }

  for (const [key, value] of Object.entries(itemQueryParams)) {
    if (currentParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}

/**
 * 특정 아이템이 현재 경로와 활성 상태인지 확인
 */
export function isItemActive(
  pathname: string,
  item: NavigationItem,
  searchParams?: URLSearchParams | null
): boolean {
  if (item.exactMatch) {
    return isPathActive(pathname, item.href, true, searchParams, item.queryParams);
  }

  const exactMatch = isPathActive(pathname, item.href, true, searchParams, item.queryParams);
  if (exactMatch) {
    return true;
  }

  if (item.children) {
    const hasActiveChild = item.children.some(child =>
      isItemActive(pathname, child, searchParams)
    );

    if (hasActiveChild) {
      return false;
    }
  }

  if (isPathActive(pathname, item.href, false, searchParams, item.queryParams)) {
    return true;
  }

  const { pathname: itemPathname } = parseHref(item.href);
  const itemSegments = itemPathname.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (pathSegments.length > itemSegments.length) {
    let matches = true;
    for (let i = 0; i < itemSegments.length; i++) {
      if (itemSegments[i] !== pathSegments[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      const isDynamicSegment =
        lastSegment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
        lastSegment.length > 15;

      if (isDynamicSegment) {
        if (item.queryParams && Object.keys(item.queryParams).length > 0) {
          return matchQueryParams(searchParams || null, item.queryParams);
        }
        return true;
      }
    }
  }

  return false;
}

/**
 * 카테고리 내 활성 아이템 찾기
 */
function findActiveItemInCategory(
  pathname: string,
  category: NavigationCategory,
  searchParams?: URLSearchParams | null
): NavigationItem | null {
  for (const item of category.items) {
    if (isItemActive(pathname, item, searchParams)) {
      return item;
    }

    if (item.children) {
      for (const child of item.children) {
        if (isItemActive(pathname, child, searchParams)) {
          return item;
        }
      }
    }
  }

  return null;
}

/**
 * 현재 경로에 대한 활성 카테고리 및 아이템 확인
 */
export function resolveActiveCategory(
  pathname: string,
  role: NavigationRole,
  searchParams?: URLSearchParams | null
): ActiveCategoryInfo | null {
  const categories = getCategoriesForRole(role);

  for (const category of categories) {
    const activeItem = findActiveItemInCategory(pathname, category, searchParams);

    if (activeItem) {
      return {
        category,
        activeItem,
        isCategoryActive: true,
      };
    }

    const categoryPath = category.items[0]?.href;
    if (categoryPath) {
      const { queryParams: categoryQueryParams } = parseHref(categoryPath);
      if (isPathActive(pathname, categoryPath, false, searchParams, categoryQueryParams)) {
        return {
          category,
          activeItem: category.items[0],
          isCategoryActive: true,
        };
      }
    }
  }

  return null;
}

/**
 * 특정 경로가 카테고리의 하위 경로인지 확인
 */
export function isCategoryPath(
  pathname: string,
  category: NavigationCategory,
  searchParams?: URLSearchParams | null
): boolean {
  for (const item of category.items) {
    if (isPathActive(pathname, item.href, false, searchParams, item.queryParams)) {
      return true;
    }
    if (item.children) {
      for (const child of item.children) {
        if (isPathActive(pathname, child.href, false, searchParams, child.queryParams)) {
          return true;
        }
      }
    }
  }
  return false;
}
