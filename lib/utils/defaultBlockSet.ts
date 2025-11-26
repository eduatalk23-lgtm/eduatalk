/**
 * 기본 블록 세트 유틸리티
 * 템플릿 모드에서 블록 세트가 없을 때 사용되는 기본값
 */

export type DefaultBlock = {
  day_of_week: number; // 0(일) ~ 6(토)
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"
};

/**
 * 기본 블록 세트 정보 반환
 * 월~일 10:00~19:00
 */
export function getDefaultBlocks(): DefaultBlock[] {
  return [
    { day_of_week: 1, start_time: "10:00", end_time: "19:00" }, // 월
    { day_of_week: 2, start_time: "10:00", end_time: "19:00" }, // 화
    { day_of_week: 3, start_time: "10:00", end_time: "19:00" }, // 수
    { day_of_week: 4, start_time: "10:00", end_time: "19:00" }, // 목
    { day_of_week: 5, start_time: "10:00", end_time: "19:00" }, // 금
    { day_of_week: 6, start_time: "10:00", end_time: "19:00" }, // 토
    { day_of_week: 0, start_time: "10:00", end_time: "19:00" }, // 일
  ];
}

/**
 * 기본 블록 세트 이름
 */
export const DEFAULT_BLOCK_SET_NAME = "기본 블록 세트";

