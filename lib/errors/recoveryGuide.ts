/**
 * P2 개선: 에러 복구 가이드 시스템
 *
 * 에러 발생 시 사용자에게 복구 방법을 제시합니다.
 */

import { ErrorCode } from "./handler";

/**
 * 복구 액션 타입
 */
export interface RecoveryAction {
  label: string;
  path?: string; // 이동할 경로 (있는 경우)
  description?: string;
}

/**
 * 사용자 친화적 에러 정보
 */
export interface UserFriendlyError {
  message: string;
  code: ErrorCode;
  recoveryActions?: RecoveryAction[];
  contactSupport?: boolean;
}

/**
 * 에러 코드별 복구 가이드 매핑
 */
const RECOVERY_GUIDES: Partial<Record<ErrorCode, RecoveryAction[]>> = {
  [ErrorCode.BUSINESS_LOGIC_ERROR]: [
    {
      label: "시간 블록 확인하기",
      path: "/settings/blocks",
      description: "학습 시간이 충분한지 확인해주세요.",
    },
    {
      label: "학원 일정 확인하기",
      path: "/settings/academy",
      description: "학원 일정과 겹치지 않는지 확인해주세요.",
    },
    {
      label: "제외일 확인하기",
      path: "/plan/new-group",
      description: "제외된 날짜가 너무 많지 않은지 확인해주세요.",
    },
  ],

  [ErrorCode.VALIDATION_ERROR]: [
    {
      label: "입력 내용 확인하기",
      description: "필수 입력 항목을 모두 작성했는지 확인해주세요.",
    },
  ],

  [ErrorCode.FORBIDDEN]: [
    {
      label: "로그인 다시 하기",
      path: "/login",
      description: "세션이 만료되었을 수 있습니다. 다시 로그인해주세요.",
    },
  ],

  [ErrorCode.NOT_FOUND]: [
    {
      label: "대시보드로 이동",
      path: "/dashboard",
      description: "요청한 데이터가 삭제되었거나 이동되었을 수 있습니다.",
    },
  ],

  [ErrorCode.DATABASE_ERROR]: [
    {
      label: "잠시 후 다시 시도",
      description: "일시적인 오류입니다. 잠시 후 다시 시도해주세요.",
    },
  ],

  [ErrorCode.EXTERNAL_SERVICE_ERROR]: [
    {
      label: "인터넷 연결 확인",
      description: "인터넷 연결 상태를 확인하고 다시 시도해주세요.",
    },
    {
      label: "페이지 새로고침",
      description: "페이지를 새로고침 후 다시 시도해주세요.",
    },
  ],

  [ErrorCode.INTERNAL_ERROR]: [
    {
      label: "지원팀에 문의",
      description: "문제가 계속되면 고객 지원팀에 문의해주세요.",
    },
  ],
};

/**
 * 에러 코드에 따른 복구 가이드 조회
 */
export function getRecoveryActions(errorCode: ErrorCode): RecoveryAction[] {
  return RECOVERY_GUIDES[errorCode] || [];
}

/**
 * 에러를 사용자 친화적 형식으로 변환
 */
export function toUserFriendlyError(
  error: Error | { message?: string; code?: ErrorCode },
  defaultCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): UserFriendlyError {
  const code =
    "code" in error && error.code ? (error.code as ErrorCode) : defaultCode;
  const message =
    error.message || "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
  const recoveryActions = getRecoveryActions(code);

  const contactSupport = [
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.DATABASE_ERROR,
  ].includes(code);

  return {
    message,
    code,
    recoveryActions: recoveryActions.length > 0 ? recoveryActions : undefined,
    contactSupport,
  };
}

/**
 * 플랜 생성 실패 시 상세 복구 가이드 생성
 */
export function getPlanGenerationRecoveryGuide(
  failureReason?: string
): RecoveryAction[] {
  const baseActions = RECOVERY_GUIDES[ErrorCode.BUSINESS_LOGIC_ERROR] || [];

  // 실패 원인에 따른 추가 가이드
  if (failureReason?.includes("블록") || failureReason?.includes("block")) {
    return [
      {
        label: "시간 블록 설정하기",
        path: "/settings/blocks",
        description:
          "학습 시간 블록이 설정되어 있는지 확인하고, 충분한 학습 시간이 있는지 확인해주세요.",
      },
      ...baseActions.filter((action: RecoveryAction) => !action.path?.includes("blocks")),
    ];
  }

  if (failureReason?.includes("학원") || failureReason?.includes("academy")) {
    return [
      {
        label: "학원 일정 조정하기",
        path: "/settings/academy",
        description:
          "학원 일정과 학습 시간이 겹치지 않도록 조정해주세요.",
      },
      ...baseActions.filter((action: RecoveryAction) => !action.path?.includes("academy")),
    ];
  }

  if (failureReason?.includes("제외") || failureReason?.includes("exclusion")) {
    return [
      {
        label: "제외일 줄이기",
        path: "/plan/new-group",
        description:
          "제외된 날짜가 너무 많으면 학습 일수가 부족할 수 있습니다.",
      },
      ...baseActions.filter((action: RecoveryAction) => !action.path?.includes("new-group")),
    ];
  }

  if (failureReason?.includes("콘텐츠") || failureReason?.includes("content")) {
    return [
      {
        label: "학습 콘텐츠 확인하기",
        path: "/contents",
        description:
          "선택한 학습 콘텐츠가 올바르게 설정되어 있는지 확인해주세요.",
      },
      ...baseActions,
    ];
  }

  return baseActions;
}

/**
 * 에러 상황에 맞는 안내 메시지 생성
 */
export function getRecoveryMessage(
  errorCode: ErrorCode,
  actions: RecoveryAction[]
): string {
  if (actions.length === 0) {
    return "문제가 계속되면 고객 지원팀에 문의해주세요.";
  }

  if (actions.length === 1) {
    return `${actions[0].description || actions[0].label}`;
  }

  const actionList = actions
    .map((a, i) => `${i + 1}. ${a.label}`)
    .join("\n");

  return `다음 방법을 시도해보세요:\n${actionList}`;
}
