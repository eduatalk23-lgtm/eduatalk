/**
 * 콘텐츠 타입과 볼륨 기반 소요시간 계산 유틸리티
 *
 * @module lib/domains/admin-plan/utils/durationCalculator
 */

/**
 * 콘텐츠 타입과 볼륨 기반으로 예상 소요시간(분)을 계산
 *
 * @param totalVolume - 콘텐츠 볼륨 (페이지 수, 에피소드 수 등)
 * @param contentType - 콘텐츠 타입 ('book', 'lecture', 'custom' 등)
 * @returns 예상 소요시간 (분)
 *
 * @example
 * ```typescript
 * // 강의 5개 에피소드 = 150분 (30분/에피소드)
 * calculateEstimatedMinutes(5, 'lecture') // 150
 *
 * // 책 30페이지 = 60분 (2분/페이지)
 * calculateEstimatedMinutes(30, 'book') // 60
 *
 * // 기본값
 * calculateEstimatedMinutes(null, 'unknown') // 30
 * ```
 */
export function calculateEstimatedMinutes(
  totalVolume: number | null | undefined,
  contentType: string
): number {
  // 볼륨이 없으면 기본 30분
  if (!totalVolume || totalVolume <= 0) {
    return 30;
  }

  switch (contentType) {
    case 'lecture':
      // 에피소드당 30분
      return totalVolume * 30;

    case 'book':
      // 페이지당 2분
      return Math.ceil(totalVolume * 2);

    case 'custom':
      // 단위당 1.5분 (기존 로직과 동일)
      return Math.ceil(totalVolume * 1.5);

    default:
      // 알 수 없는 타입은 기본 30분
      return 30;
  }
}

/**
 * 예상 소요시간을 사람이 읽기 쉬운 형식으로 변환
 *
 * @param minutes - 소요시간 (분)
 * @returns 포맷된 문자열 (예: "1시간 30분")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remainingMinutes}분`;
}
