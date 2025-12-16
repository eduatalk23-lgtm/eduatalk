/**
 * 시간 변환 유틸리티 함수
 * 
 * 플랜 생성 및 스케줄링에서 사용하는 시간 변환 함수를 통합 제공합니다.
 */

/**
 * 시간 문자열을 분 단위로 변환
 * 
 * @param time - 시간 문자열 (HH:mm 형식, 예: "09:30")
 * @returns 분 단위 시간 (예: "09:30" → 570)
 * 
 * @example
 * ```typescript
 * timeToMinutes("09:30") // 570
 * timeToMinutes("13:45") // 825
 * ```
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 * 
 * @param minutes - 분 단위 시간 (예: 570)
 * @returns 시간 문자열 (HH:mm 형식, 예: "09:30")
 * 
 * @example
 * ```typescript
 * minutesToTime(570) // "09:30"
 * minutesToTime(825) // "13:45"
 * ```
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

