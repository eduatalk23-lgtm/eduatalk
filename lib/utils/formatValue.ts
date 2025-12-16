/**
 * 빈 값 체크 및 플레이스홀더 반환
 * @param value - 체크할 값
 * @param placeholder - 빈 값일 때 표시할 텍스트 (기본값: "-")
 * @returns 값이 있으면 문자열로 변환, 없으면 플레이스홀더
 */
export function formatValue(
  value: string | number | null | undefined,
  placeholder: string = "-"
): string {
  if (value === null || value === undefined || value === "") {
    return placeholder;
  }
  return String(value);
}

/**
 * 빈 값 여부 체크
 */
export function isEmptyValue(
  value: string | number | null | undefined
): boolean {
  return value === null || value === undefined || value === "";
}
