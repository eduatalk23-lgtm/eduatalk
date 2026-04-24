// ============================================
// LLM 에러 분류 (retry / withExtendedRetry 공유)
//
// 단일 분류 규칙을 양쪽 재시도 래퍼가 참조하여 drift 방지.
//
// 카테고리:
//   rate_limit    — 429 / quota / resource_exhausted (재시도 가치 높음, 긴 백오프)
//   timeout       — timeout / deadline / ECONNRESET (재시도 가치 높음, 짧은 백오프)
//   server_error  — 5xx (재시도 가치 중간)
//   client_error  — 4xx non-429 / invalid (재시도 무의미, 즉시 throw)
//   unknown       — 위 어느 것도 아님 (기본 백오프)
// ============================================

export type LlmErrorCategory =
  | "rate_limit"
  | "timeout"
  | "server_error"
  | "client_error"
  | "unknown";

export function classifyLlmError(error: unknown): LlmErrorCategory {
  if (!(error instanceof Error)) return "unknown";

  const msg = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted")
  ) {
    return "rate_limit";
  }

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("deadline") ||
    name.includes("timeout") ||
    msg.includes("econnreset")
  ) {
    return "timeout";
  }

  if (
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("internal server error") ||
    msg.includes("service unavailable")
  ) {
    return "server_error";
  }

  if (
    msg.includes("400") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("invalid")
  ) {
    return "client_error";
  }

  return "unknown";
}

/**
 * 재시도 무의미 판정 (withExtendedRetry 용 단축 헬퍼).
 * `classifyLlmError(e) === "client_error"` 와 동등.
 */
export function isLlmClientError(error: unknown): boolean {
  return classifyLlmError(error) === "client_error";
}
