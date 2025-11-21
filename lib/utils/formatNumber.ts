/**
 * 숫자를 소수점 2자리로 포맷팅
 * @param value 포맷팅할 숫자
 * @returns 소수점 2자리로 포맷팅된 문자열
 */
export function formatNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * 숫자를 소수점 2자리로 포맷팅 (0 제거)
 * @param value 포맷팅할 숫자
 * @returns 소수점 2자리로 포맷팅된 문자열 (불필요한 0 제거)
 */
export function formatNumberClean(value: number): string {
  const formatted = value.toFixed(2);
  // .00으로 끝나는 경우 정수로 표시
  if (formatted.endsWith(".00")) {
    return formatted.slice(0, -3);
  }
  // .0으로 끝나는 경우 한 자리만 표시
  if (formatted.endsWith("0") && formatted.includes(".")) {
    return formatted.slice(0, -1);
  }
  return formatted;
}

