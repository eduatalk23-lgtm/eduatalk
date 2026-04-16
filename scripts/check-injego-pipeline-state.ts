#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 학생(id=35ee94b6-9484-4bee-8100-c761c1c56831) 파이프라인 현황 조사.
 *
 * Prospective 풀런 검증 전 baseline 조사용.
 * 출력:
 *   - 기존 pipeline rows (grade/synthesis × status × tasks)
 *   - blueprint/bridge/analysis/projected 하이퍼엣지 수
 *   - competency_scores (source=ai / ai_projected)
 *   - diagnosis 최신 본
 *
 * 사용법: npx tsx scripts/check-injego-pipeline-state.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  console.log(`🔍 인제고 1학년 학생 상태 조사`);
  console.log(`   studentId=${STUDENT_ID}`);
  console.log(`   tenantId=${TENANT_ID}\n`);

  // ── 학생 정보 ──
  const { data: student } = await supabase
    .from("students")
    .select("grade, target_major, school_name")
    .eq("id", STUDENT_ID)
    .maybeSingle();
  console.log(`## 학생 정보`);
  console.log(`   grade=${student?.grade} · target_major=${student?.target_major} · school=${student?.school_name}\n`);

  // ── 파이프라인 목록 ──
  const { data: pipelines } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, grade, status, tasks, started_at, updated_at")
    .eq("student_id", STUDENT_ID)
    .order("started_at", { ascending: false });

  console.log(`## 파이프라인 (${pipelines?.length ?? 0}건)`);
  for (const p of pipelines ?? []) {
    const tasks = (p.tasks ?? {}) as Record<string, string>;
    const counts = { completed: 0, failed: 0, running: 0, pending: 0, skipped: 0 };
    for (const status of Object.values(tasks)) {
      if (status in counts) counts[status as keyof typeof counts]++;
    }
    const taskSummary = Object.entries(counts).filter(([, c]) => c > 0).map(([k, c]) => `${k}=${c}`).join(", ");
    const gradeLabel = p.pipeline_type === "grade" ? `G${p.grade}` : "S";
    console.log(`   [${gradeLabel}] ${p.id.slice(0, 8)} · ${p.status} · ${taskSummary}`);
    console.log(`        started=${p.started_at} updated=${p.updated_at}`);
  }
  console.log();

  // ── 하이퍼엣지 ──
  const { data: hyperedges } = await supabase
    .from("student_record_hyperedges")
    .select("edge_context, theme_label, shared_competencies, members")
    .eq("student_id", STUDENT_ID)
    .eq("is_stale", false);

  const byContext = new Map<string, typeof hyperedges>();
  for (const he of hyperedges ?? []) {
    const key = String(he.edge_context);
    if (!byContext.has(key)) byContext.set(key, []);
    byContext.get(key)!.push(he);
  }

  console.log(`## 하이퍼엣지 (총 ${hyperedges?.length ?? 0}건)`);
  for (const [ctx, items] of byContext.entries()) {
    console.log(`   [${ctx}] ${items!.length}건`);
    for (const he of items!.slice(0, 5)) {
      const comps = (he.shared_competencies as string[] | null)?.join(", ") ?? "없음";
      const members = ((he.members as Array<{ label: string; grade: number | null }> | null) ?? []).slice(0, 3).map((m) => m.label).join(", ");
      console.log(`      · "${he.theme_label}" — 역량[${comps}] — 멤버[${members}]`);
    }
  }
  console.log();

  // ── competency_scores ──
  const { data: scores } = await supabase
    .from("student_record_competency_scores")
    .select("source, competency_item, grade_value, school_year, scope")
    .eq("student_id", STUDENT_ID);
  const aiCount = (scores ?? []).filter((s) => s.source === "ai").length;
  const projectedCount = (scores ?? []).filter((s) => s.source === "ai_projected").length;
  console.log(`## 역량 점수`);
  console.log(`   source=ai: ${aiCount}건`);
  console.log(`   source=ai_projected: ${projectedCount}건\n`);

  // ── activity_tags ──
  const { data: tags } = await supabase
    .from("student_record_activity_tags")
    .select("tag_context")
    .eq("student_id", STUDENT_ID);
  const tagCounts = new Map<string, number>();
  for (const t of tags ?? []) {
    const k = String(t.tag_context);
    tagCounts.set(k, (tagCounts.get(k) ?? 0) + 1);
  }
  console.log(`## 활동 태그 (총 ${tags?.length ?? 0}건)`);
  for (const [ctx, count] of tagCounts.entries()) {
    console.log(`   tag_context=${ctx}: ${count}건`);
  }
  console.log();

  // ── edges ──
  const { data: edges } = await supabase
    .from("student_record_edges")
    .select("edge_context")
    .eq("student_id", STUDENT_ID);
  const edgeCounts = new Map<string, number>();
  for (const e of edges ?? []) {
    const k = String(e.edge_context);
    edgeCounts.set(k, (edgeCounts.get(k) ?? 0) + 1);
  }
  console.log(`## 엣지 (총 ${edges?.length ?? 0}건)`);
  for (const [ctx, count] of edgeCounts.entries()) {
    console.log(`   edge_context=${ctx}: ${count}건`);
  }
  console.log();

  // ── diagnosis ──
  const { data: diagnoses } = await supabase
    .from("student_record_diagnosis")
    .select("school_year, overall_grade, direction_strength, strengths, weaknesses, strategy_notes")
    .eq("student_id", STUDENT_ID)
    .order("school_year", { ascending: false });

  console.log(`## 진단 (${diagnoses?.length ?? 0}건)`);
  for (const d of diagnoses ?? []) {
    console.log(`   [${d.school_year}학년도] overall=${d.overall_grade} direction=${d.direction_strength}`);
    console.log(`      strengths(${(d.strengths as string[] | null)?.length ?? 0}): ${((d.strengths as string[] | null) ?? []).slice(0, 2).join(" | ")}`);
    console.log(`      weaknesses(${(d.weaknesses as string[] | null)?.length ?? 0}): ${((d.weaknesses as string[] | null) ?? []).slice(0, 2).join(" | ")}`);
  }
  console.log();

  // ── strategies ──
  const { data: strategies } = await supabase
    .from("student_record_strategies")
    .select("target_area, priority, strategy_content, reasoning")
    .eq("student_id", STUDENT_ID);
  console.log(`## 보완 전략 (${strategies?.length ?? 0}건)`);
  for (const s of (strategies ?? []).slice(0, 5)) {
    console.log(`   [${s.priority}/${s.target_area}] ${(s.strategy_content as string)?.slice(0, 80)}`);
    if (s.reasoning) console.log(`      reason: ${(s.reasoning as string).slice(0, 100)}`);
  }
  console.log();

  // ── roadmap items ──
  const { data: roadmap } = await supabase
    .from("student_record_roadmap_items")
    .select("grade, semester, area, plan_content")
    .eq("student_id", STUDENT_ID)
    .order("grade")
    .order("semester");
  const aiRoadmap = (roadmap ?? []).filter((r) => String(r.plan_content).startsWith("[AI]"));
  console.log(`## 로드맵 (총 ${roadmap?.length ?? 0}건, AI 생성 ${aiRoadmap.length}건)`);
  for (const r of aiRoadmap.slice(0, 5)) {
    console.log(`   [${r.grade}-${r.semester}/${r.area}] ${(r.plan_content as string).slice(0, 80)}`);
  }
  console.log();

  console.log(`✅ 조사 완료`);
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
