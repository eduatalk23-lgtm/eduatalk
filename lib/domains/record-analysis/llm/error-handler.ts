import { logActionError } from "@/lib/logging/actionLogger";

/**
 * LLM 액션의 catch 블록을 표준화한다.
 * 에러를 로깅하고 종류별 사용자 친화적 메시지를 반환한다.
 * 항상 실패 분기만 반환하므로 호출부의 제네릭 success 타입과 자유롭게 합성 가능.
 */
export function handleLlmActionError(
  error: unknown,
  actionLabel: string,
  logCtx: { domain: string; action: string },
): { success: false; error: string } {
  logActionError(logCtx, error);

  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
    return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
  }
  if (error instanceof SyntaxError || msg.includes("JSON")) {
    return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
  }

  return { success: false, error: `${actionLabel} 중 오류가 발생했습니다.` };
}
