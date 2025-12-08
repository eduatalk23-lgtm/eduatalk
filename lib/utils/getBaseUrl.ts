/**
 * BASE_URL 유틸리티 함수
 * 환경 변수 또는 런타임에서 기본 URL을 가져옵니다.
 */

/**
 * 서버 사이드에서 BASE_URL을 가져옵니다.
 * @param headers - Next.js headers 객체 (선택사항)
 * @returns BASE_URL 문자열
 */
export function getBaseUrl(headers?: Headers): string {
  // 1. 환경 변수 우선 사용
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // 2. 서버 사이드: headers에서 호스트 추출
  if (typeof window === "undefined") {
    if (headers) {
      const host = headers.get("host");
      const protocol = headers.get("x-forwarded-proto") || "http";
      if (host) {
        return `${protocol}://${host}`;
      }
    }
    // 기본값: 개발 환경
    return process.env.NODE_ENV === "production"
      ? "https://yourdomain.com" // 프로덕션 기본값 (환경 변수 설정 권장)
      : "http://localhost:3000";
  }

  // 3. 클라이언트 사이드: window.location 사용
  return window.location.origin;
}

/**
 * 클라이언트 사이드에서 BASE_URL을 가져옵니다.
 * @returns BASE_URL 문자열
 */
export function getBaseUrlClient(): string {
  // 환경 변수 우선
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // window.location 사용
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 기본값
  return "http://localhost:3000";
}

