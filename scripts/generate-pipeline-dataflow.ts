/**
 * docs/pipeline-dataflow.md 자동 생성 스크립트 (PR 3, 2026-04-17).
 *
 * `PIPELINE_TASK_MANIFEST` 를 읽어 다음 섹션을 렌더한다:
 *   1. 태스크 → 태스크 의존 그래프 (readsResults + table-mediated)
 *   2. 테이블 → 작성자/소비자 매트릭스
 *   3. Terminal 선언 목록
 *   4. pendingCrossRunFeedback 임시 terminal 요약
 *
 * 사용법:
 *   pnpm tsx scripts/generate-pipeline-dataflow.ts
 *   pnpm tsx scripts/generate-pipeline-dataflow.ts --check   # 기존 파일과 diff, 변경 있으면 exit 1
 *
 * CI 통합: validate-pipeline-manifest job 뒤에 `--check` 로 drift 감지 가능.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  PIPELINE_TASK_MANIFEST,
  invertReadsResults,
  type ManifestTaskKey,
  type PipelineTaskManifest,
} from "../lib/domains/record-analysis/pipeline/pipeline-task-manifest";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "docs/pipeline-dataflow.md");

// ============================================
// 태스크 → 파이프라인 분류
// ============================================

const GRADE_TASKS = new Set<ManifestTaskKey>([
  "competency_setek",
  "competency_changche",
  "competency_haengteuk",
  "cross_subject_theme_extraction",
  "setek_guide",
  "slot_generation",
  "changche_guide",
  "haengteuk_guide",
  "draft_generation",
  "draft_analysis",
]);
const SYNTHESIS_TASKS = new Set<ManifestTaskKey>([
  "storyline_generation",
  "edge_computation",
  "hyperedge_computation",
  "narrative_arc_extraction",
  "guide_matching",
  "haengteuk_linking",
  "ai_diagnosis",
  "course_recommendation",
  "gap_tracking",
  "bypass_analysis",
  "activity_summary",
  "ai_strategy",
  "interview_generation",
  "roadmap_generation",
]);
const PAST_TASKS = new Set<ManifestTaskKey>([
  "past_storyline_generation",
  "past_diagnosis",
  "past_strategy",
]);
const BLUEPRINT_TASKS = new Set<ManifestTaskKey>(["blueprint_generation"]);

function pipelineOf(task: ManifestTaskKey): string {
  if (GRADE_TASKS.has(task)) return "Grade";
  if (SYNTHESIS_TASKS.has(task)) return "Synthesis";
  if (PAST_TASKS.has(task)) return "Past";
  if (BLUEPRINT_TASKS.has(task)) return "Blueprint";
  return "Unknown";
}

// ============================================
// 렌더링
// ============================================

function renderHeader(): string {
  const generatedAt = new Date().toISOString().split("T")[0];
  return [
    "# Pipeline Dataflow (자동 생성)",
    "",
    `> 이 문서는 \`scripts/generate-pipeline-dataflow.ts\` 가 \`PIPELINE_TASK_MANIFEST\` 로부터 자동 생성합니다.`,
    `> 직접 수정하지 마세요 — 내용을 바꾸려면 매니페스트를 수정한 뒤 재생성하세요.`,
    `> Generated: ${generatedAt}`,
    "",
  ].join("\n");
}

function renderOverview(): string {
  const total = Object.keys(PIPELINE_TASK_MANIFEST).length;
  const terminalCount = Object.values(PIPELINE_TASK_MANIFEST).filter(
    (m) => m.terminal,
  ).length;
  const pendingCount = Object.values(PIPELINE_TASK_MANIFEST).filter(
    (m) => m.terminal?.pendingCrossRunFeedback,
  ).length;

  return [
    "## 개요",
    "",
    `- 총 태스크: **${total}** 개`,
    `  - Grade: ${GRADE_TASKS.size}, Synthesis: ${SYNTHESIS_TASKS.size}, Past: ${PAST_TASKS.size}, Blueprint: ${BLUEPRINT_TASKS.size}`,
    `- Terminal 선언: **${terminalCount}** 건 (그 중 임시 \`pendingCrossRunFeedback\`: ${pendingCount} 건)`,
    "",
  ].join("\n");
}

function renderTaskToTaskGraph(): string {
  const writesResultsFor = invertReadsResults();
  const lines: string[] = [
    "## 1. 태스크 → 태스크 의존 그래프",
    "",
    "- `readsResults`: ctx 산출물(동일 실행 내) 의존",
    "- `table-mediated`: DB 테이블을 통한 간접 의존 (이 태스크 writes → 다른 태스크 reads)",
    "",
    "| 태스크 | 파이프라인 | readsResults (upstream) | 테이블 소비자 (downstream) |",
    "|---|---|---|---|",
  ];

  for (const [key, manifest] of sortedEntries()) {
    const upstream =
      manifest.readsResults.length > 0
        ? manifest.readsResults.map((k) => `\`${k}\``).join(", ")
        : "—";

    const tableConsumers = new Set<ManifestTaskKey>();
    for (const table of manifest.writes) {
      for (const [otherKey, other] of Object.entries(
        PIPELINE_TASK_MANIFEST,
      ) as [ManifestTaskKey, PipelineTaskManifest][]) {
        if (otherKey === key) continue;
        if (other.reads.includes(table)) tableConsumers.add(otherKey);
      }
    }
    // readsResults 기반 소비자도 함께 표기
    for (const other of writesResultsFor[key] ?? []) {
      tableConsumers.add(other);
    }

    const downstream =
      tableConsumers.size > 0
        ? [...tableConsumers]
            .sort()
            .map((k) => `\`${k}\``)
            .join(", ")
        : manifest.terminal
          ? `_(terminal: ${manifest.terminal.reason})_`
          : "—";

    lines.push(
      `| \`${key}\` | ${pipelineOf(key)} | ${upstream} | ${downstream} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderTableMatrix(): string {
  const allTables = new Set<string>();
  for (const manifest of Object.values(PIPELINE_TASK_MANIFEST)) {
    manifest.writes.forEach((t) => allTables.add(t));
    manifest.reads.forEach((t) => allTables.add(t));
  }

  const lines: string[] = [
    "## 2. 테이블 → 작성자/소비자 매트릭스",
    "",
    "| 테이블 | 작성 태스크 (writes) | 읽기 태스크 (reads) |",
    "|---|---|---|",
  ];

  for (const table of [...allTables].sort()) {
    const writers: string[] = [];
    const readers: string[] = [];
    for (const [key, manifest] of Object.entries(
      PIPELINE_TASK_MANIFEST,
    ) as [ManifestTaskKey, PipelineTaskManifest][]) {
      if (manifest.writes.includes(table)) writers.push(key);
      if (manifest.reads.includes(table)) readers.push(key);
    }

    const writerCell =
      writers.length > 0
        ? writers
            .sort()
            .map((k) => `\`${k}\``)
            .join(", ")
        : "_(external)_";
    const readerCell =
      readers.length > 0
        ? readers
            .sort()
            .map((k) => `\`${k}\``)
            .join(", ")
        : "—";

    lines.push(`| \`${table}\` | ${writerCell} | ${readerCell} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderTerminalDeclarations(): string {
  const terminals = Object.entries(PIPELINE_TASK_MANIFEST)
    .filter(([, m]) => m.terminal)
    .sort(([a], [b]) => a.localeCompare(b)) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][];

  if (terminals.length === 0) return "";

  const lines: string[] = [
    "## 3. Terminal 선언",
    "",
    "| 태스크 | 이유 | 임시? | 소비자 |",
    "|---|---|---|---|",
  ];

  for (const [key, manifest] of terminals) {
    const t = manifest.terminal!;
    const pending = t.pendingCrossRunFeedback ? "⏳ (PR 5 대기)" : "—";
    const consumers = t.consumers.map((c) => `· ${c}`).join("<br>");
    lines.push(`| \`${key}\` | \`${t.reason}\` | ${pending} | ${consumers} |`);
  }

  lines.push("");
  lines.push(
    "> **⏳ 임시 terminal**: PR 5 (`PipelineContext.previousRunOutputs` 인프라) 완성 후 해제 대상.",
  );
  lines.push(
    "> 2026-04-17 분기점 ① 결정: `ui_only` 는 영구 선언하지 않고 임시로만 표기.",
  );
  lines.push("");

  return lines.join("\n");
}

function renderOrphanWarnings(): string {
  const lines: string[] = [];
  const orphans: ManifestTaskKey[] = [];

  for (const [key, manifest] of Object.entries(PIPELINE_TASK_MANIFEST) as [
    ManifestTaskKey,
    PipelineTaskManifest,
  ][]) {
    if (manifest.writes.length === 0) continue;
    if (manifest.terminal) continue;

    const hasConsumer =
      Object.entries(PIPELINE_TASK_MANIFEST).some(
        ([otherKey, other]) =>
          otherKey !== key && other.readsResults.includes(key),
      ) ||
      manifest.writes.some((table) =>
        Object.entries(PIPELINE_TASK_MANIFEST).some(
          ([otherKey, other]) =>
            otherKey !== key && other.reads.includes(table),
        ),
      );

    if (!hasConsumer) orphans.push(key);
  }

  if (orphans.length === 0) return "";

  lines.push("## 4. Orphan 경고");
  lines.push("");
  lines.push(
    "⚠️ 다음 태스크는 writes 가 있으나 파이프라인 내 소비자가 없고 terminal 도 선언되지 않았습니다:",
  );
  lines.push("");
  for (const key of orphans) {
    lines.push(`- \`${key}\``);
  }
  lines.push("");
  return lines.join("\n");
}

function sortedEntries(): [ManifestTaskKey, PipelineTaskManifest][] {
  const order: ManifestTaskKey[] = [
    ...GRADE_TASKS,
    ...BLUEPRINT_TASKS,
    ...PAST_TASKS,
    ...SYNTHESIS_TASKS,
  ];
  return order.map(
    (key) =>
      [key, PIPELINE_TASK_MANIFEST[key]] as [
        ManifestTaskKey,
        PipelineTaskManifest,
      ],
  );
}

function render(): string {
  return [
    renderHeader(),
    renderOverview(),
    renderTaskToTaskGraph(),
    renderTableMatrix(),
    renderTerminalDeclarations(),
    renderOrphanWarnings(),
  ]
    .filter(Boolean)
    .join("\n");
}

// ============================================
// 실행부
// ============================================

function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");

  const rendered = render();

  if (checkMode) {
    const current = fs.existsSync(OUTPUT_PATH)
      ? fs.readFileSync(OUTPUT_PATH, "utf-8")
      : "";
    if (normalizeGenerated(current) !== normalizeGenerated(rendered)) {
      console.error(
        `✗ ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} 가 매니페스트와 불일치합니다.`,
      );
      console.error(
        `  \`pnpm tsx scripts/generate-pipeline-dataflow.ts\` 재실행 후 커밋해 주세요.`,
      );
      process.exit(1);
    }
    console.log(`✅ ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} 일치`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rendered, "utf-8");
  console.log(`✅ ${path.relative(PROJECT_ROOT, OUTPUT_PATH)} 생성 완료`);
}

/** 생성 시각 라인 제거 — --check 비교 시 타임스탬프만 달라서 실패하는 것을 방지. */
function normalizeGenerated(md: string): string {
  return md.replace(/^> Generated: .*$/m, "");
}

main();
