#!/usr/bin/env npx tsx
/**
 * 생기부 품질 평가 회귀 스크립트
 *
 * 골든 데이터셋(20개 샘플)에 대해 Gemini를 호출하고
 * contentQuality 점수·이슈가 기댓값을 충족하는지 검증한다.
 *
 * 사용법:
 *   npx tsx scripts/eval-student-record.ts             # 전체 실행
 *   npx tsx scripts/eval-student-record.ts --dry-run   # 샘플 목록만 표시
 *   npx tsx scripts/eval-student-record.ts --id=setek-high-math  # 특정 샘플
 *   npx tsx scripts/eval-student-record.ts --fast      # flash 모델 (저비용)
 *
 * 환경 변수:
 *   GOOGLE_GENERATIVE_AI_API_KEY  (필수, .env.local에서 자동 로드)
 */

import { config } from "dotenv";
import path from "node:path";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
} from "../lib/domains/student-record/llm/prompts/competencyHighlight";
import { GOLDEN_DATASET, type EvalSample } from "../lib/domains/student-record/eval/golden-dataset";
import {
  verifyHighlights,
  aggregateVerification,
  extractAllHighlights,
  type AggregatedVerification,
} from "../lib/domains/student-record/eval/highlight-verifier";
import {
  analyzeTimeSeries,
  type TimeSeriesPoint,
  type TimeSeriesAnalysis,
} from "../lib/domains/student-record/eval/timeseries-analyzer";
import {
  matchUniversityProfiles,
  type UniversityMatchAnalysis,
} from "../lib/domains/student-record/eval/university-profile-matcher";
import {
  generateExecutiveSummary,
  formatExecutiveSummaryText,
} from "../lib/domains/student-record/eval/executive-summary";

// .env.local 자동 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── CLI 파싱 ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isFast = args.includes("--fast");
const targetId = args.find((a) => a.startsWith("--id="))?.split("=")[1];

const MODEL = isFast ? "gemini-2.5-flash" : "gemini-2.5-flash";
// 역량 분석은 advanced(pro)가 정확하나, 회귀 테스트는 flash로 충분
// pro 사용 시: "gemini-2.5-pro"

// ─── 이슈 코드 접두사 매칭 ───────────────────────────────────────────────

function issueMatches(issues: string[], codePrefix: string): boolean {
  return issues.some((issue) =>
    issue.toUpperCase().startsWith(codePrefix.toUpperCase()) ||
    issue.toUpperCase().includes(`_${codePrefix.toUpperCase()}`) ||
    issue.replace(/[^A-Z0-9]/gi, "").toUpperCase().startsWith(codePrefix.replace(/[^A-Z0-9]/gi, "").toUpperCase()),
  );
}

// ─── 기댓값 검증 ─────────────────────────────────────────────────────────

interface CheckResult {
  pass: boolean;
  reasons: string[];
}

function checkExpectation(sample: EvalSample, score: number, issues: string[]): CheckResult {
  const { expected } = sample;
  const reasons: string[] = [];
  let pass = true;

  if (expected.minScore != null && score < expected.minScore) {
    pass = false;
    reasons.push(`score ${score} < minScore ${expected.minScore}`);
  }
  if (expected.maxScore != null && score > expected.maxScore) {
    pass = false;
    reasons.push(`score ${score} > maxScore ${expected.maxScore}`);
  }
  for (const code of expected.mustHaveIssues ?? []) {
    if (!issueMatches(issues, code)) {
      pass = false;
      reasons.push(`이슈 '${code}' 미감지 (actual: [${issues.join(", ")}])`);
    }
  }
  for (const code of expected.mustNotHaveIssues ?? []) {
    if (issueMatches(issues, code)) {
      pass = false;
      reasons.push(`이슈 '${code}' 오감지 (actual: [${issues.join(", ")}])`);
    }
  }

  return { pass, reasons };
}

// ─── 단일 샘플 평가 ──────────────────────────────────────────────────────

interface EvalResult {
  sample: EvalSample;
  score: number | null;
  issues: string[];
  pass: boolean;
  reasons: string[];
  elapsedMs: number;
  /** A2: 하이라이트 원문 검증 집계 (LLM 응답에 sections가 있을 때만) */
  highlightVerification?: AggregatedVerification;
  error?: string;
}

async function evalSample(sample: EvalSample, googleClient: ReturnType<typeof createGoogleGenerativeAI>): Promise<EvalResult> {
  const start = Date.now();

  try {
    const userPrompt = buildHighlightUserPrompt({
      content: sample.content,
      recordType: sample.recordType,
      subjectName: sample.subjectName,
      grade: sample.grade,
    });

    const { text } = await generateText({
      model: googleClient(MODEL),
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
      maxTokens: 3000,
    });

    const result = parseHighlightResponse(text);
    const cq = result.contentQuality;

    // A2: 하이라이트 원문 검증
    const allHighlights = extractAllHighlights(result.sections);
    const highlightVerification =
      allHighlights.length > 0
        ? aggregateVerification(verifyHighlights(allHighlights, sample.content))
        : undefined;

    if (!cq) {
      return {
        sample,
        score: null,
        issues: [],
        pass: false,
        reasons: ["contentQuality 미반환 (LLM이 품질 점수를 생성하지 않음)"],
        elapsedMs: Date.now() - start,
        highlightVerification,
      };
    }

    const { pass, reasons } = checkExpectation(sample, cq.overallScore, cq.issues);

    return {
      sample,
      score: cq.overallScore,
      issues: cq.issues,
      pass,
      reasons,
      elapsedMs: Date.now() - start,
      highlightVerification,
    };
  } catch (err) {
    return {
      sample,
      score: null,
      issues: [],
      pass: false,
      reasons: [],
      elapsedMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── A3: 시계열 분석 모의 데이터 + 실행 ─────────────────────────────────

/**
 * 골든 데이터셋(grade 필드 포함)에서 역량 시계열 포인트를 추출한다.
 *
 * 각 샘플의 grade(1~3)와 recordType으로 역량 매핑:
 *   - setek       → academic_achievement
 *   - changche    → community_collaboration
 *   - haengteuk   → community_leadership
 *
 * TODO: 실 DB 연결 시 competency_repository.findCompetencyScores()로 교체.
 *       (studentId + schoolYear 단위로 전 역량 조회 가능)
 */
function buildTimeSeriesPointsFromDataset(samples: EvalSample[]): TimeSeriesPoint[] {
  const RECORD_TO_COMPETENCY: Record<string, { id: string; name: string }> = {
    setek: { id: "academic_achievement", name: "학업 성취" },
    changche: { id: "community_collaboration", name: "공동체 협력" },
    haengteuk: { id: "community_leadership", name: "공동체 리더십" },
  };

  const points: TimeSeriesPoint[] = [];

  for (const sample of samples) {
    if (!sample.grade || sample.grade < 1 || sample.grade > 3) continue;
    const competency = RECORD_TO_COMPETENCY[sample.recordType];
    if (!competency) continue;

    // 기댓값 점수를 모의 점수로 활용 (minScore/maxScore 중간값)
    const { minScore, maxScore } = sample.expected;
    let mockScore: number;
    if (minScore != null && maxScore != null) {
      mockScore = Math.round((minScore + maxScore) / 2);
    } else if (minScore != null) {
      mockScore = Math.round(minScore + 5);
    } else if (maxScore != null) {
      mockScore = Math.round(maxScore - 5);
    } else {
      mockScore = 60; // 기댓값 없으면 중간값 사용
    }

    points.push({
      gradeYear: sample.grade as 1 | 2 | 3,
      competencyId: competency.id,
      competencyName: competency.name,
      score: mockScore,
    });
  }

  return points;
}

function printTimeSeriesAnalysis(analysis: TimeSeriesAnalysis): void {
  console.log();
  console.log("─".repeat(64));
  console.log(" A3: 역량 시계열 분석 결과");
  console.log("─".repeat(64));
  console.log(` 요약: ${analysis.summary}`);
  console.log(` 전체 성장률: ${analysis.overallGrowthRate > 0 ? "+" : ""}${analysis.overallGrowthRate}점`);
  console.log(` 강점 역량: ${analysis.strongestCompetency}`);
  console.log(` 보완 역량: ${analysis.weakestCompetency}`);
  console.log(` 최대 성장: ${analysis.mostImprovedCompetency}`);

  if (analysis.anomalies.length > 0) {
    console.log(` \x1b[33m이상 감지 ${analysis.anomalies.length}개:\x1b[0m`);
    for (const anomaly of analysis.anomalies) {
      console.log(`   · ${anomaly.competencyName} — ${anomaly.anomalyReason ?? "이상"}`);
    }
  }

  console.log();
  console.log(" 역량별 추세:");
  for (const trend of analysis.trends) {
    const trendIcon =
      trend.trend === "rising" ? "\x1b[32m↑\x1b[0m" :
      trend.trend === "falling" ? "\x1b[31m↓\x1b[0m" :
      trend.trend === "stable" ? "\x1b[90m→\x1b[0m" :
      "\x1b[33m~\x1b[0m";
    const growthStr = trend.growthRate > 0
      ? `\x1b[32m+${trend.growthRate}\x1b[0m`
      : trend.growthRate < 0
        ? `\x1b[31m${trend.growthRate}\x1b[0m`
        : `${trend.growthRate}`;
    const scores = trend.points.map((p) => `${p.gradeYear}학년:${p.score}`).join(" → ");
    const anomalyMark = trend.isAnomaly ? " \x1b[33m[이상]\x1b[0m" : "";
    console.log(`   ${trendIcon} ${trend.competencyName.padEnd(14)} ${scores}  성장=${growthStr}${anomalyMark}`);
  }
}

// ─── B1: 대학 프로필 매칭 모의 데이터 + 출력 ────────────────────────────────

/**
 * 골든 데이터셋의 기댓값 점수를 역량 ID별로 집계하여 모의 역량 점수 맵을 생성한다.
 *
 * 같은 역량 ID에 복수 샘플이 있으면 평균값을 사용한다.
 * TODO: 실 DB 연결 시 competency_repository.findCompetencyScores()로 교체.
 */
function buildMockCompetencyScoresFromDataset(
  samples: EvalSample[],
): Record<string, number> {
  const RECORD_TO_COMPETENCY: Record<string, string> = {
    setek: "academic_inquiry",
    changche: "community_collaboration",
    haengteuk: "community_leadership",
  };

  const accumulator: Record<string, { sum: number; count: number }> = {};

  for (const sample of samples) {
    const competencyId = RECORD_TO_COMPETENCY[sample.recordType];
    if (!competencyId) continue;

    const { minScore, maxScore } = sample.expected;
    let mockScore: number;
    if (minScore != null && maxScore != null) {
      mockScore = Math.round((minScore + maxScore) / 2);
    } else if (minScore != null) {
      mockScore = Math.round(minScore + 5);
    } else if (maxScore != null) {
      mockScore = Math.round(maxScore - 5);
    } else {
      mockScore = 60;
    }

    if (!accumulator[competencyId]) {
      accumulator[competencyId] = { sum: 0, count: 0 };
    }
    accumulator[competencyId].sum += mockScore;
    accumulator[competencyId].count += 1;
  }

  const result: Record<string, number> = {};
  for (const [id, { sum, count }] of Object.entries(accumulator)) {
    result[id] = Math.round(sum / count);
  }
  return result;
}

function printUniversityMatchAnalysis(analysis: UniversityMatchAnalysis): void {
  console.log();
  console.log("─".repeat(64));
  console.log(" B1: 대학 프로필 매칭 결과");
  console.log("─".repeat(64));
  console.log(` 요약: ${analysis.summary}`);
  console.log();

  console.log(" 상위 3개 계열 상세:");
  const top3 = analysis.matches.slice(0, 3);
  for (const match of top3) {
    const gradeColor =
      match.grade === "S" ? "\x1b[35m" :
      match.grade === "A" ? "\x1b[32m" :
      match.grade === "B" ? "\x1b[36m" :
      match.grade === "C" ? "\x1b[33m" :
      "\x1b[31m";
    console.log(
      `   ${gradeColor}[${match.grade}]\x1b[0m ${match.label.padEnd(16)} ` +
      `점수=${match.matchScore}`,
    );
    console.log(`        강점: ${match.strengths.join(", ")}`);
    console.log(`        보완: ${match.gaps.join(", ")}`);
    console.log(`        추천: ${match.recommendation}`);
  }

  console.log();
  console.log(" 전체 트랙 점수:");
  for (const match of analysis.matches) {
    const bar = "█".repeat(Math.round(match.matchScore / 5));
    console.log(
      `   ${match.label.padEnd(16)} ${String(match.matchScore).padStart(5)}  ${bar}`,
    );
  }
}

// ─── 출력 헬퍼 ───────────────────────────────────────────────────────────

const PASS = "\x1b[32m✅ PASS\x1b[0m";
const FAIL = "\x1b[31m❌ FAIL\x1b[0m";

function formatExpected(sample: EvalSample): string {
  const parts: string[] = [];
  const { expected } = sample;
  if (expected.minScore != null) parts.push(`score≥${expected.minScore}`);
  if (expected.maxScore != null) parts.push(`score≤${expected.maxScore}`);
  if (expected.mustHaveIssues?.length) parts.push(`have:[${expected.mustHaveIssues.join(",")}]`);
  if (expected.mustNotHaveIssues?.length) parts.push(`no:[${expected.mustNotHaveIssues.join(",")}]`);
  return parts.join("  ");
}

// ─── 메인 ────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  const samples = targetId
    ? GOLDEN_DATASET.filter((s) => s.id === targetId)
    : GOLDEN_DATASET;

  if (samples.length === 0) {
    console.error(`샘플 '${targetId}'을 찾을 수 없습니다.`);
    console.error(`사용 가능한 ID: ${GOLDEN_DATASET.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  console.log("═".repeat(64));
  console.log(" 생기부 품질 평가 회귀 테스트");
  console.log(` 모델: ${MODEL}   샘플: ${samples.length}개${isDryRun ? "   [DRY RUN]" : ""}`);
  console.log("═".repeat(64));
  console.log();

  if (isDryRun) {
    samples.forEach((s, i) => {
      console.log(`[${i + 1}/${samples.length}] ${s.id}`);
      console.log(`  ${s.description}`);
      console.log(`  type=${s.recordType}  subject=${s.subjectName ?? "-"}  grade=${s.grade ?? "-"}`);
      console.log(`  기댓값: ${formatExpected(s)}`);
      console.log();
    });
    console.log("DRY RUN 완료. --dry-run 제거 후 실제 실행.");
    return;
  }

  if (!apiKey) {
    console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 없습니다.");
    console.error("   .env.local에 GOOGLE_GENERATIVE_AI_API_KEY=<키> 를 추가하세요.");
    process.exit(1);
  }

  const googleClient = createGoogleGenerativeAI({ apiKey });
  const results: EvalResult[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    process.stdout.write(`[${i + 1}/${samples.length}] ${sample.id} ... `);

    const result = await evalSample(sample, googleClient);
    results.push(result);

    if (result.error) {
      console.log(`\x1b[31m오류\x1b[0m — ${result.error}`);
    } else {
      const status = result.pass ? PASS : FAIL;
      const scoreStr = result.score != null ? `score=${result.score}` : "score=N/A";
      console.log(`${status}  ${scoreStr}  (${result.elapsedMs}ms)`);
      if (!result.pass) {
        for (const r of result.reasons) {
          console.log(`         → ${r}`);
        }
      }
      if (result.issues.length > 0) {
        console.log(`         issues: [${result.issues.join(", ")}]`);
      }
      if (result.highlightVerification) {
        const hv = result.highlightVerification;
        const hvStatus = hv.passRate >= 80 ? "\x1b[32m" : hv.passRate >= 50 ? "\x1b[33m" : "\x1b[31m";
        console.log(
          `         highlight: ${hvStatus}통과율 ${hv.passRate}%\x1b[0m  ` +
          `exact=${hv.exactMatchRate}%  fuzzy=${hv.fuzzyMatchRate}%  ` +
          `sim=${hv.avgSimilarity.toFixed(2)}  coverage=${hv.avgCoverage}%  (${hv.total}건)`,
        );
      }
    }

    // Gemini rate limit 보호: 샘플 사이 1.5초 대기
    if (i < samples.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // ─── 최종 결과 ───────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass && !r.error).length;
  const errored = results.filter((r) => !!r.error).length;
  const total = results.length;
  const rate = Math.round((passed / total) * 100);

  // A2: 전체 하이라이트 검증 집계
  const hvResults = results.flatMap((r) =>
    r.highlightVerification ? [r.highlightVerification] : [],
  );
  const hvTotalHighlights = hvResults.reduce((s, hv) => s + hv.total, 0);
  const hvTotalPassed = hvResults.reduce((s, hv) => s + hv.passed, 0);
  const hvOverallPassRate =
    hvTotalHighlights > 0 ? Math.round((hvTotalPassed / hvTotalHighlights) * 100) : null;
  const hvAvgSimilarity =
    hvResults.length > 0
      ? Math.round((hvResults.reduce((s, hv) => s + hv.avgSimilarity, 0) / hvResults.length) * 1000) / 1000
      : null;
  const hvAvgCoverage =
    hvResults.length > 0
      ? Math.round(hvResults.reduce((s, hv) => s + hv.avgCoverage, 0) / hvResults.length)
      : null;

  console.log();
  console.log("═".repeat(64));
  console.log(` 결과: ${passed}/${total} 통과 (${rate}%)   실패: ${failed}   오류: ${errored}`);
  if (hvOverallPassRate !== null) {
    const hvColor = hvOverallPassRate >= 80 ? "\x1b[32m" : hvOverallPassRate >= 50 ? "\x1b[33m" : "\x1b[31m";
    console.log(
      ` 하이라이트 검증: ${hvColor}통과율 ${hvOverallPassRate}%\x1b[0m` +
      `  평균 similarity=${hvAvgSimilarity?.toFixed(2)}` +
      `  평균 coverage=${hvAvgCoverage}%` +
      `  검증 하이라이트 ${hvTotalHighlights}건`,
    );
  }

  const failures = results.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log();
    console.log(" 실패 목록:");
    for (const r of failures) {
      const tag = r.error ? "[오류]" : "[실패]";
      console.log(`   ${tag} ${r.sample.id} — ${r.sample.description}`);
      if (r.error) {
        console.log(`         ${r.error}`);
      } else {
        for (const reason of r.reasons) {
          console.log(`         · ${reason}`);
        }
      }
    }
  }
  console.log("═".repeat(64));

  // ─── A3: 역량 시계열 분석 ────────────────────────────────────────────
  // TODO: 실 데이터 연결 시 buildTimeSeriesPointsFromDataset() 대신
  //       competency_repository.findCompetencyScores(studentId, schoolYear, tenantId)
  //       결과를 TimeSeriesPoint[]로 변환하여 analyzeTimeSeries()에 전달.
  const tsPoints = buildTimeSeriesPointsFromDataset(samples);
  if (tsPoints.length > 0) {
    const tsAnalysis = analyzeTimeSeries("golden-dataset-mock", tsPoints);
    printTimeSeriesAnalysis(tsAnalysis);
  } else {
    console.log();
    console.log(" A3: 시계열 분석 — grade 정보가 있는 샘플이 없어 건너뜀.");
  }

  // ─── B1: 대학 프로필 매칭 ────────────────────────────────────────────
  // 골든 데이터셋에서 추출한 모의 역량 점수로 대학 프로필 매칭을 시연한다.
  // TODO: 실 데이터 연결 시 competency_repository.findCompetencyScores()
  //       결과를 Record<string, number>로 변환하여 matchUniversityProfiles()에 전달.
  const mockCompetencyScores = buildMockCompetencyScoresFromDataset(samples);
  let universityAnalysis: UniversityMatchAnalysis | undefined;
  if (Object.keys(mockCompetencyScores).length > 0) {
    universityAnalysis = matchUniversityProfiles("golden-dataset-mock", mockCompetencyScores);
    printUniversityMatchAnalysis(universityAnalysis);
  } else {
    console.log();
    console.log(" B1: 대학 프로필 매칭 — 역량 점수 데이터가 없어 건너뜀.");
  }

  // ─── B3: Executive Summary 종합 ──────────────────────────────────────
  // A1(평가결과) + A2(하이라이트 검증) + A3(시계열) + B1(대학매칭) 통합 요약
  // 역량 스냅샷: 모의 역량 점수를 CompetencySnapshot 형태로 변환
  const COMPETENCY_LABEL_MAP: Record<string, string> = {
    academic_inquiry: "탐구력",
    community_collaboration: "협업과 소통능력",
    community_leadership: "리더십",
    academic_achievement: "학업성취도",
  };
  const competencySnapshots = Object.entries(mockCompetencyScores).map(([id, score]) => ({
    competencyId: id,
    competencyName: COMPETENCY_LABEL_MAP[id] ?? id,
    score,
  }));

  // A2 집계: 전체 샘플의 하이라이트 검증 집계 활용
  const hvAggregated =
    hvTotalHighlights > 0
      ? {
          passRate: hvOverallPassRate ?? 100,
          exactMatchRate: 0,
          fuzzyMatchRate: hvOverallPassRate ?? 100,
          avgSimilarity: hvAvgSimilarity ?? 0,
          avgCoverage: hvAvgCoverage ?? 0,
          total: hvTotalHighlights,
          passed: hvTotalPassed,
          failed: hvTotalHighlights - hvTotalPassed,
        }
      : undefined;

  // A3 결과
  const tsAnalysisResult = tsPoints.length > 0
    ? analyzeTimeSeries("golden-dataset-mock", tsPoints)
    : undefined;

  if (competencySnapshots.length > 0) {
    const executiveSummary = generateExecutiveSummary({
      studentId: "golden-dataset-mock",
      studentName: "골든 데이터셋 (모의)",
      competencySnapshots,
      highlightVerification: hvAggregated,
      timeSeriesAnalysis: tsAnalysisResult,
      universityMatch: universityAnalysis,
    });

    console.log();
    console.log(formatExecutiveSummaryText(executiveSummary));
  } else {
    console.log();
    console.log(" B3: Executive Summary — 역량 스냅샷 데이터가 없어 건너뜀.");
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("예상치 못한 오류:", err);
  process.exit(1);
});
