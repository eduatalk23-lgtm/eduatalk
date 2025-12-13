/**
 * 범위 유효성 검사 유틸리티 함수
 * ContentRangeInput과 RangeSettingModal에서 공통 사용
 */

export type ContentType = "book" | "lecture";

export type RangeValidationResult = {
  valid: boolean;
  error?: string;
  startNum?: number;
  endNum?: number;
};

/**
 * 범위 입력 유효성 검사
 * @param start 시작 범위 (문자열 또는 숫자)
 * @param end 종료 범위 (문자열 또는 숫자)
 * @param maxValue 최대값 (총 페이지수 또는 회차)
 * @param contentType 콘텐츠 타입
 * @returns 유효성 검사 결과
 */
export function validateRangeInput(
  start: string | null | undefined,
  end: string | null | undefined,
  maxValue?: number | null,
  contentType: ContentType = "book"
): RangeValidationResult {
  // 빈 값 체크
  if (!start || start.trim() === "" || !end || end.trim() === "") {
    return {
      valid: false,
      error: "시작과 종료 범위를 모두 입력해주세요.",
    };
  }

  const startNum = Number(start);
  const endNum = Number(end);

  // 숫자 유효성
  if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
    return {
      valid: false,
      error: "1 이상의 올바른 숫자를 입력해주세요.",
    };
  }

  // 범위 유효성
  if (startNum > endNum) {
    return {
      valid: false,
      error: "시작 범위가 종료 범위보다 클 수 없습니다.",
    };
  }

  // 최대값 검증
  if (maxValue && (startNum > maxValue || endNum > maxValue)) {
    return {
      valid: false,
      error: `범위는 최대 ${maxValue}${contentType === "book" ? "페이지" : "회차"}까지 입력할 수 있습니다.`,
    };
  }

  return {
    valid: true,
    startNum,
    endNum,
  };
}

/**
 * 범위 선택 유효성 검사 (상세 정보가 있을 때)
 * @param startDetailId 시작 상세 정보 ID
 * @param endDetailId 종료 상세 정보 ID
 * @param startIndex 시작 인덱스
 * @param endIndex 종료 인덱스
 * @returns 유효성 검사 결과
 */
export function validateRangeSelection(
  startDetailId: string | null | undefined,
  endDetailId: string | null | undefined,
  startIndex: number,
  endIndex: number
): RangeValidationResult {
  if (!startDetailId || !endDetailId) {
    return {
      valid: false,
      error: "시작과 종료 범위를 모두 선택해주세요.",
    };
  }

  if (startIndex === -1 || endIndex === -1) {
    return {
      valid: false,
      error: "선택한 범위 정보를 찾을 수 없습니다.",
    };
  }

  if (startIndex > endIndex) {
    return {
      valid: false,
      error: "시작이 종료보다 뒤에 있습니다. 범위를 다시 선택해주세요.",
    };
  }

  return {
    valid: true,
  };
}

