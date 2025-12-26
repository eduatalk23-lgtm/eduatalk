/**
 * Today 도메인 에러 메시지 상수
 *
 * 타이머, 세션, 플랜 관련 에러 메시지를 중앙 관리합니다.
 * 일관된 사용자 경험을 위해 동일한 상황에는 동일한 메시지를 사용합니다.
 */

export const TIMER_ERRORS = {
  // 인증 관련
  AUTH_REQUIRED: "로그인이 필요합니다.",
  TENANT_NOT_FOUND: "기관 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.",

  // 플랜 관련
  PLAN_NOT_FOUND: "플랜을 찾을 수 없습니다.",
  PLAN_ALREADY_COMPLETED: "이미 완료된 플랜입니다. 완료된 플랜은 다시 시작할 수 없습니다.",
  PLAN_NOT_RESCHEDULABLE: "이 플랜은 재조정할 수 없습니다.",
  PLAN_QUERY_ERROR: "플랜 정보 조회 중 오류가 발생했습니다.",
  PLAN_UPDATE_FAILED: "플랜 업데이트에 실패했습니다.",

  // 세션 관련
  SESSION_NOT_FOUND: "세션을 찾을 수 없습니다.",
  SESSION_ALREADY_ENDED: "이미 종료된 세션입니다.",
  SESSION_ALREADY_PAUSED: "이미 일시정지된 상태입니다.",
  SESSION_NOT_PAUSED: "일시정지된 상태가 아닙니다.",
  SESSION_CREATE_FAILED: "세션 생성에 실패했습니다.",
  SESSION_END_FAILED: "세션 종료에 실패했습니다.",
  SESSION_PAUSE_FAILED: "세션 일시정지에 실패했습니다.",
  SESSION_QUERY_ERROR: "활성 세션 조회 중 오류가 발생했습니다.",
  SESSION_CANCELLED_ALREADY_ENDED: "이미 종료된 세션은 취소할 수 없습니다.",

  // 타이머 경합 관련
  TIMER_ALREADY_RUNNING_SAME_PLAN: "이미 해당 플랜의 타이머가 실행 중입니다.",
  TIMER_ALREADY_RUNNING_OTHER_PLAN: "다른 플랜의 타이머가 실행 중입니다. 먼저 해당 플랜의 타이머를 중지해주세요.",
  TIMER_RACE_CONDITION: "다른 플랜의 타이머가 동시에 시작되었습니다. 다시 시도해주세요.",
  TIMER_RESET_FAILED: "타이머 초기화 중 오류가 발생했습니다.",

  // 활성 세션 관련 (타이머 시작 시)
  NO_ACTIVE_SESSION: "활성 세션을 찾을 수 없습니다.",
  NO_ACTIVE_SESSION_START_FIRST: "활성 세션을 찾을 수 없습니다. 플랜을 먼저 시작해주세요.",

  // 콘텐츠 관련
  CONTENT_NOT_FOUND: "콘텐츠를 찾을 수 없습니다.",
  CONTENT_TOTAL_INVALID: "콘텐츠 총량 정보가 유효하지 않습니다.",

  // planId 관련
  PLAN_ID_REQUIRED: "planId가 필요합니다.",
} as const;

export type TimerErrorKey = keyof typeof TIMER_ERRORS;
