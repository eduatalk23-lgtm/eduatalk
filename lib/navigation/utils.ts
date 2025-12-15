/**
 * 네비게이션 관련 유틸리티 함수
 */

/**
 * 캠프 모드인지 확인
 * @param pathname 현재 경로
 * @param searchParams URL 쿼리 파라미터
 * @returns 캠프 모드 여부
 */
export function isCampMode(
  pathname: string | null,
  searchParams: URLSearchParams | null
): boolean {
  if (!pathname) return false;
  
  return (
    (pathname.startsWith("/plan/group/") && searchParams?.get("camp") === "true") ||
    pathname.startsWith("/camp/")
  );
}

/**
 * pathname이 null일 경우 빈 문자열로 변환
 * @param pathname 현재 경로
 * @returns null이 아닌 pathname
 */
export function ensurePathname(pathname: string | null): string {
  return pathname || "";
}

