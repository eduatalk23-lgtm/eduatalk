/**
 * 표준 spacing 값 정의
 * Spacing-First 정책에 따라 gap을 사용한 간격 관리
 */
export const spacing = {
  section: "gap-6", // 섹션 간 간격
  card: "gap-4", // 카드 내부 간격
  form: "gap-3", // 폼 필드 간격
  page: "gap-8", // 페이지 레벨 간격
  small: "gap-2", // 작은 간격
  medium: "gap-4", // 중간 간격
  large: "gap-6", // 큰 간격
} as const;

/**
 * 반응형 spacing 값
 */
export const responsiveSpacing = {
  section: "gap-4 md:gap-6", // 섹션 간 간격 (반응형)
  card: "gap-3 md:gap-4", // 카드 내부 간격 (반응형)
  page: "gap-6 md:gap-8", // 페이지 레벨 간격 (반응형)
} as const;

