type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: "calendar" | "book" | "lecture" | "custom";
};

/**
 * 플랜 그룹 브레드크럼 생성 헬퍼
 */
export function createPlanGroupBreadcrumb(groupName: string, groupId: string): BreadcrumbItem[] {
  return [
    { label: "캘린더", href: "/plan", icon: "calendar" },
    { label: groupName || "플랜 그룹", href: `/plan/group/${groupId}` },
  ];
}

/**
 * 콘텐츠 상세 브레드크럼 생성 헬퍼
 */
export function createContentBreadcrumb(
  groupName: string,
  groupId: string,
  contentName: string,
  contentType: "book" | "lecture" | "custom"
): BreadcrumbItem[] {
  return [
    { label: "캘린더", href: "/plan", icon: "calendar" },
    { label: groupName || "플랜 그룹", href: `/plan/group/${groupId}` },
    { label: contentName, icon: contentType },
  ];
}

export type { BreadcrumbItem };
