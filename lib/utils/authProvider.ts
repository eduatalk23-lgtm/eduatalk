export type AuthProvider = "email" | "google" | "kakao" | "phone";

/**
 * Supabase identity provider 문자열을 AuthProvider 타입으로 변환
 */
export function toAuthProvider(provider: string): AuthProvider {
  switch (provider) {
    case "google":
      return "google";
    case "kakao":
      return "kakao";
    case "phone":
      return "phone";
    default:
      return "email";
  }
}

/**
 * Supabase identities 배열에서 주요 provider 문자열을 추출
 */
export function extractPrimaryProvider(
  identities: { provider: string }[] | null | undefined
): string {
  if (!identities || identities.length === 0) return "email";
  return identities[0].provider;
}

/**
 * 날짜 문자열을 상대 시간으로 포맷 (예: "3시간 전", "2일 전")
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
