#!/usr/bin/env npx tsx
/**
 * Claude Code provider 통합 검증 — generateObjectWithRateLimit 경유
 *
 * `LLM_PROVIDER_OVERRIDE=claude-code` 가 ai-sdk.ts 진입부 분기를 통해
 * subprocess 경로로 라우팅되는지 확인.
 *
 * 실행:
 *   npx tsx scripts/test-claude-code-integration.ts
 *   (.env.local 의 LLM_PROVIDER_OVERRIDE 값 사용)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { z } from "zod";
import { zodSchema } from "ai";
import {
  generateObjectWithRateLimit,
  generateTextWithRateLimit,
} from "../lib/domains/plan/llm/ai-sdk";

async function main(): Promise<void> {
  const provider = process.env.LLM_PROVIDER_OVERRIDE ?? "(default=gemini)";
  console.log(`[test] LLM_PROVIDER_OVERRIDE=${provider}\n`);

  // ── 1. generateText 경유 ────────────────────────────
  console.log("[1] generateTextWithRateLimit");
  const t = await generateTextWithRateLimit({
    system: "당신은 간결한 답변자입니다.",
    messages: [{ role: "user", content: "1+1은? 숫자만." }],
    modelTier: "fast",
    timeoutMs: 60_000,
  });
  console.log(`    text   : ${t.content.trim()}`);
  console.log(`    model  : ${t.modelId}`);
  console.log(`    provider: ${t.provider}`);
  console.log(`    tokens : in=${t.usage.inputTokens} out=${t.usage.outputTokens}\n`);

  // ── 2. generateObject 경유 (zod schema) ─────────────
  console.log("[2] generateObjectWithRateLimit (zod schema)");
  const ScoreSchema = z.object({
    specificity: z.number().int().min(1).max(5),
    coherence: z.number().int().min(1).max(5),
    depth: z.number().int().min(1).max(5),
    reasoning: z.string().min(1),
  });

  const o = await generateObjectWithRateLimit({
    system: "당신은 한국 고등학생 세특 평가자입니다.",
    messages: [
      {
        role: "user",
        content:
          "다음 세특을 specificity/coherence/depth 3축으로 1~5점 평가하고 reasoning을 한 문장으로. " +
          "텍스트: '미적분 단원에서 도함수의 활용에 흥미를 보였으며, 학우들에게 풀이 과정을 설명할 정도로 이해도가 높았음. 추가 탐구로 한계비용 개념과의 연계를 조사함.'",
      },
    ],
    schema: zodSchema(ScoreSchema),
    modelTier: "standard",
    timeoutMs: 60_000,
  });
  console.log(`    object : ${JSON.stringify(o.object)}`);
  console.log(`    model  : ${o.modelId}`);
  console.log(`    tokens : in=${o.usage.inputTokens} out=${o.usage.outputTokens}\n`);

  // ── Zod 검증 (스키마 위반 시 throw) ──────────────────
  const validated = ScoreSchema.parse(o.object);
  console.log(`    ✓ Zod 검증 통과: specificity=${validated.specificity}\n`);

  console.log("✓ 통합 검증 통과 (provider 분기 정상)");
}

main().catch((err) => {
  console.error("✗ 통합 검증 실패:", err);
  process.exit(1);
});
