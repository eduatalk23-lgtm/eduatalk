/**
 * 학생 관련 에러 클래스 및 에러 코드 정의
 * 
 * PlanGroupError 패턴을 참고하여 학생 관련 에러를 표준화합니다.
 */

export class StudentError extends Error {
  constructor(
    message: string,
    public code: StudentErrorCode,
    public userMessage: string,
    public recoverable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StudentError';
    // Error 클래스의 stack trace를 올바르게 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StudentError);
    }
  }
}

/**
 * 학생 에러 코드 상수
 */
export const StudentErrorCodes = {
  // 학생 조회 관련
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  STUDENT_ALREADY_EXISTS: 'STUDENT_ALREADY_EXISTS',
  
  // 연결 코드 관련
  CONNECTION_CODE_INVALID: 'CONNECTION_CODE_INVALID',
  CONNECTION_CODE_EXPIRED: 'CONNECTION_CODE_EXPIRED',
  CONNECTION_CODE_ALREADY_USED: 'CONNECTION_CODE_ALREADY_USED',
  CONNECTION_CODE_NOT_FOUND: 'CONNECTION_CODE_NOT_FOUND',
  
  // 권한 관련
  UNAUTHORIZED: 'UNAUTHORIZED',
  RLS_POLICY_VIOLATION: 'RLS_POLICY_VIOLATION',
  
  // 검증 관련
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  
  // 데이터베이스 관련
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNIQUE_VIOLATION: 'UNIQUE_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  
  // 연결 프로세스 관련
  LINK_STUDENT_FAILED: 'LINK_STUDENT_FAILED',
  CREATE_STUDENT_FAILED: 'CREATE_STUDENT_FAILED',
  UPDATE_STUDENT_FAILED: 'UPDATE_STUDENT_FAILED',
  DELETE_STUDENT_FAILED: 'DELETE_STUDENT_FAILED',
  
  // 기타
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type StudentErrorCode = typeof StudentErrorCodes[keyof typeof StudentErrorCodes];

/**
 * 에러 코드에 따른 사용자 친화적 메시지 매핑
 */
export const STUDENT_ERROR_MESSAGES: Record<StudentErrorCode, string> = {
  [StudentErrorCodes.STUDENT_NOT_FOUND]: '학생 정보를 찾을 수 없습니다.',
  [StudentErrorCodes.STUDENT_ALREADY_EXISTS]: '이미 존재하는 학생입니다.',
  
  [StudentErrorCodes.CONNECTION_CODE_INVALID]: '유효하지 않은 연결 코드입니다.',
  [StudentErrorCodes.CONNECTION_CODE_EXPIRED]: '만료된 연결 코드입니다.',
  [StudentErrorCodes.CONNECTION_CODE_ALREADY_USED]: '이미 사용된 연결 코드입니다.',
  [StudentErrorCodes.CONNECTION_CODE_NOT_FOUND]: '연결 코드를 찾을 수 없습니다.',
  
  [StudentErrorCodes.UNAUTHORIZED]: '권한이 없습니다. 로그인 상태를 확인해주세요.',
  [StudentErrorCodes.RLS_POLICY_VIOLATION]: '데이터 접근 권한이 없습니다. 관리자에게 문의하세요.',
  
  [StudentErrorCodes.VALIDATION_FAILED]: '입력값을 확인해주세요.',
  [StudentErrorCodes.REQUIRED_FIELD_MISSING]: '필수 항목을 입력해주세요.',
  [StudentErrorCodes.INVALID_PHONE_NUMBER]: '전화번호 형식이 올바르지 않습니다.',
  
  [StudentErrorCodes.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [StudentErrorCodes.UNIQUE_VIOLATION]: '이미 존재하는 데이터입니다.',
  [StudentErrorCodes.FOREIGN_KEY_VIOLATION]: '관련된 데이터를 찾을 수 없습니다.',
  
  [StudentErrorCodes.LINK_STUDENT_FAILED]: '학생 계정 연결에 실패했습니다. 다시 시도해주세요.',
  [StudentErrorCodes.CREATE_STUDENT_FAILED]: '학생 등록에 실패했습니다. 다시 시도해주세요.',
  [StudentErrorCodes.UPDATE_STUDENT_FAILED]: '학생 정보 수정에 실패했습니다. 다시 시도해주세요.',
  [StudentErrorCodes.DELETE_STUDENT_FAILED]: '학생 삭제에 실패했습니다. 다시 시도해주세요.',
  
  [StudentErrorCodes.UNKNOWN_ERROR]: '예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.',
};

/**
 * 에러 코드와 컨텍스트를 기반으로 사용자 친화적 메시지를 생성
 */
export function getStudentErrorMessage(
  code: StudentErrorCode,
  context?: Record<string, unknown>
): string {
  const baseMessage = STUDENT_ERROR_MESSAGES[code];
  
  // 컨텍스트가 있으면 동적 메시지 생성
  if (context) {
    // 예: "학생 정보를 찾을 수 없습니다. (ID: 123)"
    if (context.studentId) {
      return `${baseMessage} (ID: ${context.studentId})`;
    }
    if (context.connectionCode) {
      return `${baseMessage} (코드: ${context.connectionCode})`;
    }
  }
  
  return baseMessage;
}

/**
 * 에러를 StudentError로 변환하는 헬퍼 함수
 */
export function toStudentError(
  error: unknown,
  defaultCode: StudentErrorCode = StudentErrorCodes.UNKNOWN_ERROR,
  context?: Record<string, unknown>
): StudentError {
  if (error instanceof StudentError) {
    return error;
  }

  if (error instanceof Error) {
    // 에러 메시지를 분석하여 적절한 에러 코드로 매핑
    let errorCode = defaultCode;
    let userMessage = getStudentErrorMessage(defaultCode, context);

    const errorMessage = error.message.toLowerCase();
    
    // 연결 코드 관련 에러 감지
    if (errorMessage.includes('연결 코드') || errorMessage.includes('connection code')) {
      if (errorMessage.includes('만료') || errorMessage.includes('expired')) {
        errorCode = StudentErrorCodes.CONNECTION_CODE_EXPIRED;
      } else if (errorMessage.includes('사용') || errorMessage.includes('used')) {
        errorCode = StudentErrorCodes.CONNECTION_CODE_ALREADY_USED;
      } else if (errorMessage.includes('유효') || errorMessage.includes('invalid')) {
        errorCode = StudentErrorCodes.CONNECTION_CODE_INVALID;
      } else {
        errorCode = StudentErrorCodes.CONNECTION_CODE_NOT_FOUND;
      }
      userMessage = getStudentErrorMessage(errorCode, context);
    }
    
    // 학생 조회 관련 에러 감지
    if (errorMessage.includes('학생') || errorMessage.includes('student')) {
      if (errorMessage.includes('찾을 수 없') || errorMessage.includes('not found')) {
        errorCode = StudentErrorCodes.STUDENT_NOT_FOUND;
        userMessage = getStudentErrorMessage(errorCode, context);
      }
    }
    
    // RLS 정책 위반 감지
    if (errorMessage.includes('rls') || errorMessage.includes('policy') || errorMessage.includes('권한')) {
      errorCode = StudentErrorCodes.RLS_POLICY_VIOLATION;
      userMessage = getStudentErrorMessage(errorCode, context);
    }
    
    // UNIQUE 제약 조건 위반 감지
    if (errorMessage.includes('unique') || errorMessage.includes('중복') || errorMessage.includes('이미 존재')) {
      errorCode = StudentErrorCodes.UNIQUE_VIOLATION;
      userMessage = getStudentErrorMessage(errorCode, context);
    }
    
    // 외래 키 제약 조건 위반 감지
    if (errorMessage.includes('foreign key') || errorMessage.includes('참조')) {
      errorCode = StudentErrorCodes.FOREIGN_KEY_VIOLATION;
      userMessage = getStudentErrorMessage(errorCode, context);
    }

    return new StudentError(
      error.message,
      errorCode,
      userMessage,
      false,
      { ...context, originalError: error.message }
    );
  }

  return new StudentError(
    String(error),
    defaultCode,
    getStudentErrorMessage(defaultCode, context),
    false,
    context
  );
}

/**
 * 복구 가능한 에러인지 확인하는 헬퍼 함수
 */
export function isRecoverableStudentError(error: unknown): boolean {
  if (error instanceof StudentError) {
    return error.recoverable;
  }
  return false;
}

