#!/usr/bin/env tsx
// ============================================
// AI×AI 시뮬레이션 스크립트
//
// 단일 모드:
//   npx tsx scripts/agent-simulation.ts [preset] [options]
//
// 교차 모드 (Gemini API ↔ Claude Code):
//   Phase 1: npx tsx scripts/agent-simulation.ts [preset] --mode=cross
//            → Gemini 실행 + Claude용 프롬프트를 .sim/claude-prompts.json 저장
//   Phase 2: Claude Code가 프롬프트 읽고 응답 → .sim/claude-responses.json 저장
//   Phase 3: npx tsx scripts/agent-simulation.ts [preset] --mode=compare
//            → Gemini가 Claude 응답 평가 + 비교표 출력
//
// 공통 옵션:
//   preset: basic | edge-cases | admission | interview | all (기본: basic)
//   --limit=N          최대 시나리오 수
//   --delay=N          요청 간 딜레이 ms (기본: 8000)
//   --dry-run          시나리오 목록만 출력
//   --tenant-id=UUID   테넌트 ID (결과 저장 시 필요)
// ============================================

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";
import { getScenarios } from "../lib/agents/simulation/scenario-generator";
import { runSimulationScenario, runCrossPhaseGemini, runCrossPhaseCompare, saveCrossBestCases } from "../lib/agents/simulation/runner";
import type {
  ScenarioPreset,
  SimulationResult,
  ClaudeResponseItem,
  CrossComparisonItem,
} from "../lib/agents/simulation/types";

const args = process.argv.slice(2);

const presetArg = args.find((a) => !a.startsWith("--")) as ScenarioPreset | undefined;
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const delayArg = args.find((a) => a.startsWith("--delay="))?.split("=")[1];
const tenantIdArg = args.find((a) => a.startsWith("--tenant-id="))?.split("=")[1];
const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "single";
const isDryRun = args.includes("--dry-run");

const preset: ScenarioPreset = presetArg ?? "basic";
const limit = parseInt(limitArg ?? "999", 10);
const delayMs = parseInt(delayArg ?? "8000", 10);
const tenantId = tenantIdArg ?? process.env.SIMULATION_TENANT_ID ?? null;

// 교차 시뮬레이션 파일 경로 (프리셋별 분리)
const SIM_DIR = path.resolve(process.cwd(), ".sim");
const GEMINI_RESULTS_PATH = path.join(SIM_DIR, `gemini-results-${preset}.json`);
const CLAUDE_PROMPTS_PATH = path.join(SIM_DIR, `claude-prompts-${preset}.json`);
const CLAUDE_RESPONSES_PATH = path.join(SIM_DIR, `claude-responses-${preset}.json`);
const COMPARISON_PATH = path.join(SIM_DIR, `comparison-${preset}.json`);

async function main() {
  const modeLabel = {
    single: "SINGLE (Gemini only)",
    cross: "CROSS Phase 1 (Gemini 실행 → Claude 프롬프트 저장)",
    compare: "CROSS Phase 3 (Gemini가 Claude 응답 평가 → 비교표)",
  }[modeArg] ?? "SINGLE";

  console.log(`\n🤖 AI×AI 시뮬레이션`);
  console.log(`   프리셋: ${preset}`);
  console.log(`   모드: ${modeLabel}`);
  console.log(`   딜레이: ${delayMs}ms`);
  if (modeArg === "single") {
    console.log(`   테넌트: ${tenantId ?? "(미지정 — 결과 저장 안 됨)"}`);
  }
  console.log(`   실행: ${isDryRun ? "DRY RUN" : "실행"}\n`);

  const scenarios = getScenarios(preset).slice(0, limit);
  console.log(`📋 시나리오: ${scenarios.length}건\n`);

  for (const s of scenarios) {
    const diff = { basic: "⚪", intermediate: "🟡", advanced: "🔴" }[s.difficulty];
    console.log(`  ${diff} ${s.id} | ${s.category} | ${s.studentProfile.grade}학년 ${s.studentProfile.schoolCategory} → ${s.studentProfile.targetMajor}`);
  }
  console.log("");

  if (isDryRun) {
    console.log("🏁 DRY RUN 완료.\n");
    process.exit(0);
  }

  switch (modeArg) {
    case "cross":
      await runCrossPhase1(scenarios);
      break;
    case "compare":
      await runCrossPhase3(scenarios);
      break;
    default:
      await runSingleMode(scenarios);
      break;
  }
}

// ── Single Mode (기존) ──

async function runSingleMode(scenarios: ReturnType<typeof getScenarios>) {
  if (!tenantId) {
    console.log("⚠️  --tenant-id 미지정: 결과를 DB에 저장하지 않습니다.\n");
  }

  const results: SimulationResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let totalScore = 0;
  let scoredCount = 0;
  let casesExtracted = 0;
  let correctionsGenerated = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const label = `[${i + 1}/${scenarios.length}]`;
    console.log(`${label} 실행 중: ${scenario.id} (${scenario.category})...`);

    const result = await runSimulationScenario(scenario, tenantId);
    results.push(result);

    if (result.success) {
      succeeded++;
      if (result.evaluation) {
        const overall = result.evaluation.scores.overall ?? 0;
        totalScore += overall;
        scoredCount++;
        if (overall >= 3.5) casesExtracted++;
        if (overall < 3.0) correctionsGenerated++;

        console.log(
          `${label} ✅ overall=${overall.toFixed(1)} | ` +
          `진단=${result.evaluation.scores.diagnosis_accuracy} ` +
          `전략=${result.evaluation.scores.strategy_realism} ` +
          `(${Math.round(result.durationMs / 1000)}초)`,
        );
      } else {
        console.log(`${label} ✅ 응답 생성됨 (평가 실패) | ${Math.round(result.durationMs / 1000)}초`);
      }
    } else {
      failed++;
      console.log(`${label} ❌ ${result.error}`);
    }

    if (i < scenarios.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  printSingleSummary(results, scenarios.length, succeeded, failed, totalScore, scoredCount, casesExtracted, correctionsGenerated);
  process.exit(failed > 0 ? 1 : 0);
}

// ── Cross Phase 1: Gemini 실행 + Claude 프롬프트 생성 ──

async function runCrossPhase1(scenarios: ReturnType<typeof getScenarios>) {
  console.log(`🔬 Phase 1: Gemini 3.1 Pro 실행 시작...\n`);

  const { geminiResults, claudePrompts } = await runCrossPhaseGemini(
    scenarios,
    delayMs,
    (i, total, scenarioId, result) => {
      const label = `[${i + 1}/${total}]`;
      if (result.success) {
        console.log(`${label} ✅ Gemini 응답 완료: ${scenarioId} (${Math.round(result.durationMs / 1000)}초)`);
      } else {
        console.log(`${label} ❌ Gemini 실패: ${scenarioId} — ${result.error}`);
      }
    },
  );

  // 파일 저장
  ensureSimDir();
  fs.writeFileSync(GEMINI_RESULTS_PATH, JSON.stringify(geminiResults, null, 2), "utf-8");
  fs.writeFileSync(CLAUDE_PROMPTS_PATH, JSON.stringify(claudePrompts, null, 2), "utf-8");

  const succeeded = geminiResults.filter((r) => r.success).length;
  const failed = geminiResults.filter((r) => !r.success).length;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ Phase 1 완료`);
  console.log(`${"═".repeat(60)}`);
  console.log(`   Gemini 성공: ${succeeded}건 | 실패: ${failed}건`);
  console.log(`   저장: ${GEMINI_RESULTS_PATH}`);
  console.log(`   저장: ${CLAUDE_PROMPTS_PATH}`);
  console.log(`\n📌 다음 단계 (Phase 2):`);
  console.log(`   Claude Code에서 다음 명령을 실행하세요:\n`);
  console.log(`   "시뮬레이션 Phase 2 진행해줘. .sim/claude-prompts.json 읽고 응답 생성해서 .sim/claude-responses.json에 저장해줘"\n`);
  console.log(`   Phase 2 완료 후 Phase 3:`);
  console.log(`   npx tsx scripts/agent-simulation.ts ${preset} --mode=compare${limit < 999 ? ` --limit=${limit}` : ""}`);
  console.log(`${"═".repeat(60)}\n`);
}

// ── Cross Phase 3: Gemini가 Claude 응답 평가 + 비교 ──

async function runCrossPhase3(scenarios: ReturnType<typeof getScenarios>) {
  // 파일 읽기
  if (!fs.existsSync(GEMINI_RESULTS_PATH)) {
    console.error("❌ .sim/gemini-results.json 없음. Phase 1을 먼저 실행하세요.");
    process.exit(1);
  }
  if (!fs.existsSync(CLAUDE_RESPONSES_PATH)) {
    console.error("❌ .sim/claude-responses.json 없음. Phase 2 (Claude Code)를 먼저 실행하세요.");
    process.exit(1);
  }

  const geminiResults: SimulationResult[] = JSON.parse(fs.readFileSync(GEMINI_RESULTS_PATH, "utf-8"));
  const claudeResponses: ClaudeResponseItem[] = JSON.parse(fs.readFileSync(CLAUDE_RESPONSES_PATH, "utf-8"));

  console.log(`🔬 Phase 3: Gemini가 Claude 응답 평가 시작...\n`);
  console.log(`   Gemini 결과: ${geminiResults.length}건`);
  console.log(`   Claude 응답: ${claudeResponses.length}건\n`);

  const comparisons = await runCrossPhaseCompare(
    scenarios,
    geminiResults,
    claudeResponses,
    delayMs,
    (i, total, scenarioId) => {
      console.log(`[${i + 1}/${total}] Gemini 평가 중: ${scenarioId}...`);
    },
  );

  // 비교 결과 저장
  fs.writeFileSync(COMPARISON_PATH, JSON.stringify(comparisons, null, 2), "utf-8");

  // 비교 테이블 출력
  printComparisonTable(comparisons);

  // 우수 응답 DB 저장
  if (tenantId) {
    console.log(`\n💾 우수 응답 DB 저장 중 (3.5점 이상)...`);
    const { saved, skipped } = await saveCrossBestCases(comparisons, scenarios, tenantId);
    console.log(`   저장: ${saved}건 | 건너뜀: ${skipped}건\n`);
  } else {
    const bestCount = comparisons.filter((c) => c.gemini.score >= 3.5 || c.claude.score >= 3.5).length;
    if (bestCount > 0) {
      console.log(`\n💡 우수 응답 ${bestCount}건 발견. --tenant-id 옵션으로 DB에 저장할 수 있습니다.\n`);
    }
  }
}

// ── 출력 포맷터 ──

function printSingleSummary(
  results: SimulationResult[],
  total: number,
  succeeded: number,
  failed: number,
  totalScore: number,
  scoredCount: number,
  casesExtracted: number,
  correctionsGenerated: number,
) {
  const avgScore = scoredCount > 0 ? totalScore / scoredCount : 0;

  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 시뮬레이션 결과 요약`);
  console.log(`${"═".repeat(50)}`);
  console.log(`   총 시나리오: ${total}건`);
  console.log(`   성공: ${succeeded}건 | 실패: ${failed}건`);
  console.log(`   평균 점수: ${avgScore.toFixed(2)} / 5.0`);
  console.log(`   케이스 추출: ${casesExtracted}건 (overall >= 3.5)`);
  console.log(`   교정 생성: ${correctionsGenerated}건 (overall < 3.0)`);
  console.log(`${"═".repeat(50)}\n`);

  if (scoredCount > 0) {
    const scores = results
      .filter((r) => r.evaluation?.scores.overall != null)
      .map((r) => r.evaluation!.scores.overall);

    const excellent = scores.filter((s) => s >= 4.0).length;
    const good = scores.filter((s) => s >= 3.0 && s < 4.0).length;
    const poor = scores.filter((s) => s < 3.0).length;

    console.log(`📈 점수 분포:`);
    console.log(`   우수 (4.0+): ${excellent}건 ${"█".repeat(excellent)}`);
    console.log(`   양호 (3.0-3.9): ${good}건 ${"█".repeat(good)}`);
    console.log(`   미흡 (<3.0): ${poor}건 ${"█".repeat(poor)}`);
    console.log("");
  }
}

function printComparisonTable(comparisons: CrossComparisonItem[]) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`📊 교차 시뮬레이션 A/B 비교 결과`);
  console.log(`   Gemini 응답 → Claude 평가 vs Claude 응답 → Gemini 평가`);
  console.log(`${"═".repeat(80)}`);

  // 헤더
  const hdr = [
    "시나리오".padEnd(12),
    "카테고리".padEnd(10),
    "Gemini(←Claude평가)".padStart(20),
    "Claude(←Gemini평가)".padStart(20),
    "차이".padStart(8),
    "승자".padStart(8),
  ].join(" │ ");
  console.log(hdr);
  console.log("─".repeat(80));

  let geminiTotal = 0;
  let claudeTotal = 0;
  let geminiWins = 0;
  let claudeWins = 0;
  let ties = 0;
  let scored = 0;

  for (const c of comparisons) {
    geminiTotal += c.gemini.score;
    claudeTotal += c.claude.score;
    if (c.winner === "gemini") geminiWins++;
    else if (c.winner === "claude") claudeWins++;
    else ties++;
    if (c.gemini.score > 0 || c.claude.score > 0) scored++;

    const delta = c.scoreDelta;
    const row = [
      c.scenarioId.padEnd(12),
      c.category.padEnd(10),
      c.gemini.score.toFixed(1).padStart(20),
      c.claude.score.toFixed(1).padStart(20),
      (delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)).padStart(8),
      (c.winner === "tie" ? "무승부" : c.winner === "gemini" ? "Gemini" : "Claude").padStart(8),
    ].join(" │ ");
    console.log(row);
  }

  console.log("─".repeat(80));

  const geminiAvg = scored > 0 ? geminiTotal / scored : 0;
  const claudeAvg = scored > 0 ? claudeTotal / scored : 0;

  console.log(`\n📈 종합 요약:`);
  console.log(`   Gemini 3.1 Pro 평균: ${geminiAvg.toFixed(2)} / 5.0`);
  console.log(`   Claude Code 평균:    ${claudeAvg.toFixed(2)} / 5.0`);
  console.log(`   Gemini 승: ${geminiWins}건 | Claude 승: ${claudeWins}건 | 무승부: ${ties}건`);
  console.log(`   총 시나리오: ${comparisons.length}건 (평가 완료: ${scored}건)`);

  const overallWinner =
    geminiAvg > claudeAvg + 0.2 ? "Gemini 3.1 Pro" :
    claudeAvg > geminiAvg + 0.2 ? "Claude Code" :
    "비슷한 수준";
  console.log(`\n   🏆 종합: ${overallWinner}`);

  // 카테고리별
  const categories = [...new Set(comparisons.map((c) => c.category))];
  if (categories.length > 1) {
    console.log(`\n📋 카테고리별 비교:`);
    for (const cat of categories) {
      const catItems = comparisons.filter((c) => c.category === cat);
      const catGemini = catItems.reduce((s, c) => s + c.gemini.score, 0) / catItems.length;
      const catClaude = catItems.reduce((s, c) => s + c.claude.score, 0) / catItems.length;
      const catWinner = catGemini > catClaude + 0.2 ? "← Gemini" : catClaude > catGemini + 0.2 ? "Claude →" : "≈";
      console.log(`   ${cat.padEnd(12)} | Gemini ${catGemini.toFixed(1)} vs Claude ${catClaude.toFixed(1)} ${catWinner}`);
    }
  }

  console.log(`\n   저장: ${COMPARISON_PATH}`);
  console.log(`${"═".repeat(80)}\n`);
}

function ensureSimDir() {
  if (!fs.existsSync(SIM_DIR)) {
    fs.mkdirSync(SIM_DIR, { recursive: true });
  }
}

main().catch((error) => {
  console.error("치명적 에러:", error);
  process.exit(1);
});
