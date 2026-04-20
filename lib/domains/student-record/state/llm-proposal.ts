// ============================================
// α4 Proposal Engine — llm_v1 orchestrator (Sprint 3 scaffold, 2026-04-20)
//
// 책임:
//   1. rule_v1 를 먼저 실행해 seed 확보
//   2. record-analysis/llm 의 generateProposal 호출 (dynamic import — 순환 의존 회피)
//   3. LLM 성공 → LLM 결과 반환 (seed 는 로깅용만 사용)
//   4. LLM 실패 → rule_v1 seed 로 graceful fallback
//
// 호출자는 반드시 비용 예산·feature flag 검토 후 진입.
// ============================================

import { buildRuleProposal, type RuleProposalInput } from "./rule-proposal";
import type { ProposalItem } from "../types/proposal";

export interface LlmProposalResult {
  readonly items: readonly ProposalItem[];
  readonly engine: "llm_v1" | "rule_v1_fallback";
  readonly model: string | null;
  readonly costUsd: number | null;
  readonly elapsedMs: number;
  readonly error: string | null;
}

/**
 * llm_v1 엔진 진입점. 내부에서 dynamic import 로 record-analysis/llm 의 액션 호출.
 *
 * rule_v1 seed 주입 전략:
 *   - LLM 이 seed 를 보강·자연화 가능하도록 prompt input 에 전달
 *   - LLM 실패 시 seed 를 그대로 반환 (rule_v1_fallback)
 *
 * @param input buildRuleProposal 과 동일 입력 + 옵션
 * @param options.tierPreference 모델 tier 선호도
 */
export async function runLlmProposal(
  input: RuleProposalInput,
  options?: {
    readonly tierPreference?: "auto" | "standard_only" | "advanced_first";
    readonly maxItems?: 3 | 4 | 5;
  },
): Promise<LlmProposalResult> {
  const startMs = Date.now();
  const maxItems = options?.maxItems ?? 5;

  // 1) rule_v1 seed
  const ruleSeed = buildRuleProposal(input, { maxItems });

  // 2) LLM 호출 (dynamic import — student-record 가 record-analysis 를 정적 import 하지 않도록)
  try {
    const { generateProposal } = await import(
      "@/lib/domains/record-analysis/llm/actions/generateProposal"
    );
    const result = await generateProposal(
      {
        state: input.state,
        diff: input.diff,
        trigger: input.trigger,
        gap: input.gap,
        remainingSemesters: input.remainingSemesters,
        ruleSeedItems: ruleSeed,
      },
      options?.tierPreference ? { tierPreference: options.tierPreference } : undefined,
    );

    if (result.success) {
      return {
        items: result.data.items,
        engine: "llm_v1",
        model: result.modelName ?? null,
        // TODO(Sprint 3): aiUsageLogger 연결 후 정확한 cost 주입
        costUsd: null,
        elapsedMs: Date.now() - startMs,
        error: null,
      };
    }

    // LLM 실패 → rule_v1 seed 로 fallback
    return {
      items: ruleSeed,
      engine: "rule_v1_fallback",
      model: null,
      costUsd: 0,
      elapsedMs: Date.now() - startMs,
      error: result.error,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      items: ruleSeed,
      engine: "rule_v1_fallback",
      model: null,
      costUsd: 0,
      elapsedMs: Date.now() - startMs,
      error: msg,
    };
  }
}
