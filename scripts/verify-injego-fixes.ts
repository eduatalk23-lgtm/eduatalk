#!/usr/bin/env npx tsx
/**
 * 인제고 1학년 학생 Synthesis 재실행 후 2026-04-16 세션 수정사항 7건 검증.
 *
 * 사용법:
 *   1. scripts/reset-injego-synthesis.ts 실행
 *   2. UI 에서 "Synthesis 재실행" 클릭 → 완료 대기
 *   3. 이 스크립트로 결과 검증
 *
 * 검증 체크리스트:
 *   [B4] Blueprint 1학년 foundational 수렴 1건 이상
 *   [B3] Bridge 하이퍼엣지 shared_competencies 비어있지 않음
 *   [B1] Diagnosis 약점에 "이수율 0%" 미포함 (prospective 프레임)
 *   [B5] Strategy reasoning 중 "Bridge" 언급 포함
 *   [C2] hyperedge edge_context=projected 생성됨 (또는 analysis)
 *   [A2] haengteuk_linking 180s 이내 완료 (elapsedMs < 150_000)
 *   [C3] Roadmap plan_content 에 blueprint 테마/키워드 반영
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "35ee94b6-9484-4bee-8100-c761c1c56831";

type CheckResult = { id: string; label: string; passed: boolean; detail: string };

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  const results: CheckResult[] = [];

  // ── B4: Blueprint 1학년 foundational ──
  const { data: bpHyperedges } = await supabase
    .from("student_record_hyperedges")
    .select("theme_label, members, shared_competencies")
    .eq("student_id", STUDENT_ID)
    .eq("edge_context", "blueprint")
    .eq("is_stale", false);

  const bp1st = (bpHyperedges ?? []).filter((he) => {
    const members = (he.members as Array<{ grade?: number | null }> | null) ?? [];
    return members.some((m) => m.grade === 1);
  });
  results.push({
    id: "B4",
    label: "Blueprint 1학년 foundational 수렴 1건 이상",
    passed: bp1st.length >= 1,
    detail: `총 ${bpHyperedges?.length ?? 0}건 중 1학년 포함 ${bp1st.length}건 — ${bp1st.map((b) => b.theme_label).join(", ") || "없음"}`,
  });

  // ── B3: Bridge competencies ──
  const { data: brHyperedges } = await supabase
    .from("student_record_hyperedges")
    .select("theme_label, shared_competencies")
    .eq("student_id", STUDENT_ID)
    .eq("edge_context", "bridge")
    .eq("is_stale", false);

  const bridgesWithComps = (brHyperedges ?? []).filter((he) => {
    const comps = (he.shared_competencies as string[] | null) ?? [];
    return comps.length > 0;
  });
  results.push({
    id: "B3",
    label: "Bridge 하이퍼엣지 competencies 비어있지 않음",
    passed: (brHyperedges?.length ?? 0) > 0 && bridgesWithComps.length === brHyperedges!.length,
    detail: `총 ${brHyperedges?.length ?? 0}건 중 역량 있는 것 ${bridgesWithComps.length}건`,
  });

  // ── B1: Diagnosis prospective ──
  const { data: diagnoses } = await supabase
    .from("student_record_diagnosis")
    .select("weaknesses, direction_strength, overall_grade")
    .eq("student_id", STUDENT_ID)
    .order("school_year", { ascending: false })
    .limit(1);

  const latest = diagnoses?.[0];
  const ws = (latest?.weaknesses as string[] | null) ?? [];
  const hasRatioZero = ws.some((w) => /이수율\s*0%/.test(String(w)));
  results.push({
    id: "B1",
    label: "Diagnosis '이수율 0%' 약점 미포함 (prospective 프레임)",
    passed: !hasRatioZero,
    detail: `overall=${latest?.overall_grade ?? "없음"} direction=${latest?.direction_strength ?? "없음"} · weaknesses ${ws.length}건 · '이수율 0%' 포함=${hasRatioZero}`,
  });

  // ── B5: Strategy Bridge 대응 (한국어 "정합성 분석"/"bridge" 인용) ──
  const { data: strategies } = await supabase
    .from("student_record_strategies")
    .select("reasoning, strategy_content")
    .eq("student_id", STUDENT_ID);

  const bridgeMentions = (strategies ?? []).filter((s) => {
    const reason = String(s.reasoning ?? "");
    const content = String(s.strategy_content ?? "");
    const combined = reason + " " + content;
    return /bridge|정합성\s*분석|bridge\s*제안/i.test(combined);
  });
  results.push({
    id: "B5",
    label: "Strategy reasoning 중 'Bridge/정합성' 언급 포함",
    passed: bridgeMentions.length >= 1,
    detail: `총 ${strategies?.length ?? 0}건 중 Bridge/정합성 언급 ${bridgeMentions.length}건`,
  });

  // ── C2: projected hyperedge ──
  const { data: anHyperedges } = await supabase
    .from("student_record_hyperedges")
    .select("edge_context")
    .eq("student_id", STUDENT_ID)
    .in("edge_context", ["analysis", "projected"])
    .eq("is_stale", false);

  const hasAnyContent = (anHyperedges?.length ?? 0) > 0;
  results.push({
    id: "C2",
    label: "hyperedge analysis 또는 projected 생성됨",
    passed: hasAnyContent,
    detail: `analysis/projected 하이퍼엣지 ${anHyperedges?.length ?? 0}건`,
  });

  // ── A2: haengteuk_linking 타임아웃 (task_results 컬럼 사용) ──
  const { data: synthPipes } = await supabase
    .from("student_record_analysis_pipelines")
    .select("id, task_results, started_at")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis");
  const latestSynth = (synthPipes ?? [])
    .filter((p) => p.started_at)
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];

  const linkingResult =
    ((latestSynth?.task_results as Record<string, unknown> | null)?.["haengteuk_linking"] as
      | { elapsedMs?: number }
      | null
      | undefined) ?? null;
  const elapsed = linkingResult?.elapsedMs ?? -1;
  results.push({
    id: "A2",
    label: "haengteuk_linking 150s 이내 완료",
    passed: elapsed > 0 && elapsed < 150_000,
    detail: `elapsedMs=${elapsed}`,
  });

  // ── C3: Roadmap blueprint 테마 반영 (rationale 컬럼 없음 — plan_content/plan_keywords 사용) ──
  const { data: roadmap } = await supabase
    .from("student_record_roadmap_items")
    .select("plan_content, plan_keywords")
    .eq("student_id", STUDENT_ID);

  const bpThemes = (bpHyperedges ?? [])
    .map((he) => String(he.theme_label).replace(/\s*수렴$/, "").split(/[·\s]+/))
    .flat()
    .filter((k) => k.length >= 2);

  const matchingRoadmap = (roadmap ?? []).filter((r) => {
    const content = String(r.plan_content ?? "");
    const keywords = ((r.plan_keywords as string[] | null) ?? []).join(" ");
    const haystack = content + " " + keywords;
    return bpThemes.some((theme) => haystack.includes(theme));
  });
  results.push({
    id: "C3",
    label: "Roadmap 에 Blueprint 테마 반영",
    passed: matchingRoadmap.length >= 1,
    detail: `로드맵 ${roadmap?.length ?? 0}건 중 blueprint 테마 매칭 ${matchingRoadmap.length}건`,
  });

  // ── 결과 출력 ──
  console.log(`\n🧪 인제고 1학년 Synthesis 재실행 검증 결과\n`);
  console.log("=".repeat(70));
  const pass = results.filter((r) => r.passed).length;
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} [${r.id}] ${r.label}`);
    console.log(`     ${r.detail}`);
  }
  console.log("=".repeat(70));
  console.log(`\n결과: ${pass}/${results.length} 통과\n`);
}

main().catch((err) => {
  console.error("❌ unhandled:", err);
  process.exit(1);
});
