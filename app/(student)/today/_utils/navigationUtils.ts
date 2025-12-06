/**
 * 네비게이션 유틸리티 함수
 * 플랜 실행 페이지로 이동하는 URL을 생성합니다.
 */

/**
 * 플랜 실행 페이지 URL을 생성합니다.
 * @param planId - 플랜 ID
 * @param campMode - 캠프 모드 여부 (기본값: false)
 * @returns 플랜 실행 페이지 URL
 */
export function buildPlanExecutionUrl(planId: string, campMode?: boolean): string {
  const query = campMode ? "?mode=camp" : "";
  return `/today/plan/${planId}${query}`;
}

