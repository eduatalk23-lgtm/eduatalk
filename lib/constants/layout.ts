/**
 * 레이아웃 표준 상수
 * 
 * 페이지 유형별 표준 max-w 값을 정의합니다.
 * Spacing-First 정책과 함께 사용하여 일관된 레이아웃을 제공합니다.
 */

export const LAYOUT_WIDTHS = {
  /** 폼 페이지 (settings, account, devices 등) */
  FORM: "max-w-2xl",
  
  /** 콘텐츠 상세 페이지 (books/[id], lectures/[id] 등) */
  CONTENT_DETAIL: "max-w-3xl",
  
  /** 리스트/대시보드 페이지 (contents, plan 등) */
  LIST: "max-w-4xl",
  
  /** 캠프/플랜 그룹 페이지 (camp, plan/group/[id] 등) */
  CAMP_PLAN: "max-w-5xl",
  
  /** 대시보드 메인 페이지 (today, dashboard 등) */
  DASHBOARD: "max-w-7xl",
  
  /** 모달/다이얼로그 (작은 모달) */
  MODAL_SM: "max-w-2xl",
  
  /** 모달/다이얼로그 (큰 모달) */
  MODAL_LG: "max-w-4xl",
} as const;

/**
 * 페이지 유형별 레이아웃 클래스 반환
 */
export function getLayoutWidth(type: keyof typeof LAYOUT_WIDTHS): string {
  return LAYOUT_WIDTHS[type];
}

/**
 * 표준 컨테이너 클래스 반환 (padding 포함)
 */
export function getContainerClass(
  widthType: keyof typeof LAYOUT_WIDTHS,
  padding: "sm" | "md" | "lg" = "md"
): string {
  const paddingClasses = {
    sm: "px-4 py-4",
    md: "px-4 py-6 md:px-6 md:py-8",
    lg: "px-4 py-8 md:px-8 md:py-10",
  };
  
  return `mx-auto w-full ${LAYOUT_WIDTHS[widthType]} ${paddingClasses[padding]}`;
}

