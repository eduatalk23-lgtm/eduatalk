#!/usr/bin/env npx tsx
/**
 * 교차표 생성 스크립트
 *
 * 두 모델 실행 로그(stdout)를 파싱해 샘플별 PASS/FAIL 4사분면 교차표를 생성.
 *
 * 용도:
 *   1. 둘 다 FAIL  → 라벨 오류 의심 (골든셋 misconfig 후보)
 *   2. high PASS, low FAIL → 프롬프트 보강 필요 (판단은 맞으나 지시 못 따름)
 *   3. high FAIL, low PASS → stochastic, 재측정
 *   4. 둘 다 PASS → 안정
 *
 * 사용법:
 *   npx tsx scripts/eval-cross-table.ts <high-log> <low-log>
 *   예: npx tsx scripts/eval-cross-table.ts /tmp/eval-week1-gpt5.4.log /tmp/eval-week1-gemini-2.5-pro.log
 *
 * 옵션:
 *   --high-label=<str>  고사양 모델 라벨 (기본: high)
 *   --low-label=<str>   저사양 모델 라벨 (기본: low)
 *   --output=<path>     마크다운 리포트 경로 (기본: stdout)
 */

import fs from "node:fs";
import path from "node:path";

interface SampleResult {
  id: string;
  pass: boolean;
  score: number | null;
  issues: string[];
  failReasons: string[];
}

function parseLog(logPath: string): Map<string, SampleResult> {
  const text = fs.readFileSync(logPath, "utf8");
  const results = new Map<string, SampleResult>();

  // ANSI color codes 제거
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = clean.split("\n");

  let currentId: string | null = null;
  let currentResult: SampleResult | null = null;

  const flush = () => {
    if (currentId && currentResult) {
      results.set(currentId, currentResult);
    }
  };

  for (const line of lines) {
    // [N/M] <sample-id>
    const idMatch = line.match(/^\[\d+\/\d+\]\s+(\S+)/);
    if (idMatch) {
      flush();
      currentId = idMatch[1];
      currentResult = { id: currentId, pass: false, score: null, issues: [], failReasons: [] };
      continue;
    }

    if (!currentResult) continue;

    // ✅ PASS / ❌ FAIL 라인
    const passMatch = line.match(/✅\s+PASS\s+score=(\d+)/);
    if (passMatch) {
      currentResult.pass = true;
      currentResult.score = parseInt(passMatch[1], 10);
      continue;
    }
    const failMatch = line.match(/❌\s+FAIL\s+score=(\d+|N\/A)/);
    if (failMatch) {
      currentResult.pass = false;
      currentResult.score = failMatch[1] === "N/A" ? null : parseInt(failMatch[1], 10);
      continue;
    }

    // → <reason>
    const reasonMatch = line.match(/→\s+(.+)$/);
    if (reasonMatch) {
      currentResult.failReasons.push(reasonMatch[1].trim());
      continue;
    }

    // issues: [a, b, c]
    const issuesMatch = line.match(/issues:\s+\[([^\]]*)\]/);
    if (issuesMatch) {
      currentResult.issues = issuesMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
  }
  flush();

  return results;
}

interface CrossRow {
  id: string;
  highPass: boolean;
  lowPass: boolean;
  highScore: number | null;
  lowScore: number | null;
  highIssues: string[];
  lowIssues: string[];
  highReasons: string[];
  lowReasons: string[];
  quadrant: "Q1_both_pass" | "Q2_high_only" | "Q3_low_only" | "Q4_both_fail";
}

function computeCrossTable(
  high: Map<string, SampleResult>,
  low: Map<string, SampleResult>,
): CrossRow[] {
  const allIds = new Set([...high.keys(), ...low.keys()]);
  const rows: CrossRow[] = [];

  for (const id of allIds) {
    const h = high.get(id);
    const l = low.get(id);
    if (!h || !l) continue; // 한 쪽에만 있는 샘플 스킵

    const hp = h.pass;
    const lp = l.pass;
    const quadrant = hp && lp
      ? "Q1_both_pass"
      : hp && !lp
        ? "Q2_high_only"
        : !hp && lp
          ? "Q3_low_only"
          : "Q4_both_fail";

    rows.push({
      id,
      highPass: hp,
      lowPass: lp,
      highScore: h.score,
      lowScore: l.score,
      highIssues: h.issues,
      lowIssues: l.issues,
      highReasons: h.failReasons,
      lowReasons: l.failReasons,
      quadrant,
    });
  }
  return rows;
}

function formatReport(
  rows: CrossRow[],
  highLabel: string,
  lowLabel: string,
): string {
  const byQ = {
    Q1_both_pass: rows.filter((r) => r.quadrant === "Q1_both_pass"),
    Q2_high_only: rows.filter((r) => r.quadrant === "Q2_high_only"),
    Q3_low_only: rows.filter((r) => r.quadrant === "Q3_low_only"),
    Q4_both_fail: rows.filter((r) => r.quadrant === "Q4_both_fail"),
  };

  const total = rows.length;
  const lines: string[] = [];

  lines.push(`# 교차표 리포트 — ${highLabel} (Oracle) vs ${lowLabel} (Target)`);
  lines.push("");
  lines.push(`총 샘플: ${total}`);
  lines.push("");

  lines.push("## 4사분면 요약");
  lines.push("");
  lines.push(`| 사분면 | 설명 | 샘플 수 | 비율 | 액션 |`);
  lines.push(`|--------|------|---------|------|------|`);
  lines.push(`| Q1 | 둘 다 PASS | ${byQ.Q1_both_pass.length} | ${pct(byQ.Q1_both_pass.length, total)} | ✅ 안정 |`);
  lines.push(`| Q2 | ${highLabel} PASS, ${lowLabel} FAIL | ${byQ.Q2_high_only.length} | ${pct(byQ.Q2_high_only.length, total)} | 🔧 **프롬프트 보강** |`);
  lines.push(`| Q3 | ${highLabel} FAIL, ${lowLabel} PASS | ${byQ.Q3_low_only.length} | ${pct(byQ.Q3_low_only.length, total)} | 🎲 stochastic 재측정 |`);
  lines.push(`| Q4 | 둘 다 FAIL | ${byQ.Q4_both_fail.length} | ${pct(byQ.Q4_both_fail.length, total)} | 🏷 **라벨 오류 의심** |`);
  lines.push("");

  // Pass rate
  const hPass = rows.filter((r) => r.highPass).length;
  const lPass = rows.filter((r) => r.lowPass).length;
  lines.push(`${highLabel} Pass rate: ${pct(hPass, total)} (${hPass}/${total})`);
  lines.push(`${lowLabel} Pass rate: ${pct(lPass, total)} (${lPass}/${total})`);
  lines.push("");

  // Q4 상세 (라벨 오류 의심)
  if (byQ.Q4_both_fail.length > 0) {
    lines.push("## 🏷 Q4: 라벨 오류 의심 (두 모델 모두 FAIL)");
    lines.push("");
    lines.push(`| ID | ${highLabel} | ${lowLabel} | 사유 |`);
    lines.push(`|----|----|----|------|`);
    for (const r of byQ.Q4_both_fail) {
      const reasons = [...r.highReasons, ...r.lowReasons].slice(0, 2).join(" / ");
      lines.push(`| ${r.id} | s=${r.highScore} | s=${r.lowScore} | ${reasons} |`);
    }
    lines.push("");
  }

  // Q2 상세 (프롬프트 보강)
  if (byQ.Q2_high_only.length > 0) {
    lines.push(`## 🔧 Q2: 프롬프트 보강 후보 (${highLabel} PASS, ${lowLabel} FAIL)`);
    lines.push("");
    lines.push(`| ID | ${highLabel} score | ${lowLabel} score | ${lowLabel} 실패 사유 |`);
    lines.push(`|----|-------|-------|-----------|`);
    for (const r of byQ.Q2_high_only) {
      lines.push(`| ${r.id} | ${r.highScore} | ${r.lowScore} | ${r.lowReasons.join(" / ")} |`);
    }
    lines.push("");
  }

  // Q3 상세 (stochastic)
  if (byQ.Q3_low_only.length > 0) {
    lines.push(`## 🎲 Q3: Stochastic 재측정 후보 (${highLabel} FAIL, ${lowLabel} PASS)`);
    lines.push("");
    lines.push(`| ID | ${highLabel} score | ${lowLabel} score | ${highLabel} 실패 사유 |`);
    lines.push(`|----|-------|-------|-----------|`);
    for (const r of byQ.Q3_low_only) {
      lines.push(`| ${r.id} | ${r.highScore} | ${r.lowScore} | ${r.highReasons.join(" / ")} |`);
    }
    lines.push("");
  }

  // 점수 분포 비교
  lines.push("## 점수 분포 비교");
  lines.push("");
  lines.push(`| ID | ${highLabel} | ${lowLabel} | Δ |`);
  lines.push(`|----|----|----|----|`);
  const sortedByDelta = [...rows]
    .filter((r) => r.highScore != null && r.lowScore != null)
    .sort((a, b) => Math.abs((b.highScore! - b.lowScore!)) - Math.abs((a.highScore! - a.lowScore!)));
  for (const r of sortedByDelta.slice(0, 15)) {
    const delta = r.highScore! - r.lowScore!;
    const sign = delta > 0 ? "+" : "";
    lines.push(`| ${r.id} | ${r.highScore} | ${r.lowScore} | ${sign}${delta} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const highLog = positional[0];
  const lowLog = positional[1];

  if (!highLog || !lowLog) {
    console.error("Usage: npx tsx scripts/eval-cross-table.ts <high-log> <low-log>");
    process.exit(1);
  }

  const highLabel = args.find((a) => a.startsWith("--high-label="))?.split("=")[1] ?? "high";
  const lowLabel = args.find((a) => a.startsWith("--low-label="))?.split("=")[1] ?? "low";
  const output = args.find((a) => a.startsWith("--output="))?.split("=")[1];

  const high = parseLog(highLog);
  const low = parseLog(lowLog);

  console.error(`Parsed ${high.size} samples from ${path.basename(highLog)}`);
  console.error(`Parsed ${low.size} samples from ${path.basename(lowLog)}`);

  const rows = computeCrossTable(high, low);
  const report = formatReport(rows, highLabel, lowLabel);

  if (output) {
    fs.writeFileSync(output, report);
    console.error(`Report written to ${output}`);
  } else {
    console.log(report);
  }
}

main();
