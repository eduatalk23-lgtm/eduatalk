#!/usr/bin/env npx tsx
/**
 * Cross-run 측정용 스냅샷.
 *
 * 지정 학생의 파이프라인/산출물 핵심 필드를 `tmp/cross-run/<label>.json` 으로 덤프.
 * 같은 학생에 대해 Run 1 → Run 2 전·후로 라벨을 바꿔가며 여러 번 호출한 뒤
 * `cross-run-diff.ts` 로 비교한다.
 *
 * 사용:
 *   npx tsx scripts/cross-run-snapshot.ts --student=kim     --label=run1-post
 *   npx tsx scripts/cross-run-snapshot.ts --student=injego  --label=run2-post
 *
 * 측정 포인트:
 *   - synthesis pipeline.task_results → previousRunOutputs 실제 반영 여부
 *   - storylines(title/keywords/grade_N_theme) → 연속성 Jaccard
 *   - activity_summaries(summary_title) → Run 2 프롬프트 주입 원천
 *   - blueprint pipeline.task_results._blueprintPhase.targetConvergences → 수렴 theme/count
 *   - hyperedges(analysis/blueprint/bridge) count
 *   - 파이프라인 row 자체의 id·completed_at (Run 식별용)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENTS = {
  kim: { id: "0e3e149d-4b9c-402d-ad5c-b3df04190889", tenant: "84b71a5d-5681-4da3-88d2-91e75ef89015", label: "김세린" },
  injego: { id: "35ee94b6-9484-4bee-8100-c761c1c56831", tenant: "84b71a5d-5681-4da3-88d2-91e75ef89015", label: "인제고 1학년" },
} as const;

type StudentKey = keyof typeof STUDENTS;

function parseArg(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split("=", 2)[1] : undefined;
}

async function main() {
  const studentKey = parseArg("--student") as StudentKey | undefined;
  const label = parseArg("--label");

  if (!studentKey || !STUDENTS[studentKey]) {
    console.error(`사용: --student=${Object.keys(STUDENTS).join("|")} --label=<name>`);
    process.exit(1);
  }
  if (!label || !/^[a-z0-9_-]+$/i.test(label)) {
    console.error(`--label 은 영숫자/하이픈/언더스코어만 허용`);
    process.exit(1);
  }

  const student = STUDENTS[studentKey];
  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error("admin client unavailable");

  const [
    { data: pipelines },
    { data: storylines },
    { data: summaries },
    { data: hyperedges },
    { data: edges },
    { data: diagnosis },
    { data: strategies },
    { data: roadmap },
    { data: narrativeArcs },
    { data: haengteukGuideLinks },
  ] = await Promise.all([
    sb
      .from("student_record_analysis_pipelines")
      .select("id, pipeline_type, grade, mode, status, started_at, completed_at, updated_at, task_results")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant)
      .order("completed_at", { ascending: false, nullsFirst: false }),
    sb
      .from("student_record_storylines")
      .select("id, title, keywords, narrative, career_field, grade_1_theme, grade_2_theme, grade_3_theme, scope, sort_order, created_at")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_activity_summaries")
      .select("id, summary_title, target_grades, school_year, status, source, created_at")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant)
      .order("created_at", { ascending: false }),
    sb
      .from("student_record_hyperedges")
      .select("id, edge_context, hyperedge_type, theme_label, theme_slug, shared_competencies, confidence, member_count")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_edges")
      .select("edge_context, edge_type, confidence")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_diagnosis")
      .select("school_year, scope, overall_grade, direction_strength, strengths, weaknesses, updated_at")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_strategies")
      .select("scope, priority, target_area, updated_at")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_roadmap_items")
      .select("grade, semester, area, updated_at")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_narrative_arc")
      .select("id, source")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
    sb
      .from("student_record_haengteuk_guide_links")
      .select("haengteuk_guide_id, haengteuk_id")
      .eq("student_id", student.id)
      .eq("tenant_id", student.tenant),
  ]);

  // Synthesis 최근 completed 파이프라인 추출 (cross-run loader와 동일 쿼리 의미)
  const synthCompleted = (pipelines ?? []).filter(
    (p) => p.pipeline_type === "synthesis" && p.status === "completed",
  );
  const blueprintCompleted = (pipelines ?? []).filter(
    (p) => p.pipeline_type === "blueprint" && p.status === "completed",
  );
  const latestSynth = synthCompleted[0] ?? null;
  const latestBp = blueprintCompleted[0] ?? null;

  const bpPhase = latestBp
    ? ((latestBp.task_results as Record<string, unknown> | null)?._blueprintPhase as
        | {
            targetConvergences?: Array<{ grade?: number; themeLabel?: string; tierAlignment?: string }>;
            milestones?: Record<string, unknown>;
            competencyGrowthTargets?: unknown[];
          }
        | undefined)
    : undefined;

  const snapshot = {
    meta: {
      capturedAt: new Date().toISOString(),
      studentKey,
      studentId: student.id,
      studentLabel: student.label,
      tenantId: student.tenant,
      label,
    },
    pipelines: {
      total: pipelines?.length ?? 0,
      byType: tally(pipelines ?? [], (p) => p.pipeline_type as string),
      byStatus: tally(pipelines ?? [], (p) => p.status as string),
      synthesisCompletedCount: synthCompleted.length,
      blueprintCompletedCount: blueprintCompleted.length,
      latestSynthesis: latestSynth
        ? {
            id: latestSynth.id,
            completed_at: latestSynth.completed_at,
            // task_results 키 목록만 (value 크기 유지): 풍부화 전후 비교 신호
            taskResultKeys: Object.keys((latestSynth.task_results as Record<string, unknown>) ?? {}),
            // storyline_generation preview 원문 — POC 소비 결과 증거
            storylineGenerationResult:
              ((latestSynth.task_results as Record<string, unknown>) ?? {})["storyline_generation"] ?? null,
            activitySummaryResult:
              ((latestSynth.task_results as Record<string, unknown>) ?? {})["activity_summary"] ?? null,
          }
        : null,
      latestBlueprint: latestBp
        ? {
            id: latestBp.id,
            completed_at: latestBp.completed_at,
            targetConvergences: (bpPhase?.targetConvergences ?? []).map((c) => ({
              grade: c.grade,
              themeLabel: c.themeLabel,
              tierAlignment: c.tierAlignment,
            })),
            milestoneGrades: Object.keys(bpPhase?.milestones ?? {}),
            growthTargetCount: Array.isArray(bpPhase?.competencyGrowthTargets)
              ? bpPhase.competencyGrowthTargets.length
              : 0,
          }
        : null,
    },
    storylines: {
      count: storylines?.length ?? 0,
      items: (storylines ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        keywords: s.keywords,
        career_field: s.career_field,
        grade_themes: [s.grade_1_theme, s.grade_2_theme, s.grade_3_theme],
        scope: s.scope,
      })),
    },
    activitySummaries: {
      count: summaries?.length ?? 0,
      titles: (summaries ?? []).map((r) => ({
        id: r.id,
        title: r.summary_title,
        school_year: r.school_year,
        target_grades: r.target_grades,
      })),
    },
    hyperedges: {
      count: hyperedges?.length ?? 0,
      byContext: tally(hyperedges ?? [], (h) => h.edge_context as string),
      byType: tally(hyperedges ?? [], (h) => h.hyperedge_type as string),
      themeLabelsByContext: groupBy(
        hyperedges ?? [],
        (h) => h.edge_context as string,
        (h) => h.theme_label as string,
      ),
    },
    edges: {
      count: edges?.length ?? 0,
      byContext: tally(edges ?? [], (e) => e.edge_context as string),
    },
    diagnosis: {
      count: diagnosis?.length ?? 0,
      byScope: tally(diagnosis ?? [], (d) => d.scope as string),
    },
    strategies: {
      count: strategies?.length ?? 0,
      byScope: tally(strategies ?? [], (s) => s.scope as string),
    },
    roadmap: { count: roadmap?.length ?? 0 },
    narrativeArcs: {
      count: narrativeArcs?.length ?? 0,
      bySource: tally(narrativeArcs ?? [], (n) => n.source as string),
    },
    haengteukGuideLinks: { count: haengteukGuideLinks?.length ?? 0 },
  };

  const outDir = resolve(process.cwd(), "tmp/cross-run");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `${studentKey}--${label}.json`);
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`📸 스냅샷 저장: ${outPath}`);
  console.log(`   학생: ${student.label} (${student.id.slice(0, 8)})`);
  console.log(`   파이프라인 ${snapshot.pipelines.total}건 · synth completed ${snapshot.pipelines.synthesisCompletedCount}건 · blueprint completed ${snapshot.pipelines.blueprintCompletedCount}건`);
  console.log(`   storylines ${snapshot.storylines.count}건 · activity_summaries ${snapshot.activitySummaries.count}건`);
  console.log(`   hyperedges ${snapshot.hyperedges.count}건 (${JSON.stringify(snapshot.hyperedges.byContext)})`);
  if (snapshot.pipelines.latestSynthesis) {
    const ids = snapshot.pipelines.latestSynthesis.taskResultKeys;
    console.log(`   최근 synthesis task_results keys: ${ids.length}개 — ${ids.slice(0, 6).join(", ")}${ids.length > 6 ? " …" : ""}`);
  }
  if (snapshot.pipelines.latestBlueprint) {
    const convs = snapshot.pipelines.latestBlueprint.targetConvergences;
    console.log(`   최근 blueprint convergences: ${convs.length}개`);
    for (const c of convs.slice(0, 4)) console.log(`     · G${c.grade}/${c.tierAlignment} "${c.themeLabel}"`);
  }
}

function tally<T>(arr: T[], key: (v: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of arr) {
    const k = key(v);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function groupBy<T, V>(
  arr: T[],
  key: (v: T) => string,
  value: (v: T) => V,
): Record<string, V[]> {
  const out: Record<string, V[]> = {};
  for (const v of arr) {
    const k = key(v);
    if (!k) continue;
    if (!out[k]) out[k] = [];
    out[k].push(value(v));
  }
  return out;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
