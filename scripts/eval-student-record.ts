#!/usr/bin/env npx tsx
/**
 * 생기부 품질 평가 회귀 스크립트
 *
 * 골든 데이터셋(20개 샘플)에 대해 Gemini를 호출하고
 * contentQuality 점수·이슈가 기댓값을 충족하는지 검증한다.
 *
 * 사용법:
 *   npx tsx scripts/eval-student-record.ts             # 전체 실행 (legacy flash)
 *   npx tsx scripts/eval-student-record.ts --dry-run   # 샘플 목록만 표시
 *   npx tsx scripts/eval-student-record.ts --id=setek-high-math  # 특정 샘플
 *   npx tsx scripts/eval-student-record.ts --fast      # flash 모델 (저비용)
 *   npx tsx scripts/eval-student-record.ts --ci        # CI 모드 (JSON 요약 출력)
 *   npx tsx scripts/eval-student-record.ts --ci --threshold=80  # 통과 기준 80%
 *
 * Stage 1 (측정 루프) 변형:
 *   --variant=legacy    # (기본) 인라인 flash 프롬프트. CI 비용 보존.
 *   --variant=mono      # 프로덕션 runMonolithicAnalysis (advanced/Pro)
 *   --variant=pipeline  # 프로덕션 runPipelineAnalysis (3-Step flash×3)
 *   --variant=both      # mono + pipeline 순차 실행 + side-by-side diff 리포트
 *
 * 환경 변수:
 *   GOOGLE_GENERATIVE_AI_API_KEY  (필수, .env.local에서 자동 로드)
 *
 * 모델 업그레이드 테스트 (eval 전용):
 *   LLM_MODEL_OVERRIDE=gemini-3.1-pro-preview  → Gemini 3.1 Pro (advanced tier에만 적용)
 *   LLM_MODEL_OVERRIDE=gpt-5.4                 → GPT-5.4
 *   LLM_GEMINI_THINKING_BUDGET=2048            → Gemini thinking MEDIUM 수준
 *   LLM_OPENAI_REASONING_EFFORT=low            → GPT-5.4 reasoning=low
 *
 * 예시:
 *   LLM_PROVIDER_OVERRIDE=openai LLM_MODEL_OVERRIDE=gpt-5.4 LLM_OPENAI_REASONING_EFFORT=low \
 *     npx tsx scripts/eval-student-record.ts --variant=mono --id=setek-high-math,...
 *   LLM_MODEL_OVERRIDE=gemini-3.1-pro-preview LLM_GEMINI_THINKING_BUDGET=2048 \
 *     npx tsx scripts/eval-student-record.ts --variant=mono --id=setek-high-math,...
 */

import { config } from "dotenv";
import path from "node:path";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
} from "../lib/domains/record-analysis/llm/prompts/competencyHighlight";
import { GOLDEN_DATASET, type EvalSample } from "../lib/domains/record-analysis/eval/golden-dataset";
import {
  verifyHighlights,
  aggregateVerification,
  extractAllHighlights,
  type AggregatedVerification,
} from "../lib/domains/record-analysis/eval/highlight-verifier";
import {
  analyzeTimeSeries,
  type TimeSeriesPoint,
  type TimeSeriesAnalysis,
} from "../lib/domains/record-analysis/eval/timeseries-analyzer";
import {
  matchUniversityProfiles,
  type UniversityMatchAnalysis,
} from "../lib/domains/record-analysis/eval/university-profile-matcher";
import {
  generateExecutiveSummary,
  formatExecutiveSummaryText,
} from "../lib/domains/record-analysis/eval/executive-summary";

// .env.local 자동 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── CLI 파싱 ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isFast = args.includes("--fast");
const isCi = args.includes("--ci");
const targetIdArg = args.find((a) => a.startsWith("--id="))?.split("=")[1];
const targetIds = targetIdArg ? targetIdArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
const threshold = Number(
  args.find((a) => a.startsWith("--threshold="))?.split("=")[1] ?? "70",
);

/**
 * Stage 1 (측정 루프): 실행 변형 선택
 *   - legacy   (default): 기존 인라인 flash 프롬프트 경로. CI 비용 보존.
 *   - mono     : 프로덕션 runMonolithicAnalysis (advanced/Pro 모델)
 *   - pipeline : 프로덕션 runPipelineAnalysis (3-Step flash×3)
 *   - both     : mono + pipeline 각 샘플에 병렬 실행 + side-by-side diff 리포트
 */
type Variant = "legacy" | "mono" | "pipeline" | "both" | "claude-cli";
const variantArg = args.find((a) => a.startsWith("--variant="))?.split("=")[1];
const VARIANT: Variant = ((): Variant => {
  if (!variantArg) return "legacy";
  if (
    variantArg === "mono" ||
    variantArg === "pipeline" ||
    variantArg === "both" ||
    variantArg === "legacy" ||
    variantArg === "claude-cli"
  ) {
    return variantArg;
  }
  console.error(
    `알 수 없는 --variant 값: ${variantArg}. 허용: legacy | mono | pipeline | both | claude-cli`,
  );
  process.exit(1);
})();
/** Claude Code CLI 모델 선택 (기본: sonnet). --claude-model=opus 등 */
const CLAUDE_MODEL =
  args.find((a) => a.startsWith("--claude-model="))?.split("=")[1] ?? "sonnet";

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

function checkExpectation(
  sample: EvalSample,
  score: number,
  issues: string[],
  competencyGrades?: { item: string; grade: string }[],
): CheckResult & { gradeHits?: number; gradeExpected?: number } {
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

  // Stage 1: 루브릭 등급 검증 (expectedGrades 있는 경우만)
  let gradeHits: number | undefined;
  let gradeExpected: number | undefined;
  if (expected.expectedGrades && competencyGrades) {
    gradeHits = 0;
    gradeExpected = Object.keys(expected.expectedGrades).length;
    for (const [item, expectedGrade] of Object.entries(expected.expectedGrades)) {
      const actual = competencyGrades.find((g) => g.item === item)?.grade;
      const allowed = Array.isArray(expectedGrade) ? expectedGrade : [expectedGrade];
      if (actual && allowed.includes(actual)) {
        gradeHits++;
      } else {
        pass = false;
        reasons.push(`등급 '${item}' 기대=${allowed.join("|")} actual=${actual ?? "없음"}`);
      }
    }
  }

  return { pass, reasons, gradeHits, gradeExpected };
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
  /** Stage 1 — 루브릭 등급 적중 */
  gradeHits?: number;
  gradeExpected?: number;
  /** Stage 1 — 프로덕션 경로 메트릭 (variant ≠ legacy) */
  prodMetrics?: import("../lib/domains/record-analysis/llm/types").AnalyzeRunMetrics;
  /** Stage 1 — 루브릭 등급 결과 (mono↔pipeline 일치율 계산용) */
  competencyGrades?: { item: string; grade: string }[];
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

    const grades = result.competencyGrades?.map((g) => ({ item: g.item, grade: g.grade }));
    const { pass, reasons, gradeHits, gradeExpected } = checkExpectation(
      sample,
      cq.overallScore,
      cq.issues,
      grades,
    );

    return {
      sample,
      score: cq.overallScore,
      issues: cq.issues,
      pass,
      reasons,
      elapsedMs: Date.now() - start,
      highlightVerification,
      gradeHits,
      gradeExpected,
      competencyGrades: grades,
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

// ─── Stage 1 (측정 루프): 프로덕션 경로 러너 ────────────────────────────

/**
 * 프로덕션 경로(runMonolithicAnalysis | runPipelineAnalysis)로 단일 샘플 평가.
 * legacy 경로(evalSample)와 동일한 EvalResult 스키마 + prodMetrics 추가.
 */
async function evalSampleProd(sample: EvalSample, variant: "mono" | "pipeline"): Promise<EvalResult> {
  const start = Date.now();
  try {
    const mod = await import("../lib/domains/record-analysis/llm/actions/analyzeWithHighlight");
    const runFn = variant === "mono" ? mod.runMonolithicAnalysis : mod.runPipelineAnalysis;

    const runResult = await runFn({
      content: sample.content,
      recordType: sample.recordType,
      subjectName: sample.subjectName,
      grade: sample.grade,
    });

    const result = runResult.data;
    const cq = result.contentQuality;

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
        reasons: [`contentQuality 미반환 (${variant} path=${runResult.metrics.path})`],
        elapsedMs: Date.now() - start,
        highlightVerification,
        prodMetrics: runResult.metrics,
      };
    }

    const grades = result.competencyGrades?.map((g) => ({ item: g.item, grade: g.grade }));
    const { pass, reasons, gradeHits, gradeExpected } = checkExpectation(
      sample,
      cq.overallScore,
      cq.issues,
      grades,
    );

    return {
      sample,
      score: cq.overallScore,
      issues: cq.issues,
      pass,
      reasons,
      elapsedMs: Date.now() - start,
      highlightVerification,
      gradeHits,
      gradeExpected,
      competencyGrades: grades,
      prodMetrics: runResult.metrics,
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

// ─── Claude Code CLI 러너 (크레딧 없이 구독 기반 시뮬레이션) ───────────
//
// 제약: --bare가 OAuth/keychain 접근을 차단해서 구독 인증 안 됨.
//        따라서 --tools "" --system-prompt <ours> --model sonnet 조합으로
//        CC 기본 프롬프트만 교체 + 도구 제거. 훅/스킬은 일부 남을 수 있음.
//        Temperature 명시 설정 불가 (CC 기본값).

async function evalSampleClaudeCli(sample: EvalSample): Promise<EvalResult> {
  const start = Date.now();
  try {
    const { HIGHLIGHT_SYSTEM_PROMPT, buildHighlightUserPrompt, parseHighlightResponse } =
      await import("../lib/domains/record-analysis/llm/prompts/competencyHighlight");
    const userPrompt = buildHighlightUserPrompt({
      content: sample.content,
      recordType: sample.recordType,
      subjectName: sample.subjectName,
      grade: sample.grade,
    });

    const { spawn } = await import("node:child_process");
    const text = await new Promise<string>((resolve, reject) => {
      const proc = spawn(
        "claude",
        [
          "-p",
          userPrompt,
          "--system-prompt",
          HIGHLIGHT_SYSTEM_PROMPT,
          "--tools",
          "",
          "--model",
          CLAUDE_MODEL,
          "--output-format",
          "text",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`claude CLI exit=${code} stdout=${stdout.slice(0, 300)} stderr=${stderr.slice(0, 300)}`));
      });
      // 5분 타임아웃 (Claude Code + 긴 프롬프트)
      setTimeout(() => { proc.kill("SIGTERM"); reject(new Error("claude CLI timeout 300s")); }, 300_000);
    });

    const result = parseHighlightResponse(text);
    const cq = result.contentQuality;

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
        reasons: [`contentQuality 미반환 (claude-cli model=${CLAUDE_MODEL})`],
        elapsedMs: Date.now() - start,
        highlightVerification,
      };
    }

    const grades = result.competencyGrades?.map((g) => ({ item: g.item, grade: g.grade }));
    const { pass, reasons, gradeHits, gradeExpected } = checkExpectation(
      sample,
      cq.overallScore,
      cq.issues,
      grades,
    );

    return {
      sample,
      score: cq.overallScore,
      issues: cq.issues,
      pass,
      reasons,
      elapsedMs: Date.now() - start,
      highlightVerification,
      gradeHits,
      gradeExpected,
      competencyGrades: grades,
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

// ─── Stage 1 (측정 루프): mono vs pipeline 비교 ──────────────────────────

interface DiffEntry {
  id: string;
  scoreMono: number | null;
  scorePipeline: number | null;
  scoreDelta: number | null;
  issuesJaccard: number | null;
  gradeAgreement: number | null;
  gradeAgreementCount?: number;
  tokenRatio: number | null;
  latencyRatio: number | null;
  stepAConfidence: number | null;
  fallbackReason?: string;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersect = 0;
  for (const x of setA) if (setB.has(x)) intersect++;
  const unionSize = setA.size + setB.size - intersect;
  return unionSize === 0 ? 1 : intersect / unionSize;
}

function computeGradeAgreement(
  mono?: { item: string; grade: string }[],
  pipe?: { item: string; grade: string }[],
): { rate: number | null; count: number } {
  if (!mono || !pipe || mono.length === 0 || pipe.length === 0) {
    return { rate: null, count: 0 };
  }
  const pipeMap = new Map(pipe.map((g) => [g.item, g.grade]));
  let hits = 0;
  let total = 0;
  for (const g of mono) {
    const other = pipeMap.get(g.item);
    if (other !== undefined) {
      total++;
      if (other === g.grade) hits++;
    }
  }
  return { rate: total === 0 ? null : hits / total, count: total };
}

function usageTotal(u?: { inputTokens: number; outputTokens: number }): number {
  return u ? u.inputTokens + u.outputTokens : 0;
}

function buildDiffEntry(mono: EvalResult, pipe: EvalResult): DiffEntry {
  const scoreDelta =
    mono.score != null && pipe.score != null ? pipe.score - mono.score : null;
  const issuesJaccard = jaccardSimilarity(mono.issues, pipe.issues);
  const gradeAg = computeGradeAgreement(mono.competencyGrades, pipe.competencyGrades);

  const monoTokens =
    usageTotal(mono.prodMetrics?.stepUsage?.monolithic) ||
    usageTotal(mono.prodMetrics?.stepUsage?.stepA) +
      usageTotal(mono.prodMetrics?.stepUsage?.stepB) +
      usageTotal(mono.prodMetrics?.stepUsage?.stepC);
  const pipeTokens =
    usageTotal(pipe.prodMetrics?.stepUsage?.stepA) +
    usageTotal(pipe.prodMetrics?.stepUsage?.stepB) +
    usageTotal(pipe.prodMetrics?.stepUsage?.stepC) +
    usageTotal(pipe.prodMetrics?.stepUsage?.monolithic);
  const tokenRatio = monoTokens > 0 ? pipeTokens / monoTokens : null;

  const latencyRatio =
    mono.elapsedMs > 0 ? pipe.elapsedMs / mono.elapsedMs : null;

  return {
    id: mono.sample.id,
    scoreMono: mono.score,
    scorePipeline: pipe.score,
    scoreDelta,
    issuesJaccard,
    gradeAgreement: gradeAg.rate,
    gradeAgreementCount: gradeAg.count,
    tokenRatio,
    latencyRatio,
    stepAConfidence: pipe.prodMetrics?.stepAConfidence ?? null,
    fallbackReason: pipe.prodMetrics?.fallbackReason,
  };
}

function printDiffSummary(entries: DiffEntry[]): void {
  if (entries.length === 0) return;
  const valid = entries.filter((e) => e.scoreMono != null && e.scorePipeline != null);
  const avg = (xs: number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const scoreDeltas = valid.map((e) => e.scoreDelta!).filter((x): x is number => x != null);
  const jaccards = valid.map((e) => e.issuesJaccard!).filter((x): x is number => x != null);
  const gradeAgs = valid
    .map((e) => e.gradeAgreement)
    .filter((x): x is number => x != null);
  const tokenRatios = valid
    .map((e) => e.tokenRatio)
    .filter((x): x is number => x != null);
  const latencyRatios = valid
    .map((e) => e.latencyRatio)
    .filter((x): x is number => x != null);
  const confidences = valid
    .map((e) => e.stepAConfidence)
    .filter((x): x is number => x != null);
  const fallbacks = valid.filter((e) => !!e.fallbackReason).length;

  console.log();
  console.log("═".repeat(64));
  console.log(" Stage 1: mono vs pipeline 비교 (side-by-side)");
  console.log("═".repeat(64));
  console.log(` 샘플 수: ${valid.length}/${entries.length}`);
  console.log(` overallScore Δ (pipe-mono): 평균 ${avg(scoreDeltas).toFixed(2)}, ` +
    `범위 [${Math.min(...scoreDeltas).toFixed(1)}, ${Math.max(...scoreDeltas).toFixed(1)}]`);
  console.log(` issues Jaccard:        평균 ${avg(jaccards).toFixed(3)}`);
  if (gradeAgs.length > 0) {
    console.log(` 등급 일치율:            평균 ${(avg(gradeAgs) * 100).toFixed(1)}%  (${gradeAgs.length}건 측정)`);
  }
  if (tokenRatios.length > 0) {
    console.log(` 토큰 비율 (pipe/mono): 평균 ${avg(tokenRatios).toFixed(2)}x`);
  }
  if (latencyRatios.length > 0) {
    console.log(` 지연 비율 (pipe/mono): 평균 ${avg(latencyRatios).toFixed(2)}x`);
  }
  if (confidences.length > 0) {
    console.log(` stepA confidence:      평균 ${avg(confidences).toFixed(3)}, ` +
      `범위 [${Math.min(...confidences).toFixed(2)}, ${Math.max(...confidences).toFixed(2)}]`);
  }
  console.log(` monolithic fallback:   ${fallbacks}건 / ${valid.length}건`);

  // 등급 불일치 상위 케이스
  const gradeMisses = valid
    .filter((e) => e.gradeAgreement != null && e.gradeAgreement < 1)
    .sort((a, b) => (a.gradeAgreement ?? 1) - (b.gradeAgreement ?? 1))
    .slice(0, 5);
  if (gradeMisses.length > 0) {
    console.log();
    console.log(" 등급 불일치 상위 5건:");
    for (const e of gradeMisses) {
      console.log(`   ${e.id.padEnd(32)} 일치율 ${((e.gradeAgreement ?? 0) * 100).toFixed(0)}%  Δscore=${e.scoreDelta}`);
    }
  }
  console.log();
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

  const samples = targetIds
    ? GOLDEN_DATASET.filter((s) => targetIds.includes(s.id))
    : GOLDEN_DATASET;

  if (samples.length === 0) {
    console.error(`샘플 '${targetIds?.join(",") ?? ""}'을 찾을 수 없습니다.`);
    console.error(`사용 가능한 ID: ${GOLDEN_DATASET.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }

  const modelOverride = process.env.LLM_MODEL_OVERRIDE;
  const providerOverride = process.env.LLM_PROVIDER_OVERRIDE;
  const thinkingBudget = process.env.LLM_GEMINI_THINKING_BUDGET;
  const reasoningEffort = process.env.LLM_OPENAI_REASONING_EFFORT;

  console.log("═".repeat(64));
  console.log(" 생기부 품질 평가 회귀 테스트");
  console.log(` 모델: ${MODEL}   variant: ${VARIANT}   샘플: ${samples.length}개${isDryRun ? "   [DRY RUN]" : ""}`);
  if (providerOverride) console.log(` provider: ${providerOverride}`);
  if (modelOverride) console.log(` model override: ${modelOverride}`);
  if (thinkingBudget) console.log(` gemini thinking budget: ${thinkingBudget}`);
  if (reasoningEffort) console.log(` openai reasoning effort: ${reasoningEffort}`);
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

  // claude-cli variant는 Claude Code subprocess만 사용하므로 Google API key 불필요
  if (!apiKey && VARIANT !== "claude-cli") {
    console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 없습니다.");
    console.error("   .env.local에 GOOGLE_GENERATIVE_AI_API_KEY=<키> 를 추가하세요.");
    process.exit(1);
  }

  const googleClient = apiKey
    ? createGoogleGenerativeAI({ apiKey })
    : (createGoogleGenerativeAI({ apiKey: "dummy-for-claude-cli-variant" }));
  const results: EvalResult[] = [];
  // Stage 1: --variant=both 시 두 결과를 샘플별로 보관해 side-by-side diff 계산
  const monoResults: EvalResult[] = [];
  const pipelineResults: EvalResult[] = [];

  const runOne = async (
    sample: EvalSample,
    mode: Variant,
  ): Promise<EvalResult> => {
    if (mode === "legacy") return evalSample(sample, googleClient);
    if (mode === "mono") return evalSampleProd(sample, "mono");
    if (mode === "pipeline") return evalSampleProd(sample, "pipeline");
    if (mode === "claude-cli") return evalSampleClaudeCli(sample);
    // "both"는 여기 들어오지 않음 (메인 루프에서 분기)
    throw new Error(`runOne: unexpected mode ${mode}`);
  };

  const printResult = (tag: string, result: EvalResult): void => {
    if (result.error) {
      console.log(`${tag} \x1b[31m오류\x1b[0m — ${result.error}`);
      return;
    }
    const status = result.pass ? PASS : FAIL;
    const scoreStr = result.score != null ? `score=${result.score}` : "score=N/A";
    const gradeStr =
      result.gradeHits != null && result.gradeExpected != null
        ? ` grade=${result.gradeHits}/${result.gradeExpected}`
        : "";
    const pathStr = result.prodMetrics ? ` path=${result.prodMetrics.path}` : "";
    const confStr =
      result.prodMetrics?.stepAConfidence != null
        ? ` conf=${result.prodMetrics.stepAConfidence.toFixed(2)}`
        : "";
    console.log(`${tag} ${status}  ${scoreStr}${gradeStr}${pathStr}${confStr}  (${result.elapsedMs}ms)`);
    if (!result.pass) {
      for (const r of result.reasons) {
        console.log(`${" ".repeat(tag.length)}          → ${r}`);
      }
    }
    if (result.issues.length > 0) {
      console.log(`${" ".repeat(tag.length)}          issues: [${result.issues.join(", ")}]`);
    }
    if (result.highlightVerification) {
      const hv = result.highlightVerification;
      const hvStatus = hv.passRate >= 80 ? "\x1b[32m" : hv.passRate >= 50 ? "\x1b[33m" : "\x1b[31m";
      console.log(
        `${" ".repeat(tag.length)}          highlight: ${hvStatus}통과율 ${hv.passRate}%\x1b[0m  ` +
        `exact=${hv.exactMatchRate}%  fuzzy=${hv.fuzzyMatchRate}%  ` +
        `sim=${hv.avgSimilarity.toFixed(2)}  coverage=${hv.avgCoverage}%  (${hv.total}건)`,
      );
    }
  };

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    process.stdout.write(`[${i + 1}/${samples.length}] ${sample.id}\n`);

    if (VARIANT === "both") {
      const r1 = await evalSampleProd(sample, "mono");
      // rate limit 보호: mono/pipeline 사이에도 짧은 지연
      await new Promise((r) => setTimeout(r, 1500));
      const r2 = await evalSampleProd(sample, "pipeline");
      monoResults.push(r1);
      pipelineResults.push(r2);
      printResult("  [mono]    ", r1);
      printResult("  [pipeline]", r2);
      // pass 판정은 pipeline 기준(프로덕션 현재 기본)
      results.push(r2);
    } else {
      const result = await runOne(sample, VARIANT);
      results.push(result);
      printResult("  ", result);
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

  // ─── Stage 1 (both 모드): mono vs pipeline side-by-side diff ──────────
  let diffEntries: DiffEntry[] = [];
  if (VARIANT === "both" && monoResults.length > 0 && pipelineResults.length === monoResults.length) {
    diffEntries = monoResults.map((m, i) => buildDiffEntry(m, pipelineResults[i]));
    printDiffSummary(diffEntries);
  }

  // ─── CI 모드: JSON 요약 출력 + threshold 기반 종료 ─────────────────────
  if (isCi) {
    const ciSummary: Record<string, unknown> = {
      model: MODEL,
      variant: VARIANT,
      total,
      passed,
      failed,
      errored,
      passRate: rate,
      threshold,
      thresholdMet: rate >= threshold,
      highlight: hvOverallPassRate !== null
        ? { passRate: hvOverallPassRate, avgSimilarity: hvAvgSimilarity, avgCoverage: hvAvgCoverage, total: hvTotalHighlights }
        : null,
      failures: failures.map((r) => ({
        id: r.sample.id,
        description: r.sample.description,
        score: r.score,
        error: r.error ?? null,
        reasons: r.reasons,
      })),
    };

    if (VARIANT === "both" && diffEntries.length > 0) {
      const valid = diffEntries.filter((e) => e.scoreMono != null && e.scorePipeline != null);
      const avg = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
      const scoreDeltas = valid.map((e) => e.scoreDelta!).filter((x): x is number => x != null);
      const jaccards = valid.map((e) => e.issuesJaccard!).filter((x): x is number => x != null);
      const gradeAgs = valid.map((e) => e.gradeAgreement).filter((x): x is number => x != null);
      const tokenRatios = valid.map((e) => e.tokenRatio).filter((x): x is number => x != null);
      const latencyRatios = valid.map((e) => e.latencyRatio).filter((x): x is number => x != null);
      const confidences = valid.map((e) => e.stepAConfidence).filter((x): x is number => x != null);
      ciSummary.diff = {
        samples: valid.length,
        scoreDeltaAvg: Math.round(avg(scoreDeltas) * 100) / 100,
        issuesJaccardAvg: Math.round(avg(jaccards) * 1000) / 1000,
        gradeAgreementAvg: gradeAgs.length > 0 ? Math.round(avg(gradeAgs) * 1000) / 1000 : null,
        tokenRatioAvg: tokenRatios.length > 0 ? Math.round(avg(tokenRatios) * 100) / 100 : null,
        latencyRatioAvg: latencyRatios.length > 0 ? Math.round(avg(latencyRatios) * 100) / 100 : null,
        stepAConfidenceAvg: confidences.length > 0 ? Math.round(avg(confidences) * 1000) / 1000 : null,
        fallbackCount: valid.filter((e) => !!e.fallbackReason).length,
      };
      ciSummary.diffEntries = diffEntries;
    }

    const fs = await import("node:fs");
    fs.writeFileSync("eval-results.json", JSON.stringify(ciSummary, null, 2));
    console.log();
    console.log(`CI 요약 → eval-results.json (variant=${VARIANT}, threshold=${threshold}%, actual=${rate}%)`);

    process.exit(rate >= threshold ? 0 : 1);
  }

  // ─── A3: 역량 시계열 분석 (수동 실행 전용) ────────────────────────────
  const tsPoints = buildTimeSeriesPointsFromDataset(samples);
  if (tsPoints.length > 0) {
    const tsAnalysis = analyzeTimeSeries("golden-dataset-mock", tsPoints);
    printTimeSeriesAnalysis(tsAnalysis);
  } else {
    console.log();
    console.log(" A3: 시계열 분석 — grade 정보가 있는 샘플이 없어 건너뜀.");
  }

  // ─── B1: 대학 프로필 매칭 (수동 실행 전용) ────────────────────────────
  const mockCompetencyScores = buildMockCompetencyScoresFromDataset(samples);
  let universityAnalysis: UniversityMatchAnalysis | undefined;
  if (Object.keys(mockCompetencyScores).length > 0) {
    universityAnalysis = matchUniversityProfiles("golden-dataset-mock", mockCompetencyScores);
    printUniversityMatchAnalysis(universityAnalysis);
  } else {
    console.log();
    console.log(" B1: 대학 프로필 매칭 — 역량 점수 데이터가 없어 건너뜀.");
  }

  // ─── B3: Executive Summary 종합 (수동 실행 전용) ──────────────────────
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
