/**
 * 위저드 클라이언트 사이드 로깅 유틸리티
 *
 * 개발 환경에서만 로그 출력
 * 일관된 형식으로 디버깅 정보 제공
 */

// 환경 변수로 디버그 모드 제어
const IS_DEBUG = process.env.NODE_ENV === "development";

// 로그 레벨
type LogLevel = "debug" | "info" | "warn" | "error";

// 로그 컨텍스트
type LogContext = {
  hook?: string;
  component?: string;
  action?: string;
  data?: Record<string, unknown>;
};

/**
 * 위저드 로거 클래스
 */
class WizardLogger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * 로그 포맷팅
   */
  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    const contextStr = context
      ? ` [${context.hook || context.component || context.action || ""}]`
      : "";
    return `[${timestamp}] [${this.prefix}]${contextStr} ${message}`;
  }

  /**
   * 디버그 로그 (개발 환경에서만)
   */
  debug(message: string, context?: LogContext): void {
    if (!IS_DEBUG) return;
    console.log(this.format("debug", message, context), context?.data ?? "");
  }

  /**
   * 정보 로그
   */
  info(message: string, context?: LogContext): void {
    if (!IS_DEBUG) return;
    console.info(this.format("info", message, context), context?.data ?? "");
  }

  /**
   * 경고 로그
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.format("warn", message, context), context?.data ?? "");
  }

  /**
   * 에러 로그
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(this.format("error", message, context), {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
      ...(context?.data ?? {}),
    });
  }

  /**
   * 성능 측정 시작
   */
  startTimer(label: string): () => void {
    if (!IS_DEBUG) return () => {};

    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} 완료 (${duration.toFixed(2)}ms)`);
    };
  }
}

// ============================================================================
// 사전 정의된 로거 인스턴스
// ============================================================================

/** 플랜 생성 관련 로거 */
export const planGeneratorLogger = new WizardLogger("PlanGenerator");

/** 자동 저장 관련 로거 */
export const autoSaveLogger = new WizardLogger("AutoSave");

/** 임시 저장 관련 로거 */
export const planDraftLogger = new WizardLogger("PlanDraft");

/** 제출 관련 로거 */
export const planSubmissionLogger = new WizardLogger("PlanSubmission");

/** 콘텐츠 선택 관련 로거 */
export const contentSelectionLogger = new WizardLogger("ContentSelection");

/** 검증 관련 로거 */
export const validationLogger = new WizardLogger("Validation");

/** 일반 위저드 로거 */
export const wizardLogger = new WizardLogger("Wizard");

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 커스텀 로거 생성
 */
export function createWizardLogger(prefix: string): WizardLogger {
  return new WizardLogger(prefix);
}

/**
 * 에러를 직렬화 가능한 객체로 변환
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { raw: String(error) };
    }
  }
  return { raw: String(error) };
}
