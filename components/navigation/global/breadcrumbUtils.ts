/**
 * Breadcrumbs 유틸리티 함수
 * 동적 라벨 처리 로직을 분리
 */

type BreadcrumbItem = {
  label: string;
  href: string;
};

/**
 * 경로 세그먼트를 분석하여 기본 라벨 생성
 */
function getDefaultDetailLabel(href: string): string {
  const pathSegments = href.split("/").filter(Boolean);

  // /contents/books/[id] → "교재"
  if (pathSegments.includes("books") && pathSegments.includes("contents")) {
    return "교재";
  }

  // /contents/lectures/[id] → "강의"
  if (pathSegments.includes("lectures") && pathSegments.includes("contents")) {
    return "강의";
  }

  // /plan/[id] → "플랜 상세"
  if (pathSegments.includes("plan") && pathSegments.length === 2) {
    return "플랜 상세";
  }

  // /plan/[id]/edit → "플랜 수정"
  if (pathSegments.includes("plan") && pathSegments.includes("edit")) {
    return "플랜 수정";
  }

  // /contents/books/[id]/edit → "책 수정"
  if (pathSegments.includes("books") && pathSegments.includes("edit")) {
    return "책 수정";
  }

  // /contents/lectures/[id]/edit → "강의 수정"
  if (pathSegments.includes("lectures") && pathSegments.includes("edit")) {
    return "강의 수정";
  }

  // /goals/[id] → "목표 상세"
  if (pathSegments.includes("goals") && pathSegments.length === 2) {
    return "목표 상세";
  }

  // /scores/[id] → "성적 상세"
  if (pathSegments.includes("scores") && pathSegments.length === 2) {
    return "성적 상세";
  }

  // /admin/students/[id] → "학생 상세"
  if (pathSegments.includes("students") && pathSegments.includes("admin")) {
    return "학생 상세";
  }

  return "상세보기";
}

/**
 * Breadcrumb 라벨을 동적으로 보강
 * @param item 원본 breadcrumb 아이템
 * @param dynamicLabels 동적 라벨 맵 (href → label)
 * @returns 보강된 breadcrumb 아이템
 */
export function enrichBreadcrumbLabel(
  item: BreadcrumbItem,
  dynamicLabels?: Record<string, string>
): BreadcrumbItem {
  // 동적 라벨이 제공된 경우 우선 적용
  if (dynamicLabels && dynamicLabels[item.href]) {
    return {
      ...item,
      label: dynamicLabels[item.href],
    };
  }

  // "상세보기" 라벨을 더 구체적으로 변경
  if (item.label === "상세보기") {
    return {
      ...item,
      label: getDefaultDetailLabel(item.href),
    };
  }

  return item;
}

/**
 * Breadcrumb 체인 전체에 동적 라벨 적용
 * @param chain 원본 breadcrumb 체인
 * @param dynamicLabels 동적 라벨 맵
 * @returns 보강된 breadcrumb 체인
 */
export function enrichBreadcrumbChain(
  chain: BreadcrumbItem[],
  dynamicLabels?: Record<string, string>
): BreadcrumbItem[] {
  return chain.map((item) => enrichBreadcrumbLabel(item, dynamicLabels));
}

