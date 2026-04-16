#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 student의 grade-design 가이드/초안에 Blueprint가 실제로 주입됐는지 검증.
 *
 * 검증 포인트:
 *   1. setek_guides/changche_guides/haengteuk_guides 각 학년에 blueprint-성 키워드 존재
 *   2. draft 세특/창체/행특 컨텐츠에 blueprint 수렴 테마 반영
 *   3. past_analytics / blueprint 파이프라인 행 존재 여부
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

const BLUEPRINT_MARKERS = [
  "세포와 물질대사",
  "질병 기전",
  "의료 응용",
  "수렴",
  "blueprint",
  "Blueprint",
  "전체 계획",
  "4축",
];

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정");

  console.log(`🔍 인제고 1학년 Blueprint 주입 검증\n`);

  // ── 파이프라인 타입별 집계 ──
  const { data: pipelines } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, grade, mode, status, started_at, updated_at")
    .eq("student_id", STUDENT_ID)
    .order("started_at", { ascending: true });
  const byType = new Map<string, number>();
  for (const p of pipelines ?? []) {
    const k = `${p.pipeline_type}${p.mode ? `(${p.mode})` : ""}`;
    byType.set(k, (byType.get(k) ?? 0) + 1);
  }
  console.log(`## 파이프라인 타입 분포`);
  for (const [k, v] of byType.entries()) console.log(`   ${k}: ${v}건`);
  const hasPastAnalytics = (pipelines ?? []).some((p) => p.pipeline_type === "past_analytics");
  const hasBlueprint = (pipelines ?? []).some((p) => p.pipeline_type === "blueprint");
  console.log(`   past_analytics 파이프라인: ${hasPastAnalytics ? "있음 ✓" : "없음 ✗"}`);
  console.log(`   blueprint 파이프라인: ${hasBlueprint ? "있음 ✓" : "없음 ✗"}\n`);

  // ── 가이드 3종 ──
  for (const table of ["student_record_setek_guides", "student_record_changche_guides", "student_record_haengteuk_guides"] as const) {
    const { data: guides } = await supabase
      .from(table)
      .select("grade, guide_mode, content")
      .eq("student_id", STUDENT_ID)
      .eq("tenant_id", TENANT_ID);
    console.log(`## ${table} (${guides?.length ?? 0}건)`);
    for (const g of guides ?? []) {
      const content = String((g as { content?: unknown }).content ?? "");
      const markers = BLUEPRINT_MARKERS.filter((m) => content.includes(m));
      const len = content.length;
      console.log(`   [G${g.grade}/${g.guide_mode}] ${len}B · blueprint 마커 [${markers.join(", ") || "없음"}]`);
    }
    console.log();
  }

  // ── 과거 진단 (past) vs 현재 (final) 구분 ──
  const { data: diagnoses } = await supabase
    .from("student_record_diagnosis")
    .select("school_year, source, scope, overall_grade, strengths, weaknesses")
    .eq("student_id", STUDENT_ID)
    .order("school_year", { ascending: false });
  console.log(`## 진단 scope 분포 (${diagnoses?.length ?? 0}건)`);
  const scopeCount = new Map<string, number>();
  for (const d of diagnoses ?? []) {
    const s = String((d as { scope?: string }).scope ?? "?");
    scopeCount.set(s, (scopeCount.get(s) ?? 0) + 1);
  }
  for (const [k, v] of scopeCount.entries()) console.log(`   scope=${k}: ${v}건`);
  console.log();

  // ── storyline scope ──
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("id, scope, title")
    .eq("student_id", STUDENT_ID);
  const storylineScopes = new Map<string, number>();
  for (const s of storylines ?? []) {
    const k = String((s as { scope?: string }).scope ?? "?");
    storylineScopes.set(k, (storylineScopes.get(k) ?? 0) + 1);
  }
  console.log(`## Storyline scope 분포 (${storylines?.length ?? 0}건)`);
  for (const [k, v] of storylineScopes.entries()) console.log(`   scope=${k}: ${v}건`);
  console.log();

  // ── strategies scope ──
  const { data: strategies } = await supabase
    .from("student_record_strategies")
    .select("id, scope")
    .eq("student_id", STUDENT_ID);
  const stratScopes = new Map<string, number>();
  for (const s of strategies ?? []) {
    const k = String((s as { scope?: string }).scope ?? "?");
    stratScopes.set(k, (stratScopes.get(k) ?? 0) + 1);
  }
  console.log(`## Strategies scope 분포 (${strategies?.length ?? 0}건)`);
  for (const [k, v] of stratScopes.entries()) console.log(`   scope=${k}: ${v}건`);
  console.log();

  // ── 설계 모드 가안 컨텐츠에 blueprint 수렴 반영 여부 ──
  for (const table of ["student_record_seteks", "student_record_changche", "student_record_haengteuk"] as const) {
    const { data: records } = await supabase
      .from(table)
      .select("id, grade, ai_draft_content, content")
      .eq("student_id", STUDENT_ID)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null);
    const withDraft = (records ?? []).filter((r) => {
      const ai = String((r as { ai_draft_content?: unknown }).ai_draft_content ?? "");
      return ai.length > 10;
    });
    console.log(`## ${table} AI 가안 (${withDraft.length}/${records?.length ?? 0}건)`);
    for (const r of withDraft.slice(0, 3)) {
      const ai = String((r as { ai_draft_content?: unknown }).ai_draft_content ?? "");
      const markers = BLUEPRINT_MARKERS.filter((m) => ai.includes(m));
      console.log(`   [G${r.grade}] ${ai.length}B · blueprint 마커 [${markers.join(", ") || "없음"}]`);
    }
    console.log();
  }

  console.log(`✅ 검증 완료`);
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
