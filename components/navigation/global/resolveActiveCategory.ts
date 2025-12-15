/**
 * 현재 경로에 대한 활성 카테고리 및 아이템 확인
 */

import type {
  NavigationCategory,
  NavigationItem,
  NavigationRole,
} from "./categoryConfig";
import { getCategoriesForRole } from "./categoryConfig";

export type ActiveCategoryInfo = {
  category: NavigationCategory;
  activeItem: NavigationItem | null;
  isCategoryActive: boolean;
};

/**
 * href에서 쿼리 파라미터를 분리하여 pathname과 queryParams로 반환
 */
function parseHref(href: string): { pathname: string; queryParams: Record<string, string> } {
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
function isPathActive(
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
 * 특정 아이템이 현재 경로와 활성 상태인지 확인
 */
export function isItemActive(
  pathname: string,
  item: NavigationItem,
  searchParams?: URLSearchParams | null
): boolean {
  // href에서 쿼리 파라미터 분리
  const { pathname: itemPathname } = parseHref(item.href);
  
  // 정확히 일치해야 하는 경우
  if (item.exactMatch) {
    return isPathActive(pathname, item.href, true, searchParams, item.queryParams);
  }

  // startsWith 매칭
  if (isPathActive(pathname, item.href, false, searchParams, item.queryParams)) {
    return true;
  }

  // 동적 라우트 매칭 (children이 있는 경우, 동적 세그먼트 포함 경로 검사)
  if (item.children) {
    for (const child of item.children) {
      if (isItemActive(pathname, child, searchParams)) {
        return true;
      }
    }
  }

  // 동적 세그먼트 패턴 매칭 (예: /contents/books/[id] 형태)
  // href에 [id] 같은 패턴이 있거나, pathname이 부모 경로의 하위 경로인 경우
  const itemSegments = itemPathname.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  
  // 부모 경로 매칭 확인 (itemPathname이 pathname의 부모 경로인지)
  if (pathSegments.length > itemSegments.length) {
    let matches = true;
    for (let i = 0; i < itemSegments.length; i++) {
      if (itemSegments[i] !== pathSegments[i]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      // 마지막 세그먼트가 UUID나 긴 ID 형태인지 확인
      const lastSegment = pathSegments[pathSegments.length - 1];
      const isDynamicSegment = 
        lastSegment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
        lastSegment.length > 15;
      
      if (isDynamicSegment) {
        // 쿼리 파라미터가 있는 경우 매칭 확인
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
    // 역할 체크는 호출부에서 처리 (여기서는 단순 매칭만)

    // 직접 매칭
    if (isItemActive(pathname, item, searchParams)) {
      return item;
    }

    // children 검색
    if (item.children) {
      for (const child of item.children) {
        if (isItemActive(pathname, child, searchParams)) {
          return item; // 부모 아이템 반환
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

    // 카테고리 자체가 활성화된 경우 (카테고리의 기본 경로와 일치)
    const categoryPath = category.items[0]?.href;
    if (categoryPath) {
      const { pathname: categoryPathname, queryParams: categoryQueryParams } = parseHref(categoryPath);
      if (isPathActive(pathname, categoryPath, false, searchParams, categoryQueryParams)) {
        return {
          category,
          activeItem: category.items[0],
          isCategoryActive: true,
        };
      }
    }
  }

  // 활성 카테고리를 찾지 못한 경우
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

/**
 * Breadcrumbs 생성을 위한 경로 체인 생성
 */
export function getBreadcrumbChain(
  pathname: string,
  role: NavigationRole
): Array<{ label: string; href: string }> {
  const chain: Array<{ label: string; href: string }> = [];
  const categories = getCategoriesForRole(role);

  // 홈 추가 (역할별)
  const homeHref =
    role === "student"
      ? "/dashboard"
      : role === "admin" || role === "consultant"
      ? "/admin/dashboard"
      : role === "superadmin"
      ? "/superadmin/dashboard"
      : "/parent/dashboard";
  const homeLabel =
    role === "student"
      ? "홈"
      : role === "admin" || role === "consultant"
      ? "관리자 홈"
      : role === "superadmin"
      ? "Super Admin 홈"
      : "학부모 홈";
  chain.push({ label: homeLabel, href: homeHref });

  // 특별 처리: /contents/books/new, /contents/lectures/new (정확한 매칭보다 먼저 처리)
  if (
    pathname === "/contents/books/new" ||
    pathname === "/contents/lectures/new"
  ) {
    // 콘텐츠 관리 추가
    chain.push({ label: "콘텐츠 관리", href: "/contents" });
    // 등록 페이지 추가
    const label =
      pathname === "/contents/books/new" ? "책 등록하기" : "강의 등록하기";
    chain.push({ label, href: pathname });
    return chain;
  }

  // 모든 아이템 플랫 리스트 생성 (매칭용)
  const allItems: Array<{
    category: NavigationCategory;
    item: NavigationItem;
    child?: NavigationItem;
  }> = [];
  for (const category of categories) {
    for (const item of category.items) {
      allItems.push({ category, item });
      if (item.children) {
        for (const child of item.children) {
          allItems.push({ category, item, child });
        }
      }
    }
  }

  // 정확한 매칭 찾기 (가장 구체적인 경로부터)
  const sortedItems = allItems.sort((a, b) => {
    const aPath = a.child?.href || a.item.href;
    const bPath = b.child?.href || b.item.href;
    return bPath.split("/").length - aPath.split("/").length;
  });

  for (const { category, item, child } of sortedItems) {
    const itemPath = child?.href || item.href;

    // 정확한 경로 매칭
    if (isPathActive(pathname, itemPath)) {
      // 하위 메뉴가 1개이고 children이 없는 경우: 카테고리 라벨만 사용 (아이템 라벨 건너뛰기)
      const singleItem =
        category.items.length === 1 && !category.items[0].children;

      if (singleItem) {
        // 카테고리 라벨만 추가
        const categoryHref = category.items[0]?.href || item.href;
        if (
          chain.length === 1 ||
          chain[chain.length - 1].href !== categoryHref
        ) {
          chain.push({ label: category.label, href: categoryHref });
        }
      } else {
        // 카테고리 추가 (중복 방지)
        const categoryHref = category.items[0]?.href || item.href;
        if (
          chain.length === 1 ||
          chain[chain.length - 1].href !== categoryHref
        ) {
          chain.push({ label: category.label, href: categoryHref });
        }

        // 아이템 추가
        if (child) {
          chain.push({ label: item.label, href: item.href });
          chain.push({ label: child.label, href: child.href });
        } else {
          chain.push({ label: item.label, href: item.href });
        }
      }

      return chain;
    }
  }

  // 동적 라우트 매칭 (정확한 매칭이 없는 경우)
  for (const { category, item } of sortedItems) {
    // children이 있는 아이템만 동적 라우트로 처리
    if (item.children) continue;

    if (matchesDynamicRoute(pathname, item.href)) {
      // 하위 메뉴가 1개이고 children이 없는 경우: 카테고리 라벨만 사용
      const singleItem =
        category.items.length === 1 && !category.items[0].children;

      if (singleItem) {
        // 카테고리 라벨만 추가
        const categoryHref = category.items[0]?.href || item.href;
        if (
          chain.length === 1 ||
          chain[chain.length - 1].href !== categoryHref
        ) {
          chain.push({ label: category.label, href: categoryHref });
        }
      } else {
        // 카테고리 추가
        const categoryHref = category.items[0]?.href || item.href;
        if (
          chain.length === 1 ||
          chain[chain.length - 1].href !== categoryHref
        ) {
          chain.push({ label: category.label, href: categoryHref });
        }

        // 아이템 추가
        chain.push({ label: item.label, href: item.href });
      }

      // 동적 라우트이므로 마지막에 상세 라벨 추가
      chain.push({ label: "상세보기", href: pathname });

      return chain;
    }
  }

  // 매칭되지 않는 경우, 경로 세그먼트 기반으로 생성
  const segments = pathname.split("/").filter(Boolean);
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // UUID나 긴 ID 형태인 경우 스킵 (동적 세그먼트)
    if (
      segment.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      ) ||
      segment.length > 20
    ) {
      // 마지막 세그먼트인 경우 "상세보기" 추가
      if (i === segments.length - 1) {
        chain.push({ label: "상세보기", href: pathname });
      }
      continue;
    }

    // /contents/books/[id], /contents/lectures/[id] 등의 경우
    // books나 lectures 세그먼트를 건너뛰고 /contents로 직접 연결
    if (segment === "books" || segment === "lectures") {
      // /contents가 아직 추가되지 않았다면 추가
      if (!chain.some((c) => c.href === "/contents")) {
        chain.push({ label: "콘텐츠 관리", href: "/contents" });
      }
      // books/lectures 세그먼트는 스킵하고 다음으로
      continue;
    }

    currentPath += `/${segment}`;
    const label = getSegmentLabel(segment, role);

    // 이미 체인에 추가된 항목이 아닌 경우만 추가
    if (!chain.some((c) => c.href === currentPath)) {
      chain.push({ label, href: currentPath });
    }
  }

  return chain;
}

/**
 * 동적 라우트 패턴과 경로 매칭
 * 예: /contents/books → /contents/books/[id] 매칭
 */
function matchesDynamicRoute(pathname: string, basePath: string): boolean {
  // basePath가 패턴이 아닌 실제 경로인 경우, 하위 동적 라우트인지 확인
  const baseSegments = basePath.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  // basePath보다 길거나 같아야 함
  if (pathSegments.length < baseSegments.length) {
    return false;
  }

  // 앞부분 세그먼트가 모두 일치해야 함
  for (let i = 0; i < baseSegments.length; i++) {
    if (baseSegments[i] !== pathSegments[i]) {
      return false;
    }
  }

  // 동일한 경로면 false (동적 라우트가 아님)
  if (pathSegments.length === baseSegments.length) {
    return false;
  }

  // 추가 세그먼트가 있는 경우, 마지막이 ID 형태인지 확인
  if (pathSegments.length > baseSegments.length) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    // UUID 또는 긴 ID 형태
    if (lastSegment.match(/^[0-9a-f-]{8,}$/i) || lastSegment.length > 15) {
      return true;
    }
  }

  return false;
}

/**
 * 경로 세그먼트를 한글 라벨로 변환
 */
function getSegmentLabel(segment: string, role: NavigationRole): string {
  const labelMap: Record<NavigationRole, Record<string, string>> = {
    student: {
      dashboard: "대시보드",
      today: "오늘 학습",
      plan: "플랜 관리",
      contents: "콘텐츠 관리",
      books: "교재",
      lectures: "강의",
      custom: "커스텀",
      analysis: "학습 분석",
      scores: "성적 관리",
      reports: "리포트",
      scheduler: "스케줄러",
      blocks: "시간 관리",
      time: "시간 관리",
      new: "등록",
      edit: "수정",
    },
    admin: {
      admin: "관리자",
      dashboard: "대시보드",
      students: "학생 관리",
      consulting: "상담 노트",
      attendance: "출석 관리",
      sms: "SMS 발송 이력",
      reports: "리포트",
      compare: "비교 분석",
      settings: "설정",
      tenant: "기관 설정",
      tools: "도구",
      superadmin: "Super Admin",
      tenants: "기관 관리",
      subjects: "교과/과목 관리",
      schools: "학교 관리",
    },
    consultant: {
      admin: "관리자",
      dashboard: "대시보드",
      students: "학생 관리",
      consulting: "상담 노트",
      attendance: "출석 관리",
      sms: "SMS 발송 이력",
      reports: "리포트",
      compare: "비교 분석",
      settings: "설정",
      tenant: "기관 설정",
      tools: "도구",
      superadmin: "Super Admin",
      tenants: "기관 관리",
      subjects: "교과/과목 관리",
      schools: "학교 관리",
    },
    superadmin: {
      superadmin: "Super Admin",
      dashboard: "대시보드",
      tenants: "기관 관리",
      "admin-users": "관리자 계정",
      "unverified-users": "미인증 가입 관리",
      "tenantless-users": "테넌트 미할당 사용자",
      settings: "설정",
    },
    parent: {
      parent: "학부모",
      dashboard: "대시보드",
      report: "리포트",
      reports: "리포트",
      weekly: "주간 리포트",
      monthly: "월간 리포트",
      scores: "성적",
      history: "이력",
      settings: "설정",
    },
  };

  return labelMap[role]?.[segment] || segment;
}
