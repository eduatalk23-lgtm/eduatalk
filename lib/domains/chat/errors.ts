/**
 * Chat Error Types
 *
 * 채팅 도메인에서 발생하는 다양한 오류 유형을 정의합니다.
 * 사용자에게 명확한 오류 메시지를 제공하기 위한 구조화된 에러 클래스입니다.
 */

/** 에러 카테고리 */
export type ChatErrorCategory =
  | "network"
  | "validation"
  | "permission"
  | "rate_limit"
  | "server"
  | "unknown";

/** 에러 코드 */
export type ChatErrorCode =
  // 네트워크 오류
  | "NETWORK_OFFLINE"
  | "NETWORK_TIMEOUT"
  | "NETWORK_ERROR"
  // 검증 오류
  | "VALIDATION_MESSAGE_TOO_LONG"
  | "VALIDATION_MESSAGE_EMPTY"
  | "VALIDATION_INVALID_CONTENT"
  // 권한 오류
  | "PERMISSION_LEFT_ROOM"
  | "PERMISSION_BLOCKED"
  | "PERMISSION_MUTED"
  | "PERMISSION_DENIED"
  // 속도 제한
  | "RATE_LIMIT_EXCEEDED"
  // 서버 오류
  | "SERVER_ERROR"
  | "SERVER_UNAVAILABLE"
  // 기타
  | "UNKNOWN";

/**
 * 구조화된 채팅 에러
 */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly category: ChatErrorCategory;
  readonly userMessage: string;
  readonly recoverable: boolean;
  readonly retryAfter?: number; // 밀리초 단위

  constructor(options: {
    code: ChatErrorCode;
    message?: string;
    userMessage?: string;
    retryAfter?: number;
  }) {
    const { code, message, userMessage, retryAfter } = options;
    super(message ?? getDefaultMessage(code));
    this.name = "ChatError";
    this.code = code;
    this.category = getCategory(code);
    this.userMessage = userMessage ?? getUserMessage(code);
    this.recoverable = isRecoverable(code);
    this.retryAfter = retryAfter;
  }

  /**
   * 일반 Error를 ChatError로 변환
   */
  static from(error: unknown): ChatError {
    if (error instanceof ChatError) {
      return error;
    }

    if (error instanceof Error) {
      // 네트워크 오류 감지
      if (isNetworkError(error)) {
        return new ChatError({ code: "NETWORK_ERROR" });
      }

      // 특정 에러 메시지 패턴 감지
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        return new ChatError({ code: "NETWORK_TIMEOUT" });
      }

      if (errorMessage.includes("offline") || errorMessage.includes("internet")) {
        return new ChatError({ code: "NETWORK_OFFLINE" });
      }

      if (errorMessage.includes("too long") || errorMessage.includes("character limit")) {
        return new ChatError({ code: "VALIDATION_MESSAGE_TOO_LONG" });
      }

      if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
        return new ChatError({
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: 10000, // 기본 10초
        });
      }

      if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
        return new ChatError({ code: "PERMISSION_DENIED" });
      }

      if (errorMessage.includes("left") || errorMessage.includes("나가")) {
        return new ChatError({ code: "PERMISSION_LEFT_ROOM" });
      }

      if (errorMessage.includes("blocked") || errorMessage.includes("차단")) {
        return new ChatError({ code: "PERMISSION_BLOCKED" });
      }

      if (errorMessage.includes("muted") || errorMessage.includes("음소거")) {
        return new ChatError({ code: "PERMISSION_MUTED" });
      }

      // 서버 오류 (5xx)
      if (
        errorMessage.includes("500") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("internal server")
      ) {
        return new ChatError({ code: "SERVER_ERROR" });
      }
    }

    // 알 수 없는 오류
    return new ChatError({
      code: "UNKNOWN",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 네트워크 오류인지 확인
 */
function isNetworkError(error: Error): boolean {
  const errorName = error.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();

  return (
    errorName === "typeerror" ||
    errorName === "networkerror" ||
    errorMessage.includes("failed to fetch") ||
    errorMessage.includes("network request failed") ||
    errorMessage.includes("load failed") ||
    errorMessage.includes("cors")
  );
}

/**
 * 에러 코드에서 카테고리 추출
 */
function getCategory(code: ChatErrorCode): ChatErrorCategory {
  if (code.startsWith("NETWORK_")) return "network";
  if (code.startsWith("VALIDATION_")) return "validation";
  if (code.startsWith("PERMISSION_")) return "permission";
  if (code.startsWith("RATE_LIMIT_")) return "rate_limit";
  if (code.startsWith("SERVER_")) return "server";
  return "unknown";
}

/**
 * 에러 코드에서 기본 메시지 추출
 */
function getDefaultMessage(code: ChatErrorCode): string {
  const messages: Record<ChatErrorCode, string> = {
    NETWORK_OFFLINE: "Device is offline",
    NETWORK_TIMEOUT: "Network request timed out",
    NETWORK_ERROR: "Network error occurred",
    VALIDATION_MESSAGE_TOO_LONG: "Message exceeds maximum length",
    VALIDATION_MESSAGE_EMPTY: "Message cannot be empty",
    VALIDATION_INVALID_CONTENT: "Message contains invalid content",
    PERMISSION_LEFT_ROOM: "User left the chat room",
    PERMISSION_BLOCKED: "User is blocked",
    PERMISSION_MUTED: "User is muted",
    PERMISSION_DENIED: "Permission denied",
    RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
    SERVER_ERROR: "Server error occurred",
    SERVER_UNAVAILABLE: "Server is unavailable",
    UNKNOWN: "An unknown error occurred",
  };
  return messages[code];
}

/**
 * 사용자에게 표시할 메시지
 */
function getUserMessage(code: ChatErrorCode): string {
  const messages: Record<ChatErrorCode, string> = {
    NETWORK_OFFLINE: "인터넷 연결이 끊겼습니다. 연결이 복구되면 자동으로 재시도됩니다.",
    NETWORK_TIMEOUT: "네트워크 응답이 느립니다. 잠시 후 자동으로 재시도됩니다.",
    NETWORK_ERROR: "인터넷 연결 문제가 발생했습니다. 자동으로 재시도됩니다.",
    VALIDATION_MESSAGE_TOO_LONG: "메시지가 너무 깁니다. (1000자 제한)",
    VALIDATION_MESSAGE_EMPTY: "메시지 내용을 입력해주세요.",
    VALIDATION_INVALID_CONTENT: "메시지에 허용되지 않는 내용이 포함되어 있습니다.",
    PERMISSION_LEFT_ROOM: "채팅방에서 나갔기 때문에 메시지를 보낼 수 없습니다.",
    PERMISSION_BLOCKED: "차단된 사용자에게 메시지를 보낼 수 없습니다.",
    PERMISSION_MUTED: "음소거 상태에서는 메시지를 보낼 수 없습니다.",
    PERMISSION_DENIED: "메시지를 보낼 권한이 없습니다.",
    RATE_LIMIT_EXCEEDED: "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.",
    SERVER_ERROR: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    SERVER_UNAVAILABLE: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
    UNKNOWN: "오류가 발생했습니다. 다시 시도해주세요.",
  };
  return messages[code];
}

/**
 * 복구 가능한 오류인지 확인
 */
function isRecoverable(code: ChatErrorCode): boolean {
  const nonRecoverable: ChatErrorCode[] = [
    "VALIDATION_MESSAGE_TOO_LONG",
    "VALIDATION_MESSAGE_EMPTY",
    "VALIDATION_INVALID_CONTENT",
    "PERMISSION_LEFT_ROOM",
    "PERMISSION_BLOCKED",
  ];
  return !nonRecoverable.includes(code);
}

/**
 * 카테고리별 아이콘 이름 (lucide-react)
 */
export const ERROR_CATEGORY_ICONS: Record<ChatErrorCategory, string> = {
  network: "WifiOff",
  validation: "AlertTriangle",
  permission: "Lock",
  rate_limit: "Timer",
  server: "Server",
  unknown: "AlertCircle",
};

/**
 * 에러 메시지 요약 (UI 표시용)
 */
export function getErrorSummary(error: ChatError): {
  title: string;
  description: string;
  canRetry: boolean;
} {
  switch (error.category) {
    case "network":
      return {
        title: "연결 문제",
        description: error.userMessage,
        canRetry: true,
      };
    case "validation":
      return {
        title: "입력 오류",
        description: error.userMessage,
        canRetry: false,
      };
    case "permission":
      return {
        title: "권한 오류",
        description: error.userMessage,
        canRetry: false,
      };
    case "rate_limit":
      return {
        title: "속도 제한",
        description: error.userMessage,
        canRetry: true,
      };
    case "server":
      return {
        title: "서버 오류",
        description: error.userMessage,
        canRetry: true,
      };
    default:
      return {
        title: "오류 발생",
        description: error.userMessage,
        canRetry: true,
      };
  }
}
