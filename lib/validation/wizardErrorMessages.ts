/**
 * 플랜 위저드 에러/경고 메시지 상수
 *
 * 모든 검증 메시지를 중앙 관리하여:
 * - 일관된 메시지 스타일 유지
 * - 다국어 지원 용이
 * - 메시지 변경 시 한 곳만 수정
 */

// ============================================================================
// Step 1: 기본 정보
// ============================================================================
export const STEP1_MESSAGES = {
  // 필수 입력
  NAME_REQUIRED: "플랜 이름을 입력해주세요.",
  PURPOSE_REQUIRED: "학습 목표를 선택해주세요.",
  SCHEDULER_REQUIRED: "스케줄 유형을 선택해주세요.",
  PERIOD_REQUIRED: "학습 기간을 설정해주세요.",

  // 유효성
  PERIOD_INVALID: "시작일이 종료일보다 앞서야 합니다.",
  PERIOD_TOO_SHORT: "학습 기간이 너무 짧습니다. 최소 1일 이상 설정해주세요.",
  PERIOD_TOO_LONG: "학습 기간이 너무 깁니다. 최대 365일까지 설정할 수 있습니다.",
  NAME_TOO_LONG: "플랜 이름은 50자 이내로 입력해주세요.",
} as const;

// ============================================================================
// Step 2: 시간 설정 및 제외일
// ============================================================================
export const STEP2_MESSAGES = {
  // 제외일
  EXCLUSION_OUT_OF_RANGE: "제외일이 학습 기간 밖에 있습니다.",
  EXCLUSION_DUPLICATE: "중복된 제외일이 있습니다.",
  TOO_MANY_EXCLUSIONS: "제외일이 너무 많습니다. 학습 가능한 날이 부족합니다.",

  // 학원 일정
  ACADEMY_TIME_CONFLICT: "학원 일정 시간이 겹칩니다.",
  ACADEMY_INVALID_TIME: "학원 일정의 시작 시간이 종료 시간보다 앞서야 합니다.",

  // 시간 설정
  STUDY_HOURS_REQUIRED: "일일 학습 시간을 설정해주세요.",
  STUDY_HOURS_TOO_SHORT: "일일 학습 시간이 너무 짧습니다. (최소 30분)",
  STUDY_HOURS_TOO_LONG: "일일 학습 시간이 너무 깁니다. (최대 12시간)",
} as const;

// ============================================================================
// Step 3: 스케줄 미리보기
// ============================================================================
export const STEP3_MESSAGES = {
  NO_SCHEDULE_DATA: "스케줄을 생성할 수 없습니다. 이전 단계 설정을 확인해주세요.",
  NO_AVAILABLE_DAYS: "학습 가능한 날이 없습니다. 제외일 설정을 확인해주세요.",
  SCHEDULE_SUMMARY_MISSING: "스케줄 요약을 생성할 수 없습니다.",
} as const;

// ============================================================================
// Step 4: 콘텐츠 선택
// ============================================================================
export const STEP4_MESSAGES = {
  // 필수
  CONTENT_REQUIRED: "학습할 콘텐츠를 1개 이상 선택해주세요.",

  // 제한
  CONTENT_LIMIT_EXCEEDED: "콘텐츠는 최대 9개까지 선택할 수 있습니다.",
  DUPLICATE_CONTENT: "이미 선택된 콘텐츠입니다.",

  // 경고
  CONTENT_RECOMMENDED: (count: number) =>
    `선택한 콘텐츠가 ${count}개뿐입니다. 더 추가하시겠습니까?`,
} as const;

// ============================================================================
// Step 5: 학습 범위 및 제약조건
// ============================================================================
export const STEP5_MESSAGES = {
  // 범위
  RANGE_INVALID: "시작 범위가 종료 범위보다 작아야 합니다.",
  RANGE_NEGATIVE: "범위는 0 이상이어야 합니다.",
  RANGE_TOO_LARGE: "학습 범위가 너무 넓습니다.",

  // 교과 제약
  SUBJECT_ALLOCATION_REQUIRED: "과목별 학습 비중을 설정해주세요.",
  MISSING_SUBJECT_CONTENT: (subjects: string[]) =>
    `다음 과목의 콘텐츠를 선택해주세요: ${subjects.join(", ")}`,

  // 학습/복습 주기
  STUDY_DAYS_RANGE: "학습일은 1~7일 사이로 설정해주세요.",
  REVIEW_DAYS_RANGE: "복습일은 1~7일 사이로 설정해주세요.",
  TOTAL_DAYS_EXCEEDED: "학습일과 복습일의 합이 7일을 초과할 수 없습니다.",

  // 경고
  CONTENT_RANGE_WARNING: (contentName: string, issue: string) =>
    `"${contentName}": ${issue}`,
} as const;

// ============================================================================
// Step 6: 최종 확인
// ============================================================================
export const STEP6_MESSAGES = {
  // 분량 경고
  WORKLOAD_TOO_HEAVY: (estimated: number, available: number) =>
    `예상 학습 기간(${estimated}일)이 설정 기간(${available}일)을 초과합니다. 범위를 조정해주세요.`,
  WORKLOAD_TOO_LIGHT: (estimated: number, available: number) =>
    `예상 학습 기간(${estimated}일)이 설정 기간(${available}일)의 절반 미만입니다. 범위를 늘려보세요.`,
  WORKLOAD_EXCESSIVE: (estimated: number, available: number) =>
    `예상 학습 기간(${estimated}일)이 설정 기간(${available}일)의 1.5배를 초과합니다. 과도한 분량입니다.`,
} as const;

// ============================================================================
// Step 7: 결과
// ============================================================================
export const STEP7_MESSAGES = {
  GENERATION_FAILED: "스케줄 생성에 실패했습니다. 다시 시도해주세요.",
  PARTIAL_SUCCESS: "일부 콘텐츠의 스케줄을 생성하지 못했습니다.",
} as const;

// ============================================================================
// 공통 메시지
// ============================================================================
export const COMMON_MESSAGES = {
  // 서버 에러
  SERVER_ERROR: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인해주세요.",
  TIMEOUT: "요청 시간이 초과되었습니다. 다시 시도해주세요.",

  // 권한
  UNAUTHORIZED: "권한이 없습니다.",
  SESSION_EXPIRED: "세션이 만료되었습니다. 다시 로그인해주세요.",

  // 일반
  REQUIRED_FIELD: "필수 입력 항목입니다.",
  INVALID_FORMAT: "올바른 형식으로 입력해주세요.",
  SAVE_FAILED: "저장에 실패했습니다.",
  LOAD_FAILED: "불러오기에 실패했습니다.",
} as const;

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 콘텐츠 인덱스 기반 에러 메시지 생성
 */
export function getContentRangeError(
  contentIndex: number,
  contentType: "student" | "recommended",
  errorType: "invalid" | "negative"
): string {
  const typeLabel = contentType === "student" ? "선택 콘텐츠" : "추천 콘텐츠";
  const message =
    errorType === "invalid"
      ? STEP5_MESSAGES.RANGE_INVALID
      : STEP5_MESSAGES.RANGE_NEGATIVE;

  return `${typeLabel} ${contentIndex + 1}: ${message}`;
}

/**
 * 필드별 에러 메시지 매핑
 */
export const FIELD_ERROR_MESSAGES: Record<string, string> = {
  // Step 1
  plan_name: STEP1_MESSAGES.NAME_REQUIRED,
  name: STEP1_MESSAGES.NAME_REQUIRED,
  plan_purpose: STEP1_MESSAGES.PURPOSE_REQUIRED,
  scheduler_type: STEP1_MESSAGES.SCHEDULER_REQUIRED,
  period_start: STEP1_MESSAGES.PERIOD_REQUIRED,
  period_end: STEP1_MESSAGES.PERIOD_REQUIRED,

  // Step 2
  exclusions: STEP2_MESSAGES.EXCLUSION_OUT_OF_RANGE,
  academy_schedules: STEP2_MESSAGES.ACADEMY_TIME_CONFLICT,
  study_hours: STEP2_MESSAGES.STUDY_HOURS_REQUIRED,

  // Step 4
  content_selection: STEP4_MESSAGES.CONTENT_REQUIRED,
  student_contents: STEP4_MESSAGES.CONTENT_REQUIRED,

  // Step 5
  subject_allocations: STEP5_MESSAGES.SUBJECT_ALLOCATION_REQUIRED,
  content_allocations: STEP5_MESSAGES.SUBJECT_ALLOCATION_REQUIRED,
};

/**
 * Zod 에러 경로를 사용자 친화적 메시지로 변환
 */
export function translateZodError(path: string, message: string): string {
  // 미리 정의된 필드 메시지가 있으면 사용
  const fieldMessage = FIELD_ERROR_MESSAGES[path];
  if (fieldMessage) {
    return fieldMessage;
  }

  // 배열 인덱스가 포함된 경로 처리 (예: student_contents.0.start_range)
  if (path.includes("student_contents") || path.includes("recommended_contents")) {
    const match = path.match(/(\w+_contents)\.(\d+)\.(\w+)/);
    if (match) {
      const [, contentType, index, field] = match;
      const typeLabel =
        contentType === "student_contents" ? "선택 콘텐츠" : "추천 콘텐츠";
      const fieldLabel = field === "start_range" ? "시작 범위" : "종료 범위";
      return `${typeLabel} ${Number(index) + 1}번의 ${fieldLabel}: ${message}`;
    }
  }

  // 기본: Zod 원본 메시지 반환
  return message;
}
