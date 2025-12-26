/**
 * Camp Domain Error Handling Utilities
 *
 * 캠프 도메인 전용 에러 처리 유틸리티
 */

import { ErrorCode } from "@/lib/errors";

// ============================================
// 에러 타입 정의
// ============================================

/**
 * 캠프 에러 카테고리
 */
export type CampErrorCategory =
  | "network"
  | "validation"
  | "permission"
  | "notFound"
  | "conflict"
  | "business"
  | "server";

/**
 * 캠프 에러 정보
 */
export type CampErrorInfo = {
  category: CampErrorCategory;
  userMessage: string;
  technicalMessage?: string;
  recoveryActions?: RecoveryAction[];
  retryable: boolean;
};

/**
 * 복구 액션
 */
export type RecoveryAction = {
  label: string;
  action: "refresh" | "retry" | "goBack" | "goHome" | "contact";
};

// ============================================
// 에러 메시지 매핑
// ============================================

/**
 * 서버 에러 메시지를 사용자 친화적 메시지로 변환
 */
const ERROR_MESSAGE_MAP: Record<string, CampErrorInfo> = {
  // 권한 에러
  "권한이 없습니다.": {
    category: "permission",
    userMessage: "이 작업을 수행할 권한이 없습니다.",
    recoveryActions: [
      { label: "홈으로 이동", action: "goHome" },
      { label: "관리자 문의", action: "contact" },
    ],
    retryable: false,
  },
  "기관 정보를 찾을 수 없습니다.": {
    category: "permission",
    userMessage: "기관 정보가 올바르지 않습니다. 다시 로그인해주세요.",
    recoveryActions: [{ label: "다시 로그인", action: "goHome" }],
    retryable: false,
  },

  // 데이터 미존재 에러
  "템플릿을 찾을 수 없습니다.": {
    category: "notFound",
    userMessage: "요청하신 캠프 템플릿을 찾을 수 없습니다.",
    recoveryActions: [
      { label: "목록으로 돌아가기", action: "goBack" },
      { label: "새로고침", action: "refresh" },
    ],
    retryable: true,
  },
  "초대를 찾을 수 없습니다.": {
    category: "notFound",
    userMessage: "요청하신 초대 정보를 찾을 수 없습니다.",
    recoveryActions: [
      { label: "목록으로 돌아가기", action: "goBack" },
      { label: "새로고침", action: "refresh" },
    ],
    retryable: true,
  },
  "플랜 그룹을 찾을 수 없습니다.": {
    category: "notFound",
    userMessage: "참여 정보를 찾을 수 없습니다. 페이지를 새로고침해주세요.",
    recoveryActions: [{ label: "새로고침", action: "refresh" }],
    retryable: true,
  },

  // 비즈니스 로직 에러
  "이미 제출된 캠프 참여 정보가 있습니다.": {
    category: "conflict",
    userMessage: "이미 참여 정보를 제출하셨습니다.",
    recoveryActions: [{ label: "캠프 목록 보기", action: "goBack" }],
    retryable: false,
  },
  "보관된 템플릿에는 참여할 수 없습니다.": {
    category: "business",
    userMessage: "이 캠프는 더 이상 참여할 수 없습니다.",
    recoveryActions: [{ label: "다른 캠프 보기", action: "goBack" }],
    retryable: false,
  },
  "학습이 시작된 캠프는 취소할 수 없습니다.": {
    category: "business",
    userMessage:
      "이미 학습을 시작한 캠프는 취소할 수 없습니다. 관리자에게 문의해주세요.",
    recoveryActions: [{ label: "관리자 문의", action: "contact" }],
    retryable: false,
  },
  "만료된 초대입니다.": {
    category: "business",
    userMessage: "초대 기간이 만료되었습니다. 관리자에게 재초대를 요청해주세요.",
    recoveryActions: [{ label: "관리자 문의", action: "contact" }],
    retryable: false,
  },
};

// ============================================
// 네트워크 에러 감지
// ============================================

/**
 * 네트워크 에러인지 확인
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("aborted")
    );
  }
  return false;
}

/**
 * 타임아웃 에러인지 확인
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("timeout") || message.includes("aborted");
  }
  return false;
}

// ============================================
// 에러 파싱 및 변환
// ============================================

/**
 * 서버 액션 결과에서 에러 정보 추출
 */
export function parseServerActionError(
  result: { success: boolean; error?: string },
  defaultMessage: string
): CampErrorInfo {
  if (result.success) {
    throw new Error("parseServerActionError called on successful result");
  }

  const errorMessage = result.error || defaultMessage;

  // 매핑된 에러 메시지 확인
  const mappedError = ERROR_MESSAGE_MAP[errorMessage];
  if (mappedError) {
    return {
      ...mappedError,
      technicalMessage: errorMessage,
    };
  }

  // 에러 코드별 분류
  if (
    errorMessage.includes("권한") ||
    errorMessage.includes("인증") ||
    errorMessage.includes("로그인")
  ) {
    return {
      category: "permission",
      userMessage: errorMessage,
      retryable: false,
      recoveryActions: [{ label: "다시 로그인", action: "goHome" }],
    };
  }

  if (
    errorMessage.includes("찾을 수 없") ||
    errorMessage.includes("존재하지 않")
  ) {
    return {
      category: "notFound",
      userMessage: errorMessage,
      retryable: true,
      recoveryActions: [{ label: "새로고침", action: "refresh" }],
    };
  }

  if (
    errorMessage.includes("이미") ||
    errorMessage.includes("중복") ||
    errorMessage.includes("23505")
  ) {
    return {
      category: "conflict",
      userMessage: "이미 처리된 요청입니다. 페이지를 새로고침해주세요.",
      retryable: false,
      recoveryActions: [{ label: "새로고침", action: "refresh" }],
    };
  }

  if (
    errorMessage.includes("필수") ||
    errorMessage.includes("형식") ||
    errorMessage.includes("올바르지")
  ) {
    return {
      category: "validation",
      userMessage: errorMessage,
      retryable: false,
    };
  }

  // 기본 서버 에러
  return {
    category: "server",
    userMessage: errorMessage,
    technicalMessage: errorMessage,
    retryable: true,
    recoveryActions: [
      { label: "다시 시도", action: "retry" },
      { label: "새로고침", action: "refresh" },
    ],
  };
}

/**
 * 네트워크 에러 정보 생성
 */
export function createNetworkErrorInfo(error: unknown): CampErrorInfo {
  if (isTimeoutError(error)) {
    return {
      category: "network",
      userMessage:
        "요청 시간이 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요.",
      technicalMessage: error instanceof Error ? error.message : String(error),
      retryable: true,
      recoveryActions: [
        { label: "다시 시도", action: "retry" },
        { label: "새로고침", action: "refresh" },
      ],
    };
  }

  return {
    category: "network",
    userMessage:
      "네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.",
    technicalMessage: error instanceof Error ? error.message : String(error),
    retryable: true,
    recoveryActions: [
      { label: "다시 시도", action: "retry" },
      { label: "새로고침", action: "refresh" },
    ],
  };
}

/**
 * 알 수 없는 에러 정보 생성
 */
export function createUnknownErrorInfo(
  error: unknown,
  context?: string
): CampErrorInfo {
  const baseMessage = "예상치 못한 오류가 발생했습니다.";
  const contextMessage = context ? `${context} 중 오류가 발생했습니다.` : baseMessage;

  return {
    category: "server",
    userMessage: `${contextMessage} 잠시 후 다시 시도해주세요.`,
    technicalMessage: error instanceof Error ? error.message : String(error),
    retryable: true,
    recoveryActions: [
      { label: "다시 시도", action: "retry" },
      { label: "새로고침", action: "refresh" },
      { label: "관리자 문의", action: "contact" },
    ],
  };
}

// ============================================
// 에러 핸들러
// ============================================

/**
 * 캠프 에러 핸들러 옵션
 */
export type HandleCampErrorOptions = {
  /** 작업 컨텍스트 (예: "초대 발송", "참여 취소") */
  context?: string;
  /** 기본 에러 메시지 */
  defaultMessage?: string;
  /** 에러 표시 함수 */
  showError: (message: string) => void;
  /** 경고 표시 함수 (선택) */
  showWarning?: (message: string) => void;
  /** 재시도 함수 (선택) */
  onRetry?: () => void;
  /** 뒤로가기 함수 (선택) */
  onGoBack?: () => void;
  /** 홈으로 이동 함수 (선택) */
  onGoHome?: () => void;
  /** 새로고침 함수 (선택) */
  onRefresh?: () => void;
};

/**
 * 캠프 에러 처리
 *
 * @example
 * ```ts
 * const result = await submitCampParticipation(data);
 * if (!result.success) {
 *   handleCampError(result, {
 *     context: "캠프 참여 제출",
 *     showError: toast.showError,
 *     onRefresh: () => router.refresh(),
 *   });
 *   return;
 * }
 * ```
 */
export function handleCampError(
  error: unknown,
  options: HandleCampErrorOptions
): CampErrorInfo {
  const {
    context,
    defaultMessage = "작업을 처리하는 중 오류가 발생했습니다.",
    showError,
  } = options;

  let errorInfo: CampErrorInfo;

  // 네트워크 에러 확인
  if (isNetworkError(error)) {
    errorInfo = createNetworkErrorInfo(error);
  }
  // 서버 액션 결과 확인
  else if (
    typeof error === "object" &&
    error !== null &&
    "success" in error &&
    !(error as { success: boolean }).success
  ) {
    errorInfo = parseServerActionError(
      error as { success: boolean; error?: string },
      defaultMessage
    );
  }
  // 일반 에러
  else {
    errorInfo = createUnknownErrorInfo(error, context);
  }

  // 에러 메시지 표시
  showError(errorInfo.userMessage);

  // 콘솔 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    console.error(`[Camp Error] ${context || "Unknown context"}:`, {
      category: errorInfo.category,
      userMessage: errorInfo.userMessage,
      technicalMessage: errorInfo.technicalMessage,
      originalError: error,
    });
  }

  return errorInfo;
}

// ============================================
// 부분 성공 처리
// ============================================

/**
 * 부분 성공 결과 타입
 */
export type PartialSuccessResult<T = unknown> = {
  success: boolean;
  data?: T;
  successCount?: number;
  failureCount?: number;
  errors?: Array<{ id?: string; error: string }>;
  warnings?: string[];
};

/**
 * 부분 성공 결과 처리
 *
 * @example
 * ```ts
 * const result = await bulkCreatePlanGroups(ids);
 * handlePartialSuccess(result, {
 *   showSuccess: toast.showSuccess,
 *   showWarning: toast.showWarning,
 *   showError: toast.showError,
 *   successMessage: (count) => `${count}명의 플랜 그룹이 생성되었습니다.`,
 *   failureMessage: (count) => `${count}건의 처리가 실패했습니다.`,
 * });
 * ```
 */
export function handlePartialSuccess<T>(
  result: PartialSuccessResult<T>,
  options: {
    showSuccess: (message: string) => void;
    showWarning?: (message: string) => void;
    showError: (message: string) => void;
    successMessage: (count: number) => string;
    failureMessage?: (count: number, errors?: string[]) => string;
  }
): void {
  const { showSuccess, showWarning, showError, successMessage, failureMessage } =
    options;

  if (!result.success) {
    // 완전 실패
    const errorMessage =
      result.errors?.[0]?.error || "작업을 처리하는 중 오류가 발생했습니다.";
    showError(errorMessage);
    return;
  }

  const successCount = result.successCount ?? 0;
  const failureCount = result.failureCount ?? 0;

  if (failureCount === 0) {
    // 완전 성공
    showSuccess(successMessage(successCount));
  } else if (successCount > 0) {
    // 부분 성공
    showSuccess(successMessage(successCount));
    if (showWarning && failureMessage) {
      const errorMessages = result.errors?.map((e) => e.error) ?? [];
      showWarning(failureMessage(failureCount, errorMessages));
    }
  } else {
    // 모든 항목 실패
    const errorMessage =
      result.errors?.[0]?.error || "모든 항목 처리가 실패했습니다.";
    showError(errorMessage);
  }

  // 경고 메시지 처리
  if (result.warnings && result.warnings.length > 0 && showWarning) {
    result.warnings.forEach((warning) => {
      showWarning(warning);
    });
  }
}

// ============================================
// 에러 코드 변환
// ============================================

/**
 * ErrorCode를 사용자 친화적 메시지로 변환
 */
export function getErrorCodeMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.UNAUTHORIZED]: "로그인이 필요합니다.",
    [ErrorCode.FORBIDDEN]: "이 작업을 수행할 권한이 없습니다.",
    [ErrorCode.VALIDATION_ERROR]: "입력 정보를 확인해주세요.",
    [ErrorCode.INVALID_INPUT]: "입력값이 올바르지 않습니다.",
    [ErrorCode.DATABASE_ERROR]: "데이터 처리 중 오류가 발생했습니다.",
    [ErrorCode.NOT_FOUND]: "요청하신 정보를 찾을 수 없습니다.",
    [ErrorCode.DUPLICATE_ENTRY]: "이미 처리된 요청입니다.",
    [ErrorCode.BUSINESS_LOGIC_ERROR]: "요청을 처리할 수 없습니다.",
    [ErrorCode.INTERNAL_ERROR]: "서버 오류가 발생했습니다.",
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: "외부 서비스 연동 중 오류가 발생했습니다.",
    [ErrorCode.CONFIGURATION_ERROR]: "시스템 설정 오류가 발생했습니다.",
  };

  return messages[code] || "오류가 발생했습니다.";
}
