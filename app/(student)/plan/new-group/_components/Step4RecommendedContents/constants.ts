/**
 * Step4RecommendedContents 상수 정의
 */

// 사용 가능한 교과 목록
export const AVAILABLE_SUBJECTS = ["국어", "수학", "영어", "과학", "사회"] as const;

// 최대 콘텐츠 개수
export const MAX_CONTENTS = 9;

// 최소 추천 개수
export const MIN_RECOMMENDATION_COUNT = 1;

// 최대 추천 개수 (교과당)
export const MAX_RECOMMENDATION_COUNT_PER_SUBJECT = 5;

// 필수 교과 (기본값)
export const DEFAULT_REQUIRED_SUBJECTS = ["국어", "수학", "영어"] as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  NO_SUBJECTS_SELECTED: "최소 1개 이상의 교과를 선택해주세요.",
  NO_COUNT_SET: "최소 1개 이상의 콘텐츠를 추천 받으려면 개수를 설정해주세요.",
  EXCEED_MAX_CONTENTS: (current: number, requested: number, max: number) =>
    `추천 받을 수 있는 최대 개수를 초과했습니다. (현재: ${current}개, 요청: ${requested}개, 최대: ${max}개)`,
  ALREADY_SELECTED: "이미 선택된 콘텐츠입니다.",
  DUPLICATE_CONTENT: "이미 추가된 콘텐츠입니다.",
  NO_CONTENT_SELECTED: "선택된 콘텐츠가 없습니다.",
  RANGE_NOT_SET: "시작과 종료 범위를 모두 선택해주세요.",
  REQUIRED_SUBJECTS_NOT_MET: "필수 교과가 충족되지 않았습니다.",
} as const;

// 성공 메시지
export const SUCCESS_MESSAGES = {
  RECOMMENDATIONS_ADDED: (count: number) => `추천 콘텐츠 ${count}개가 자동으로 추가되었습니다.`,
  CONTENTS_ADDED: (count: number) => `${count}개의 콘텐츠가 추가되었습니다.`,
  REFRESH_COMPLETED: "새로운 추천이 추가되었습니다.",
  RANGE_SAVED: "범위가 저장되었습니다.",
} as const;

// 확인 메시지
export const CONFIRM_MESSAGES = {
  REFRESH_RECOMMENDATIONS: "새로운 추천을 받으시겠습니까? 기존 추천 목록에 새 추천이 추가됩니다.",
  CLOSE_WITH_CHANGES: "변경 사항이 저장되지 않았습니다. 정말 닫으시겠습니까?",
  REMOVE_CONTENT: "이 콘텐츠를 제거하시겠습니까?",
} as const;

