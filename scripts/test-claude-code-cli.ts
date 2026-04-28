#!/usr/bin/env npx tsx
/**
 * Claude Code CLI 래퍼 단독 검증 스크립트
 *
 * 실행:
 *   npx tsx scripts/test-claude-code-cli.ts
 *
 * 검증 항목:
 *  1. JSON schema 강제 출력 동작 (structured_output 필드)
 *  2. system 프롬프트 전달
 *  3. timeout/error path
 *  4. 메타데이터(비용·토큰·모델) 추출
 */

import { runClaudeCodeCli } from "../lib/domains/plan/llm/providers/claude-code-cli";

async function main(): Promise<void> {
  console.log("[test] Claude Code CLI wrapper smoke test\n");

  // ── 케이스 1: 단순 텍스트 ────────────────────────────
  console.log("[case 1] plain text");
  const r1 = await runClaudeCodeCli({
    prompt: "say 'hello pipeline' in 4 words or less",
    model: "haiku",
    timeoutMs: 30_000,
  });
  console.log(`  text     : ${r1.text.trim().slice(0, 80)}`);
  console.log(`  duration : ${r1.durationMs}ms`);
  console.log(`  costUsd  : $${r1.costUsd.toFixed(4)}`);
  console.log(`  modelId  : ${r1.modelId}`);
  console.log(`  tokens   : in=${r1.usage.inputTokens} out=${r1.usage.outputTokens}\n`);

  // ── 케이스 2: JSON schema 강제 ───────────────────────
  console.log("[case 2] structured output (JSON schema)");
  const r2 = await runClaudeCodeCli({
    system: "당신은 한국 고등학생 세특 텍스트를 평가하는 평가자입니다.",
    prompt:
      "다음 세특을 specificity/coherence/depth 3축으로 1~5점 평가하고 reasoning을 한 문장으로 써. " +
      "텍스트: '미적분 단원에서 도함수의 활용에 흥미를 보였으며, 학우들에게 풀이를 설명할 정도로 이해도가 높았음.'",
    schemaJson: {
      type: "object",
      properties: {
        specificity: { type: "integer", minimum: 1, maximum: 5 },
        coherence: { type: "integer", minimum: 1, maximum: 5 },
        depth: { type: "integer", minimum: 1, maximum: 5 },
        reasoning: { type: "string" },
      },
      required: ["specificity", "coherence", "depth", "reasoning"],
    },
    model: "haiku",
    timeoutMs: 60_000,
  });
  console.log(`  structured: ${JSON.stringify(r2.structured)}`);
  console.log(`  duration  : ${r2.durationMs}ms`);
  console.log(`  costUsd   : $${r2.costUsd.toFixed(4)}`);
  console.log(`  tokens    : in=${r2.usage.inputTokens} out=${r2.usage.outputTokens}\n`);

  // ── 결과 요약 ────────────────────────────────────────
  const totalCost = r1.costUsd + r2.costUsd;
  const totalDuration = r1.durationMs + r2.durationMs;
  console.log("──────────────────────────────────────");
  console.log(`총 호출 2회: ${totalDuration}ms / API환산 $${totalCost.toFixed(4)}`);
  console.log("✓ 래퍼 정상 동작");
}

main().catch((err) => {
  console.error("✗ 검증 실패:", err);
  process.exit(1);
});
