/**
 * F-4 smoke: Tier Routing 분류기 정확도·지연 측정.
 *
 * 사용: `npx tsx scripts/classifier-smoke.ts`
 * 옵션: `OLLAMA_CLASSIFIER_MODEL=gemma4:latest npx tsx scripts/classifier-smoke.ts`
 *
 * 9개 고정 샘플(L2 5 / L3 4)로 정답률 + 평균 latency 리포트.
 */

import { classifyTier, type Tier } from "@/lib/domains/ai-chat/routing/classifier";

type Sample = { input: string; expected: Tier };

const SAMPLES: Sample[] = [
  // L2
  { input: "김세린 2학년 성적 보여줘", expected: "L2" },
  { input: "성적 페이지로 이동", expected: "L2" },
  { input: "분석 어디까지 됐어?", expected: "L2" },
  { input: "@김세린 종합 프로필", expected: "L2" },
  { input: "오늘 날씨 어때", expected: "L2" },
  // L3
  { input: "김세린 자소서 초안 작성해줘", expected: "L3" },
  { input: "1학년 세특 10명 모두 생기부 리포트 만들어줘", expected: "L3" },
  { input: "현재 성적 기준으로 SKY 4개 대학 배분 시뮬레이션", expected: "L3" },
  { input: "진단+보완전략+3년 로드맵 자동 생성해줘", expected: "L3" },
];

async function main() {
  console.log(`[classifier-smoke] 시작 — ${SAMPLES.length}개 샘플\n`);

  const results: Array<{
    sample: Sample;
    tier: Tier;
    confidence: number;
    reason: string;
    latencyMs: number;
    correct: boolean;
    fallback: boolean;
  }> = [];

  for (const sample of SAMPLES) {
    const res = await classifyTier(sample.input);
    results.push({
      sample,
      tier: res.tier,
      confidence: res.confidence,
      reason: res.reason,
      latencyMs: res.latencyMs,
      correct: res.tier === sample.expected,
      fallback: res.fallback,
    });
    const mark = res.tier === sample.expected ? "✓" : "✗";
    const fb = res.fallback ? " [fallback]" : "";
    console.log(
      `${mark} ${res.tier} (exp ${sample.expected}) · ${res.latencyMs}ms · conf ${res.confidence.toFixed(2)}${fb}`,
    );
    console.log(`  input: ${sample.input}`);
    console.log(`  reason: ${res.reason}\n`);
  }

  const correct = results.filter((r) => r.correct).length;
  const avgLatency =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length;
  const fallbacks = results.filter((r) => r.fallback).length;

  console.log("─".repeat(60));
  console.log(
    `[classifier-smoke] 정답률: ${correct}/${SAMPLES.length} (${((correct / SAMPLES.length) * 100).toFixed(0)}%)`,
  );
  console.log(`[classifier-smoke] 평균 지연: ${avgLatency.toFixed(0)}ms`);
  if (fallbacks > 0) {
    console.log(`[classifier-smoke] fallback: ${fallbacks}건`);
  }

  // L2/L3 별 정확도
  const l2 = results.filter((r) => r.sample.expected === "L2");
  const l3 = results.filter((r) => r.sample.expected === "L3");
  console.log(
    `[classifier-smoke] L2 재현율: ${l2.filter((r) => r.correct).length}/${l2.length}`,
  );
  console.log(
    `[classifier-smoke] L3 재현율: ${l3.filter((r) => r.correct).length}/${l3.length}`,
  );

  if (correct < SAMPLES.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[classifier-smoke] ERROR:", e);
  process.exit(1);
});
