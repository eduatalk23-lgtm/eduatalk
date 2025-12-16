/**
 * URL 형식 검증
 */
export function isValidUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  try {
    new URL(value);
    return value.startsWith("http://") || value.startsWith("https://");
  } catch {
    return false;
  }
}

