// ============================================
// Synthesis Task Cache Helper (M1-c W6, 2026-04-28)
//
// Synthesis 14 task 중 LLM 호출 비용 큰 task (ai_diagnosis, ai_strategy,
// interview_generation, roadmap_generation, tier_plan_refinement) 가 직전
// completed synthesis run 의 입력과 동일하면 LLM 호출을 생략하기 위한 헬퍼.
//
// 패턴:
//   1) runner 진입 시 모든 input section 을 모아 `computeSynthesisInputHash()` 로
//      stable djb2 hash 계산.
//   2) `ctx.belief.previousRunOutputs.taskResults[taskKey].inputHash` 와 비교.
//   3) 일치 + 재사용 가능한 결과(prev result) 가 있으면 LLM skip + prev result 그대로 반환.
//   4) miss 시 LLM 호출 후 result 에 `inputHash` 를 포함하여 다음 run 이 비교할 수 있게.
//
// 결정적 hash 보장:
//   - JSON.stringify 시 key 정렬(`stableStringify`) — Object key 순서 차이 흡수.
//   - 부동소수/날짜 같은 비결정적 필드는 호출자가 input 에 포함시키지 말 것.
// ============================================

import type { PreviousRunOutputs } from "../pipeline-types";

// djb2 8자리 hex (외부 의존성 0)
export function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// JSON.stringify 결정성 보장: object key 를 재귀적으로 정렬.
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/**
 * synthesis task input → 결정적 8자리 hex hash.
 *
 * 호출자 책임: input 에 LLM 응답에 영향을 주는 모든 필드를 포함시키되, 비결정적
 * 필드(now()/UUID/random) 는 제외.
 */
export function computeSynthesisInputHash(input: Record<string, unknown>): string {
  return djb2Hex(stableStringify(input));
}

/**
 * 직전 run 의 task result 에서 inputHash 를 추출 + 현재 hash 와 비교.
 *
 * 직전 result 가 객체이고 `inputHash` 필드가 있으며 일치하는 경우에만 prev result 반환.
 * 그렇지 않으면 null (caller 가 LLM 호출 진행).
 */
export function tryReusePreviousResult<TResult extends { inputHash?: string }>(
  prev: PreviousRunOutputs | undefined,
  taskKey: string,
  currentHash: string,
): TResult | null {
  if (!prev || !prev.runId) return null;
  const raw = prev.taskResults?.[taskKey];
  if (!raw || typeof raw !== "object") return null;
  const prevHash = (raw as { inputHash?: unknown }).inputHash;
  if (typeof prevHash !== "string" || prevHash !== currentHash) return null;
  return raw as TResult;
}
