/**
 * 캠프 관련 표준 반환 타입 정의
 */

/**
 * 표준 결과 타입
 */
export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

