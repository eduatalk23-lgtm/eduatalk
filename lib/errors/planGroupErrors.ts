/**
 * 플랜 그룹 관련 에러 클래스 및 에러 코드 정의
 */

export class PlanGroupError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public recoverable: boolean = false,
    public context?: Record<string, unknown>
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
  
  // 스케줄 관련
  SCHEDULE_CALCULATION_FAILED: 'SCHEDULE_CALCULATION_FAILED',
  SCHEDULE_INVALID: 'SCHEDULE_INVALID',
  BLOCK_SET_NOT_FOUND: 'BLOCK_SET_NOT_FOUND',
  
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
  
  [PlanGroupErrorCodes.SCHEDULE_CALCULATION_FAILED]: '스케줄 계산에 실패했습니다. 입력값을 확인해주세요.',
  [PlanGroupErrorCodes.SCHEDULE_INVALID]: '스케줄 정보가 유효하지 않습니다.',
  [PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND]: '선택한 블록 세트를 찾을 수 없습니다.',
  
  [PlanGroupErrorCodes.DATA_INCONSISTENCY]: '데이터가 일치하지 않습니다. 페이지를 새로고침해주세요.',
  [PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED]: '데이터 변환에 실패했습니다.',
  
  [PlanGroupErrorCodes.UNAUTHORIZED]: '권한이 없습니다. 로그인 상태를 확인해주세요.',
  [PlanGroupErrorCodes.EDIT_NOT_ALLOWED]: '현재 상태에서는 수정할 수 없습니다.',
  
  [PlanGroupErrorCodes.UNKNOWN_ERROR]: '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.',
};

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
    return new PlanGroupError(
      error.message,
      defaultCode,
      ErrorUserMessages[defaultCode],
      false,
      { ...context, originalError: error.message }
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

