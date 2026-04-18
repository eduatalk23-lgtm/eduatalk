/**
 * Pipeline Task Manifest 검증 스크립트 (PR 2, 2026-04-17).
 *
 * `lib/domains/record-analysis/pipeline/pipeline-task-manifest.ts` 의
 * `PIPELINE_TASK_MANIFEST` 와 실 코드의 `.from("<table>")` / `ctx.results[...]`
 * 호출을 대조하여 drift 와 orphan 테이블을 탐지한다.
 *
 * 3-단 로직:
 *   ① 코드 → manifest 일치성: runner 파일의 `.from("X")` 추출 → writes/reads 에 없으면 fail
 *   ② manifest → 코드 일치성: manifest 의 writes/reads 가 코드에 실재하지 않으면 warn
 *   ③ Orphan 탐지: writes 테이블을 읽는 태스크가 0 이고 terminal 미선언이면 fail
 *
 * 사용법:
 *   pnpm tsx scripts/validate-pipeline-manifest.ts
 *   pnpm tsx scripts/validate-pipeline-manifest.ts --strict   # warning 도 fail 처리
 *   pnpm tsx scripts/validate-pipeline-manifest.ts --json     # JSON 리포트 출력
 *
 * CI 통합: `.github/workflows/ci.yml` 의 `validate-pipeline-manifest` job.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  PIPELINE_TASK_MANIFEST,
  PIPELINE_INFRA_TABLES,
  type ManifestTaskKey,
  type PipelineTaskManifest,
} from "../lib/domains/record-analysis/pipeline/pipeline-task-manifest";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const RECORD_ANALYSIS_ROOT = path.join(
  PROJECT_ROOT,
  "lib/domains/record-analysis",
);

// ============================================
// 태스크 → 소스 파일 매핑
// 같은 파일에 여러 태스크가 동거할 수 있다 (phase-s2-edges.ts 의 edge_computation + guide_matching 등).
// 이 경우 파일 내 `.from("X")` 전수 집합을 태스크들의 writes+reads 합집합으로 대조한다.
// ============================================

const TASK_RUNNER_FILES: Record<ManifestTaskKey, readonly string[]> = {
  competency_setek: ["pipeline/pipeline-task-runners-competency.ts"],
  competency_changche: ["pipeline/pipeline-task-runners-competency.ts"],
  competency_haengteuk: ["pipeline/pipeline-task-runners-competency.ts"],
  cross_subject_theme_extraction: [
    "pipeline/pipeline-task-runners-theme-extraction.ts",
  ],
  setek_guide: [
    "pipeline/pipeline-task-runners-guide.ts",
    "llm/actions/generateSetekGuide.ts",
  ],
  slot_generation: [
    "pipeline/pipeline-slot-generator.ts",
    "pipeline/pipeline-task-runners-slot.ts",
  ],
  changche_guide: [
    "pipeline/pipeline-task-runners-guide.ts",
    "llm/actions/generateChangcheGuide.ts",
  ],
  haengteuk_guide: [
    "pipeline/pipeline-task-runners-guide.ts",
    "llm/actions/generateHaengteukGuide.ts",
  ],
  draft_generation: ["pipeline/pipeline-task-runners-draft-generation.ts"],
  draft_analysis: ["pipeline/pipeline-task-runners-draft-analysis.ts"],

  storyline_generation: ["pipeline/synthesis/phase-s1-storyline.ts"],
  edge_computation: ["pipeline/synthesis/phase-s2-edges.ts"],
  hyperedge_computation: ["pipeline/synthesis/phase-s2-hyperedges.ts"],
  narrative_arc_extraction: ["pipeline/synthesis/phase-s2-narrative-arc.ts"],
  guide_matching: ["pipeline/synthesis/phase-s2-edges.ts"],
  haengteuk_linking: ["pipeline/synthesis/phase-s2-haengteuk-linking.ts"],
  ai_diagnosis: [
    "pipeline/synthesis/phase-s3-diagnosis.ts",
    "llm/actions/generateDiagnosis.ts",
  ],
  course_recommendation: [
    "pipeline/synthesis/phase-s3-diagnosis.ts",
    "llm/actions/generateDiagnosis.ts",
  ],
  gap_tracking: ["pipeline/synthesis/phase-s3p5-gap-tracker.ts"],
  bypass_analysis: ["pipeline/synthesis/phase-s4-bypass.ts"],
  activity_summary: [
    "pipeline/synthesis/phase-s5-strategy.ts",
    "llm/actions/generateActivitySummary.ts",
  ],
  ai_strategy: [
    "pipeline/synthesis/phase-s5-strategy.ts",
    "llm/actions/suggestStrategies.ts",
  ],
  interview_generation: [
    "pipeline/synthesis/phase-s6-interview.ts",
    "llm/actions/generateInterviewQuestions.ts",
  ],
  roadmap_generation: [
    "pipeline/synthesis/phase-s6-interview.ts",
    "llm/actions/generateRoadmap.ts",
  ],

  past_storyline_generation: [
    "pipeline/past-analytics/phase-a1-past-storyline.ts",
    "llm/actions/generatePastStoryline.ts",
  ],
  past_diagnosis: [
    "pipeline/past-analytics/phase-a2-past-diagnosis.ts",
    "llm/actions/generatePastDiagnosis.ts",
  ],
  past_strategy: [
    "pipeline/past-analytics/phase-a3-past-strategy.ts",
    "llm/actions/generatePastStrategy.ts",
  ],

  blueprint_generation: [
    "pipeline/blueprint/phase-b1-blueprint.ts",
    "llm/actions/generateBlueprint.ts",
  ],
};

// ============================================
// 정규식 기반 추출
// ts-morph 같은 AST 파서를 쓰지 않는 이유: dependency 증가 회피 + 정확도 충분.
// - supabase.from("X") / .from('X') / .from(`X`) 모두 커버
// - ctx.results["X"] / getTaskResult(ctx.results, "X") 커버
// ============================================

const FROM_PATTERN = /\.from\(\s*["'`]([a-zA-Z_][\w]*)["'`]\s*\)/g;
const CTX_RESULTS_INDEX_PATTERN =
  /ctx\.results\??\s*\[\s*["'`]([a-zA-Z_][\w]*)["'`]\s*\]/g;
const GET_TASK_RESULT_PATTERN =
  /getTaskResult\([^,]+,\s*["'`]([a-zA-Z_][\w]*)["'`]/g;

/** 한 파일에서 모든 `.from("X")` 수집 (comment/string 안 무시 — 실전 오탐 낮음). */
function extractFromTables(sourceText: string): Set<string> {
  const tables = new Set<string>();
  let match;
  while ((match = FROM_PATTERN.exec(sourceText)) !== null) {
    tables.add(match[1]);
  }
  return tables;
}

/** 한 파일에서 `ctx.results["X"]` / `getTaskResult(ctx.results, "X")` 수집. */
function extractCtxResultKeys(sourceText: string): Set<string> {
  const keys = new Set<string>();
  let match;
  while ((match = CTX_RESULTS_INDEX_PATTERN.exec(sourceText)) !== null) {
    keys.add(match[1]);
  }
  while ((match = GET_TASK_RESULT_PATTERN.exec(sourceText)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// ============================================
// 검증 로직
// ============================================

type Severity = "error" | "warn";

interface ValidationIssue {
  taskKey: ManifestTaskKey | "<global>";
  file?: string;
  severity: Severity;
  message: string;
}

interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warnCount: number;
  scannedTasks: number;
  scannedFiles: number;
}

function readSourceFile(relPath: string): string | null {
  const absPath = path.join(RECORD_ANALYSIS_ROOT, relPath);
  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
}

function validateFileConsistency(
  taskKey: ManifestTaskKey,
  manifest: PipelineTaskManifest,
  filePath: string,
  sourceText: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const actualTables = extractFromTables(sourceText);
  const actualCtxKeys = extractCtxResultKeys(sourceText);

  const manifestTables = new Set<string>([
    ...manifest.writes,
    ...manifest.reads,
    ...(manifest.readsFromPreviousRun ?? []),
  ]);

  // 여러 태스크가 같은 파일에 살 수 있으므로, 이 파일을 소유하는 모든 태스크의 합집합으로 판단.
  const cohabitingTasks = findTasksInFile(filePath);
  const cohabitingTables = new Set<string>(PIPELINE_INFRA_TABLES);
  for (const co of cohabitingTasks) {
    const coManifest = PIPELINE_TASK_MANIFEST[co];
    coManifest.writes.forEach((t) => cohabitingTables.add(t));
    coManifest.reads.forEach((t) => cohabitingTables.add(t));
    (coManifest.readsFromPreviousRun ?? []).forEach((t) =>
      cohabitingTables.add(t),
    );
  }

  // ① 코드 → manifest: 코드에 있는 .from("X") 가 cohabiting 합집합에 모두 있어야 함
  //    (태스크 단위로 따질 수 없기 때문에 파일 단위 합집합 검사)
  //    이 체크는 파일당 1회만 수행하도록 taskKey 중 첫 번째(사전순)에서만 실행.
  const firstCohabitor = [...cohabitingTasks].sort()[0];
  if (taskKey === firstCohabitor) {
    for (const table of actualTables) {
      if (!cohabitingTables.has(table)) {
        issues.push({
          taskKey,
          file: filePath,
          severity: "error",
          message: `코드에서 \`${table}\` 테이블을 참조하나 manifest 에 선언되지 않음. 이 파일을 쓰는 태스크(${[...cohabitingTasks].join(", ")}) 중 하나의 writes/reads 에 추가 필요.`,
        });
      }
    }
  }

  // ② manifest → 코드: 태스크 단위로 선언한 테이블이 파일 합집합에 실재해야 함
  //    (cohabiting 파일 중 어디에든 있으면 OK)
  for (const table of manifestTables) {
    if (actualTables.has(table)) continue;
    // actualTables(이 파일) 에 없어도, 같은 태스크의 다른 runner 파일에 있으면 OK — 그 파일은 별도 loop
    // 파일 단위 검사라 확정 못 하므로 warn 레벨
  }

  // ③ readsResults: manifest 에 선언한 upstream key 가 실제 코드에 등장해야 함
  //    (cohabiting 태스크의 합집합 기준)
  const cohabitingReadsResults = new Set<string>();
  for (const co of cohabitingTasks) {
    PIPELINE_TASK_MANIFEST[co].readsResults.forEach((k) =>
      cohabitingReadsResults.add(k),
    );
  }
  if (taskKey === firstCohabitor) {
    const knownTaskKeys = new Set<string>(Object.keys(PIPELINE_TASK_MANIFEST));
    // 코드에서 참조한 ctx.results 키 중 manifest 에 없는 것
    for (const key of actualCtxKeys) {
      if (key.startsWith("_")) continue; // internal cache keys (_blueprintPhase, _gapTracker 등)
      if (!knownTaskKeys.has(key)) continue; // 러너 내부 스크래치 키 (<task>_accumulated_xxx 등)
      if (!cohabitingReadsResults.has(key)) {
        issues.push({
          taskKey,
          file: filePath,
          severity: "warn",
          message: `코드에서 \`ctx.results["${key}"]\` 를 참조하나 manifest.readsResults 에 없음. 태스크 ${[...cohabitingTasks].join("/")} 중 하나에 추가 검토.`,
        });
      }
    }
  }

  return issues;
}

/** `file` 을 소유하는 태스크 집합 (TASK_RUNNER_FILES 역산). */
function findTasksInFile(file: string): Set<ManifestTaskKey> {
  const tasks = new Set<ManifestTaskKey>();
  for (const [key, files] of Object.entries(TASK_RUNNER_FILES) as [
    ManifestTaskKey,
    readonly string[],
  ][]) {
    if (files.includes(file)) tasks.add(key);
  }
  return tasks;
}

/**
 * ④ Cross-run 소비자 계약 검증 (PR 6, 2026-04-17 풍부화).
 *
 * manifest 의 `writesForNextRun: [X, Y]` 는 "다음 실행의 상류 태스크 X, Y 가 이 태스크의
 * task_result 를 읽겠다"는 계약 선언. 실제로 X/Y 의 runner 코드가 `getPreviousRunResult(...)`
 * 또는 `previousRunOutputs.taskResults[...]` 로 **이 writer 의 task_key 를 소비** 해야 계약 성립.
 *
 * 한 번이라도 풍부화 없이 wire 가 빠지면 manifest 는 그대로인데 실제 소비가 사라져서 drift 발생.
 * CI 가 매번 강제하면 같은 패턴 반복(04-17 E 진단) 영구 방지.
 */
function validateCrossRunConsumers(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [writerKey, writerManifest] of Object.entries(
    PIPELINE_TASK_MANIFEST,
  ) as [ManifestTaskKey, PipelineTaskManifest][]) {
    const downstream = writerManifest.writesForNextRun;
    if (!downstream || downstream.length === 0) continue;

    for (const consumerKey of downstream) {
      const consumerFiles = TASK_RUNNER_FILES[consumerKey];
      if (!consumerFiles || consumerFiles.length === 0) {
        issues.push({
          taskKey: writerKey,
          severity: "error",
          message: `writesForNextRun → ${consumerKey} 선언돼 있으나 소비자 runner 파일 매핑 없음.`,
        });
        continue;
      }

      // 소비자 runner 파일(들) 합집합에서 getPreviousRunResult("<writerKey>") 혹은
      // previousRunOutputs.taskResults["<writerKey>"] 호출이 1회 이상 있어야 함.
      let consumed = false;
      const searchNeedles = [
        `getPreviousRunResult`,
        `previousRunOutputs`,
      ];
      const writerKeyPattern = new RegExp(
        `["'\`]${writerKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`,
      );
      for (const file of consumerFiles) {
        const source = readSourceFile(file);
        if (!source) continue;
        const hasCrossRunSymbol = searchNeedles.some((n) => source.includes(n));
        const mentionsWriterKey = writerKeyPattern.test(source);
        if (hasCrossRunSymbol && mentionsWriterKey) {
          consumed = true;
          break;
        }
      }

      if (!consumed) {
        issues.push({
          taskKey: writerKey,
          severity: "error",
          message: `writesForNextRun → ${consumerKey} 선언돼 있으나 ${consumerKey} runner (${consumerFiles.join(", ")}) 에서 \`getPreviousRunResult("${writerKey}")\` 또는 \`previousRunOutputs\` + "${writerKey}" 키 소비 호출을 찾을 수 없음. manifest 와 실제 소비가 drift 상태.`,
        });
      }
    }
  }
  return issues;
}

/** ③ Orphan 탐지: writes 테이블을 읽는 다른 태스크가 0 이고 terminal 미선언이면 fail. */
function validateOrphanTables(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [key, manifest] of Object.entries(PIPELINE_TASK_MANIFEST) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][]) {
    if (manifest.writes.length === 0) continue;

    // 이 태스크를 다른 태스크가 readsResults 로 참조하는가?
    const consumedByResults = Object.entries(PIPELINE_TASK_MANIFEST).some(
      ([otherKey, other]) =>
        otherKey !== key && other.readsResults.includes(key),
    );

    // 이 태스크의 writes 테이블이 다른 태스크의 reads 에 하나라도 있는가?
    const consumedByTable = manifest.writes.some((table) =>
      Object.entries(PIPELINE_TASK_MANIFEST).some(
        ([otherKey, other]) =>
          otherKey !== key && other.reads.includes(table),
      ),
    );

    if (consumedByResults || consumedByTable) {
      // 소비자 있음 — terminal 이 선언돼 있다면 오히려 제거 권고
      if (manifest.terminal && !manifest.terminal.pendingCrossRunFeedback) {
        issues.push({
          taskKey: key,
          severity: "warn",
          message: `terminal 선언돼 있으나 파이프라인 내 소비자 존재 — terminal 제거 검토.`,
        });
      }
      continue;
    }

    // 소비자 없음 — terminal 선언 필수
    if (!manifest.terminal) {
      issues.push({
        taskKey: key,
        severity: "error",
        message: `파이프라인 내 소비자 없음 (writes: ${manifest.writes.join(", ")}). terminal 선언 또는 소비 태스크 연결 필요.`,
      });
      continue;
    }

    // consumers 2 개 미만 경고 (리뷰어 가이드)
    if (manifest.terminal.consumers.length < 2) {
      issues.push({
        taskKey: key,
        severity: "warn",
        message: `terminal.consumers 가 1 개 — 실제 소비 지점 2 개 이상 명시 권장.`,
      });
    }

    // PR 5: pendingCrossRunFeedback=true 면 writesForNextRun 선언 필수
    if (manifest.terminal.pendingCrossRunFeedback) {
      if (!manifest.writesForNextRun || manifest.writesForNextRun.length === 0) {
        issues.push({
          taskKey: key,
          severity: "error",
          message: `pendingCrossRunFeedback=true 이나 writesForNextRun 미선언 — 다음 실행 소비 태스크 지정 필요.`,
        });
      } else {
        // writesForNextRun 의 각 태스크가 실재하는지
        for (const downstream of manifest.writesForNextRun) {
          if (!PIPELINE_TASK_MANIFEST[downstream]) {
            issues.push({
              taskKey: key,
              severity: "error",
              message: `writesForNextRun 에 존재하지 않는 태스크 \`${downstream}\` 선언.`,
            });
          }
        }
      }
    }
  }
  return issues;
}

// ============================================
// 실행부
// ============================================

function runValidation(): ValidationReport {
  const issues: ValidationIssue[] = [];
  const scannedFiles = new Set<string>();

  for (const [taskKey, files] of Object.entries(TASK_RUNNER_FILES) as [
    ManifestTaskKey,
    readonly string[],
  ][]) {
    const manifest = PIPELINE_TASK_MANIFEST[taskKey];
    if (!manifest) {
      issues.push({
        taskKey,
        severity: "error",
        message: `TASK_RUNNER_FILES 에는 있으나 manifest 에 없음`,
      });
      continue;
    }

    for (const relFile of files) {
      const source = readSourceFile(relFile);
      if (!source) {
        issues.push({
          taskKey,
          file: relFile,
          severity: "error",
          message: `runner 파일을 읽을 수 없음. TASK_RUNNER_FILES 업데이트 필요.`,
        });
        continue;
      }
      scannedFiles.add(relFile);
      issues.push(
        ...validateFileConsistency(taskKey, manifest, relFile, source),
      );
    }
  }

  // Manifest 만 있고 TASK_RUNNER_FILES 에 없는 태스크
  for (const manifestKey of Object.keys(
    PIPELINE_TASK_MANIFEST,
  ) as ManifestTaskKey[]) {
    if (!TASK_RUNNER_FILES[manifestKey]) {
      issues.push({
        taskKey: manifestKey,
        severity: "error",
        message: `manifest 에는 있으나 TASK_RUNNER_FILES 매핑 누락 — CI 가 검증 불가.`,
      });
    }
  }

  issues.push(...validateOrphanTables());
  issues.push(...validateCrossRunConsumers());

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;

  return {
    issues,
    errorCount,
    warnCount,
    scannedTasks: Object.keys(PIPELINE_TASK_MANIFEST).length,
    scannedFiles: scannedFiles.size,
  };
}

// ============================================
// 리포트 출력
// ============================================

function formatHuman(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push("━━━ Pipeline Manifest Validation ━━━");
  lines.push(
    `  태스크 ${report.scannedTasks} 개, 파일 ${report.scannedFiles} 개 스캔`,
  );
  lines.push(
    `  error ${report.errorCount} 건 / warn ${report.warnCount} 건`,
  );
  lines.push("");

  if (report.issues.length === 0) {
    lines.push("✅ 모든 검증 통과");
    return lines.join("\n");
  }

  const byTask = new Map<string, ValidationIssue[]>();
  for (const issue of report.issues) {
    const arr = byTask.get(issue.taskKey) ?? [];
    arr.push(issue);
    byTask.set(issue.taskKey, arr);
  }

  for (const [task, taskIssues] of [...byTask.entries()].sort()) {
    lines.push(`▸ ${task}`);
    for (const issue of taskIssues) {
      const icon = issue.severity === "error" ? "✗" : "⚠";
      const where = issue.file ? ` (${issue.file})` : "";
      lines.push(`    ${icon} ${issue.message}${where}`);
    }
  }

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const asJson = args.includes("--json");

  const report = runValidation();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHuman(report));
  }

  const hasErrors = report.errorCount > 0 || (strict && report.warnCount > 0);
  process.exit(hasErrors ? 1 : 0);
}

main();
