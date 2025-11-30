/**
 * 시간 단위 변환 유틸리티
 * 
 * DB에는 초 단위로 저장되고, UI에서는 분 단위로 표시/입력됨
 */

/**
 * 초를 분으로 변환 (반올림)
 * @param seconds 초 단위 시간
 * @returns 분 단위 시간 (반올림)
 */
export function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) {
    return null;
  }
  return Math.round(seconds / 60);
}

/**
 * 분을 초로 변환
 * @param minutes 분 단위 시간
 * @returns 초 단위 시간
 */
export function minutesToSeconds(minutes: number | null | undefined): number | null {
  if (minutes === null || minutes === undefined) {
    return null;
  }
  return minutes * 60;
}

