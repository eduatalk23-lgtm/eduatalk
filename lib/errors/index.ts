export {
  AppError,
  ErrorCode,
  getUserFacingMessage,
  logError,
  normalizeError,
  withErrorHandling,
  withErrorHandlingSafe,
  isErrorResult,
  type SerializableError,
  type ActionResult,
} from "./handler";

// P2 개선: 에러 복구 가이드
export {
  getRecoveryActions,
  toUserFriendlyError,
  getPlanGenerationRecoveryGuide,
  getRecoveryMessage,
  type RecoveryAction,
  type UserFriendlyError,
} from "./recoveryGuide";

