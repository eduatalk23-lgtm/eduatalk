/**
 * 플랜 그룹 관련 에러 클래스 및 에러 코드 정의
 */

import type { PlanGenerationFailureReason } from "./planGenerationErrors";

export class PlanGroupError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public recoverable: boolean = false,
    public context?: Record<string, unknown>,
    public failureReason?: PlanGenerationFailureReason | PlanGenerationFailureReason[]
  ) {
    super(message);
    this.name = 'PlanGroupError';
    // Error 클래스의 stack trace를 올바르게 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PlanGroupError);
    }
  }
}

/**
 * 플랜 그룹 에러 코드 상수
 */
export const PlanGroupErrorCodes = {
  // 검증 관련
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STEP_VALIDATION_FAILED: 'STEP_VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  
  // 저장 관련
  DRAFT_SAVE_FAILED: 'DRAFT_SAVE_FAILED',
  DRAFT_UPDATE_FAILED: 'DRAFT_UPDATE_FAILED',
  PLAN_GROUP_CREATE_FAILED: 'PLAN_GROUP_CREATE_FAILED',
  PLAN_GROUP_UPDATE_FAILED: 'PLAN_GROUP_UPDATE_FAILED',
  
  // 플랜 생성 관련
  PLAN_GENERATION_FAILED: 'PLAN_GENERATION_FAILED',
  PLAN_GENERATION_TIMEOUT: 'PLAN_GENERATION_TIMEOUT',
  
  // 콘텐츠 관련
  CONTENT_FETCH_FAILED: 'CONTENT_FETCH_FAILED',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  CONTENT_METADATA_FETCH_FAILED: 'CONTENT_METADATA_FETCH_FAILED',

  // FK 관련
  FK_VIOLATION: 'FK_VIOLATION',
  FK_CONTENT_NOT_FOUND: 'FK_CONTENT_NOT_FOUND',
  
  // 스케줄 관련
  SCHEDULE_CALCULATION_FAILED: 'SCHEDULE_CALCULATION_FAILED',
  SCHEDULE_INVALID: 'SCHEDULE_INVALID',
  BLOCK_SET_NOT_FOUND: 'BLOCK_SET_NOT_FOUND',
  
  // 제외일 관련
  EXCLUSION_DUPLICATE: 'EXCLUSION_DUPLICATE',
  
  // 데이터 일관성 관련
  DATA_INCONSISTENCY: 'DATA_INCONSISTENCY',
  DATA_TRANSFORMATION_FAILED: 'DATA_TRANSFORMATION_FAILED',
  
  // 권한 관련
  UNAUTHORIZED: 'UNAUTHORIZED',
  EDIT_NOT_ALLOWED: 'EDIT_NOT_ALLOWED',
  
  // 기타
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type PlanGroupErrorCode = typeof PlanGroupErrorCodes[keyof typeof PlanGroupErrorCodes];

/**
 * 에러 코드에 따른 사용자 친화적 메시지 매핑
 */
export const ErrorUserMessages: Record<PlanGroupErrorCode, string> = {
  [PlanGroupErrorCodes.VALIDATION_FAILED]: '입력값을 확인해주세요.',
  [PlanGroupErrorCodes.STEP_VALIDATION_FAILED]: '현재 단계의 입력값을 확인해주세요.',
  [PlanGroupErrorCodes.REQUIRED_FIELD_MISSING]: '필수 항목을 입력해주세요.',

  [PlanGroupErrorCodes.DRAFT_SAVE_FAILED]: '임시 저장에 실패했습니다. 다시 시도해주세요.',
  [PlanGroupErrorCodes.DRAFT_UPDATE_FAILED]: '임시 저장 업데이트에 실패했습니다. 다시 시도해주세요.',
  [PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED]: '플랜 그룹 생성에 실패했습니다. 다시 시도해주세요.',
  [PlanGroupErrorCodes.PLAN_GROUP_UPDATE_FAILED]: '플랜 그룹 업데이트에 실패했습니다. 다시 시도해주세요.',

  [PlanGroupErrorCodes.PLAN_GENERATION_FAILED]: '플랜 생성에 실패했습니다. 설정을 확인하고 다시 시도해주세요.',
  [PlanGroupErrorCodes.PLAN_GENERATION_TIMEOUT]: '플랜 생성 시간이 초과되었습니다. 다시 시도해주세요.',

  [PlanGroupErrorCodes.CONTENT_FETCH_FAILED]: '콘텐츠 정보를 불러올 수 없습니다.',
  [PlanGroupErrorCodes.CONTENT_NOT_FOUND]: '선택한 콘텐츠를 찾을 수 없습니다.',
  [PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED]: '콘텐츠 상세 정보를 불러올 수 없습니다.',

  [PlanGroupErrorCodes.FK_VIOLATION]: '참조 데이터가 존재하지 않습니다. 데이터를 확인해주세요.',
  [PlanGroupErrorCodes.FK_CONTENT_NOT_FOUND]: '연결하려는 콘텐츠를 찾을 수 없습니다. 콘텐츠가 삭제되었을 수 있습니다.',

  [PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED]: '스케줄 계산에 실패했습니다. 입력값을 확인해주세요.',
  [PlanGroupErrorCodes.SCHEDULE_INVALID]: '스케줄 정보가 유효하지 않습니다.',
  [PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND]: '선택한 블록 세트를 찾을 수 없습니다.',

  [PlanGroupErrorCodes.EXCLUSION_DUPLICATE]: '이미 등록된 제외일이 있습니다.',

  [PlanGroupErrorCodes.DATA_INCONSISTENCY]: '데이터가 일치하지 않습니다. 페이지를 새로고침해주세요.',
  [PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED]: '데이터 변환에 실패했습니다.',

  [PlanGroupErrorCodes.UNAUTHORIZED]: '권한이 없습니다. 로그인 상태를 확인해주세요.',
  [PlanGroupErrorCodes.EDIT_NOT_ALLOWED]: '현재 상태에서는 수정할 수 없습니다.',

  [PlanGroupErrorCodes.UNKNOWN_ERROR]: '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.',
};

/**
 * C2 개선: 에러 코드별 조치 가이드
 */
export type ErrorActionGuide = {
  /** 조치 방법 설명 */
  actions: string[];
  /** 재시도 가능 여부 */
  canRetry: boolean;
  /** 지원 요청 필요 여부 */
  needsSupport: boolean;
  /** 심각도 */
  severity: 'info' | 'warning' | 'error' | 'critical';
};

export const ErrorActionGuides: Record<PlanGroupErrorCode, ErrorActionGuide> = {
  [PlanGroupErrorCodes.VALIDATION_FAILED]: {
    actions: ['빨간색으로 표시된 필드를 확인해주세요', '모든 필수 항목을 입력해주세요'],
    canRetry: false,
    needsSupport: false,
    severity: 'warning',
  },
  [PlanGroupErrorCodes.STEP_VALIDATION_FAILED]: {
    actions: ['현재 단계의 입력 항목을 다시 확인해주세요', '오류 메시지를 참고하여 수정해주세요'],
    canRetry: false,
    needsSupport: false,
    severity: 'warning',
  },
  [PlanGroupErrorCodes.REQUIRED_FIELD_MISSING]: {
    actions: ['필수 항목(*)을 모두 입력해주세요'],
    canRetry: false,
    needsSupport: false,
    severity: 'warning',
  },

  [PlanGroupErrorCodes.DRAFT_SAVE_FAILED]: {
    actions: ['네트워크 연결을 확인해주세요', '잠시 후 다시 시도해주세요'],
    canRetry: true,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.DRAFT_UPDATE_FAILED]: {
    actions: ['네트워크 연결을 확인해주세요', '잠시 후 다시 시도해주세요'],
    canRetry: true,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED]: {
    actions: ['네트워크 연결을 확인해주세요', '입력 데이터를 확인 후 다시 시도해주세요'],
    canRetry: true,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.PLAN_GROUP_UPDATE_FAILED]: {
    actions: ['페이지를 새로고침 후 다시 시도해주세요', '문제가 지속되면 관리자에게 문의해주세요'],
    canRetry: true,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.PLAN_GENERATION_FAILED]: {
    actions: [
      '학습 기간과 콘텐츠 설정을 확인해주세요',
      '콘텐츠의 학습 범위가 적절한지 확인해주세요',
      '블록 세트가 올바르게 설정되어 있는지 확인해주세요',
    ],
    canRetry: true,
    needsSupport: true,
    severity: 'critical',
  },
  [PlanGroupErrorCodes.PLAN_GENERATION_TIMEOUT]: {
    actions: [
      '콘텐츠 양이 많은 경우 시간이 오래 걸릴 수 있습니다',
      '잠시 후 다시 시도해주세요',
      '문제가 지속되면 콘텐츠 수를 줄여보세요',
    ],
    canRetry: true,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.CONTENT_FETCH_FAILED]: {
    actions: ['페이지를 새로고침해주세요', '네트워크 연결을 확인해주세요'],
    canRetry: true,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.CONTENT_NOT_FOUND]: {
    actions: [
      '선택한 콘텐츠가 삭제되었거나 변경되었을 수 있습니다',
      '콘텐츠 목록을 새로고침한 후 다시 선택해주세요',
    ],
    canRetry: false,
    needsSupport: true,
    severity: 'error',
  },
  [PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED]: {
    actions: ['페이지를 새로고침해주세요', '문제가 지속되면 관리자에게 문의해주세요'],
    canRetry: true,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.FK_VIOLATION]: {
    actions: [
      '연결된 데이터가 삭제되었거나 변경되었을 수 있습니다',
      '콘텐츠 또는 플랜 그룹 정보를 다시 확인해주세요',
      '문제가 지속되면 관리자에게 문의해주세요',
    ],
    canRetry: false,
    needsSupport: true,
    severity: 'critical',
  },
  [PlanGroupErrorCodes.FK_CONTENT_NOT_FOUND]: {
    actions: [
      '선택한 콘텐츠가 삭제되었거나 접근 권한이 없을 수 있습니다',
      '다른 콘텐츠를 선택하거나 콘텐츠 목록을 새로고침해주세요',
    ],
    canRetry: false,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED]: {
    actions: [
      '학습 기간 설정을 확인해주세요',
      '제외일이 학습 기간을 초과하지 않는지 확인해주세요',
      '학원 일정이 올바르게 설정되어 있는지 확인해주세요',
    ],
    canRetry: false,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.SCHEDULE_INVALID]: {
    actions: ['시작일이 종료일보다 앞선지 확인해주세요', '학습 가능한 날짜가 있는지 확인해주세요'],
    canRetry: false,
    needsSupport: false,
    severity: 'error',
  },
  [PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND]: {
    actions: ['다른 블록 세트를 선택해주세요', '블록 세트가 삭제되었을 수 있습니다'],
    canRetry: false,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.EXCLUSION_DUPLICATE]: {
    actions: ['이미 등록된 날짜는 제외해주세요', '중복된 제외일을 삭제해주세요'],
    canRetry: false,
    needsSupport: false,
    severity: 'warning',
  },

  [PlanGroupErrorCodes.DATA_INCONSISTENCY]: {
    actions: ['페이지를 새로고침해주세요', '새로고침 후에도 문제가 지속되면 처음부터 다시 시작해주세요'],
    canRetry: false,
    needsSupport: true,
    severity: 'error',
  },
  [PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED]: {
    actions: ['입력 데이터를 확인해주세요', '페이지를 새로고침 후 다시 시도해주세요'],
    canRetry: true,
    needsSupport: true,
    severity: 'error',
  },

  [PlanGroupErrorCodes.UNAUTHORIZED]: {
    actions: ['다시 로그인해주세요', '로그인 후에도 문제가 지속되면 관리자에게 문의해주세요'],
    canRetry: false,
    needsSupport: true,
    severity: 'critical',
  },
  [PlanGroupErrorCodes.EDIT_NOT_ALLOWED]: {
    actions: ['플랜 상태를 확인해주세요', '활성화된 플랜은 수정할 수 없습니다'],
    canRetry: false,
    needsSupport: false,
    severity: 'warning',
  },

  [PlanGroupErrorCodes.UNKNOWN_ERROR]: {
    actions: [
      '페이지를 새로고침 후 다시 시도해주세요',
      '문제가 지속되면 관리자에게 문의해주세요',
    ],
    canRetry: true,
    needsSupport: true,
    severity: 'critical',
  },
};

/**
 * C2 개선: 에러 코드에 대한 전체 정보 조회
 */
export function getErrorInfo(code: PlanGroupErrorCode): {
  message: string;
  guide: ErrorActionGuide;
} {
  return {
    message: ErrorUserMessages[code],
    guide: ErrorActionGuides[code],
  };
}

/**
 * 에러를 PlanGroupError로 변환하는 헬퍼 함수
 */
export function toPlanGroupError(
  error: unknown,
  defaultCode: PlanGroupErrorCode = PlanGroupErrorCodes.UNKNOWN_ERROR,
  context?: Record<string, unknown>
): PlanGroupError {
  if (error instanceof PlanGroupError) {
    return error;
  }

  if (error instanceof Error) {
    // 에러 메시지를 분석하여 적절한 에러 코드로 매핑
    let errorCode = defaultCode;
    let userMessage = ErrorUserMessages[defaultCode];
    let recoverable = false;

    const errorMessage = error.message.toLowerCase();
    // Supabase/PostgreSQL 에러 코드 추출
    const errorObj = error as Error & { code?: string };
    const pgErrorCode = errorObj.code || '';

    // FK violation 에러 감지 (PostgreSQL 에러 코드 23503)
    if (pgErrorCode === '23503' || errorMessage.includes('foreign key') || errorMessage.includes('fk_')) {
      errorCode = PlanGroupErrorCodes.FK_VIOLATION;
      userMessage = ErrorUserMessages[PlanGroupErrorCodes.FK_VIOLATION];

      // 콘텐츠 관련 FK 에러인지 확인
      if (errorMessage.includes('content') || errorMessage.includes('book') || errorMessage.includes('lecture')) {
        errorCode = PlanGroupErrorCodes.FK_CONTENT_NOT_FOUND;
        userMessage = ErrorUserMessages[PlanGroupErrorCodes.FK_CONTENT_NOT_FOUND];
      }
    }
    // 제외일 중복 에러 감지
    else if (errorMessage.includes('이미 등록된 제외일') || (errorMessage.includes('exclusion') && errorMessage.includes('duplicate'))) {
      errorCode = PlanGroupErrorCodes.EXCLUSION_DUPLICATE;
      // 원본 에러 메시지에 중복된 날짜 정보가 있으면 그대로 사용, 없으면 기본 메시지 사용
      userMessage = error.message.includes('이미 등록된 제외일')
        ? error.message
        : ErrorUserMessages[PlanGroupErrorCodes.EXCLUSION_DUPLICATE];
    }
    // 콘텐츠 찾을 수 없음 에러 감지
    else if (errorMessage.includes('콘텐츠를 찾을 수 없') || errorMessage.includes('content not found')) {
      errorCode = PlanGroupErrorCodes.CONTENT_NOT_FOUND;
      userMessage = error.message || ErrorUserMessages[PlanGroupErrorCodes.CONTENT_NOT_FOUND];
    }
    // 권한 에러 감지
    else if (errorMessage.includes('권한') || errorMessage.includes('unauthorized') || errorMessage.includes('로그인')) {
      errorCode = PlanGroupErrorCodes.UNAUTHORIZED;
      userMessage = ErrorUserMessages[PlanGroupErrorCodes.UNAUTHORIZED];
    }

    // recoverable 여부 결정
    recoverable = ErrorActionGuides[errorCode]?.canRetry ?? false;

    return new PlanGroupError(
      error.message,
      errorCode,
      userMessage,
      recoverable,
      { ...context, originalError: error.message, pgErrorCode }
    );
  }

  return new PlanGroupError(
    String(error),
    defaultCode,
    ErrorUserMessages[defaultCode],
    false,
    context
  );
}

/**
 * 복구 가능한 에러인지 확인하는 헬퍼 함수
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof PlanGroupError) {
    return error.recoverable;
  }
  return false;
}

/**
 * M4 개선: DB 에러 메시지를 사용자 친화적 메시지로 변환
 *
 * 이 함수는 DB 에러 메시지(테이블명, 컬럼명 등 스키마 정보 포함)를
 * 사용자에게 노출해도 안전한 메시지로 변환합니다.
 *
 * @param error - 원본 에러 (Error 객체 또는 unknown)
 * @param fallbackMessage - 매핑되지 않는 경우 사용할 기본 메시지
 * @returns 사용자에게 표시할 안전한 에러 메시지
 *
 * @example
 * ```typescript
 * catch (error) {
 *   return {
 *     success: false,
 *     error: getSafeErrorMessage(error, "플랜 저장에 실패했습니다.")
 *   };
 * }
 * ```
 */
export function getSafeErrorMessage(
  error: unknown,
  fallbackMessage: string = "예상치 못한 오류가 발생했습니다."
): string {
  // PlanGroupError인 경우 userMessage 사용
  if (error instanceof PlanGroupError) {
    return error.userMessage;
  }

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const errorMessage = error.message.toLowerCase();
  const errorObj = error as Error & { code?: string };
  const pgErrorCode = errorObj.code || '';

  // PostgreSQL 에러 코드 기반 매핑
  const pgErrorMap: Record<string, string> = {
    '23503': '참조 데이터가 존재하지 않습니다. 데이터를 확인해주세요.',  // FK violation
    '23505': '이미 존재하는 데이터입니다.',  // Unique violation
    '23502': '필수 항목이 누락되었습니다.',  // NOT NULL violation
    '23514': '입력값이 허용 범위를 벗어났습니다.',  // Check violation
    '42501': '권한이 없습니다.',  // Insufficient privilege
    '42P01': '데이터를 찾을 수 없습니다.',  // Undefined table
    '57014': '요청 시간이 초과되었습니다. 다시 시도해주세요.',  // Query canceled (timeout)
    'PGRST116': '데이터를 찾을 수 없습니다.',  // PostgREST not found
  };

  if (pgErrorCode && pgErrorMap[pgErrorCode]) {
    return pgErrorMap[pgErrorCode];
  }

  // 에러 메시지 패턴 기반 매핑
  const patternMap: Array<{ pattern: RegExp | string; message: string }> = [
    { pattern: /foreign key/i, message: '참조 데이터가 존재하지 않습니다.' },
    { pattern: /unique.*constraint/i, message: '이미 존재하는 데이터입니다.' },
    { pattern: /not.null.*constraint/i, message: '필수 항목이 누락되었습니다.' },
    { pattern: /timeout|timed out/i, message: '요청 시간이 초과되었습니다. 다시 시도해주세요.' },
    { pattern: /network|connection|fetch/i, message: '네트워크 연결을 확인해주세요.' },
    { pattern: /unauthorized|permission|denied|권한/i, message: '권한이 없습니다. 로그인 상태를 확인해주세요.' },
    { pattern: /not found|찾을 수 없/i, message: '데이터를 찾을 수 없습니다.' },
    { pattern: /invalid.*input|잘못된.*입력/i, message: '입력값을 확인해주세요.' },
    { pattern: /duplicate|중복/i, message: '이미 존재하는 데이터입니다.' },
  ];

  for (const { pattern, message } of patternMap) {
    if (typeof pattern === 'string' ? errorMessage.includes(pattern) : pattern.test(errorMessage)) {
      return message;
    }
  }

  // 한글 메시지는 사용자에게 직접 표시해도 괜찮음
  // 단, 너무 기술적인 내용이 아닌 경우에만
  if (/^[가-힣\s.,!?]+$/.test(error.message) && error.message.length < 100) {
    return error.message;
  }

  // 매핑되지 않은 경우 fallback 메시지 반환
  return fallbackMessage;
}

/**
 * M4 개선: 에러를 로깅하면서 안전한 메시지를 반환하는 헬퍼
 *
 * 개발자용 로그에는 전체 에러 정보를 기록하고,
 * 사용자에게는 안전한 메시지만 반환합니다.
 *
 * @param error - 원본 에러
 * @param context - 로깅에 포함할 컨텍스트 정보
 * @param fallbackMessage - 사용자에게 보여줄 기본 메시지
 * @returns 사용자에게 표시할 안전한 에러 메시지
 */
export function logAndGetSafeError(
  error: unknown,
  context: string,
  fallbackMessage?: string
): string {
  // 개발자용 전체 로그
  console.error(`[${context}] Error:`, error);

  // 추가 컨텍스트 로깅
  if (error instanceof Error) {
    const errorObj = error as Error & { code?: string; details?: string; hint?: string };
    if (errorObj.code) console.error(`[${context}] Error code:`, errorObj.code);
    if (errorObj.details) console.error(`[${context}] Details:`, errorObj.details);
    if (errorObj.hint) console.error(`[${context}] Hint:`, errorObj.hint);
  }

  // 사용자용 안전한 메시지 반환
  return getSafeErrorMessage(error, fallbackMessage);
}

