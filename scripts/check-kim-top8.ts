#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

(async () => {
  const sb = createSupabaseAdminClient()!;

  // 1. content_quality 분포 (G1/G2 분석 레코드 수)
  const { data: quals } = await sb
    .from("student_record_content_quality")
    .select("record_id, record_type, grade, overall_score, issues, source")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .in("source", ["ai"])
    .order("grade", { ascending: true });

  console.log("== content_quality 분포 (analysis source) ==");
  const byGrade: Record<number, any[]> = {};
  for (const q of quals ?? []) {
    if (q.grade == null) continue;
    if (!byGrade[q.grade]) byGrade[q.grade] = [];
    byGrade[q.grade].push(q);
  }
  for (const [g, rows] of Object.entries(byGrade)) {
    const withIssues = rows.filter((r) => Array.isArray(r.issues) && r.issues.length > 0);
    console.log(`G${g}: total=${rows.length}, with_issues=${withIssues.length}`);
    rows.sort((a, b) => a.overall_score - b.overall_score);
    for (const r of rows.slice(0, 10)) {
      const iss = Array.isArray(r.issues) ? r.issues.slice(0, 2).join(",") : "";
      console.log(`  ${r.record_id.slice(0,8)} ${r.record_type} score=${r.overall_score} issues=[${iss}]`);
    }
  }

  // 2. Grade pipelines _midPlan 직접 확인 (Top-8 적용 결과)
  const { data: pipes } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, grade, mode, status, completed_at, task_results")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("pipeline_type", "grade")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(5);

  console.log("\n== Grade pipelines _midPlan 상세 ==");
  for (const p of pipes ?? []) {
    const tr = (p.task_results ?? {}) as Record<string, any>;
    const mp = tr._midPlan;
    if (!mp) {
      console.log(`G${p.grade} mode=${p.mode}: no _midPlan`);
      continue;
    }
    const overrides = mp.recordPriorityOverride ?? {};
    console.log(`\nG${p.grade} mode=${p.mode} (${p.id.slice(0,8)}, completed ${p.completed_at?.slice(0,16)})`);
    console.log(`  focusHypothesis: ${mp.focusHypothesis?.slice(0, 150)}`);
    console.log(`  recordPriorityOverride: ${Object.keys(overrides).length}건`);
    for (const [k, v] of Object.entries(overrides)) console.log(`    ${k}: ${v}`);
    console.log(`  concernFlags: ${(mp.concernFlags ?? []).length}`);
    if (mp.rationale) {
      console.log(`  rationale (${mp.rationale.length}건):`);
      for (const r of mp.rationale.slice(0, 3)) console.log(`    - ${r.slice(0, 120)}`);
    }

    // _analysisContext 에서 allRecordSummaries 확인
    const ac = tr._analysisContext;
    if (ac && ac[p.grade!]) {
      const all = ac[p.grade!].allRecordSummaries ?? [];
      const qi = ac[p.grade!].qualityIssues ?? [];
      console.log(`  analysisContext.allRecordSummaries: ${all.length}건 (qualityIssues: ${qi.length}건)`);
      console.log(`  ac keys: ${Object.keys(ac[p.grade!])}`);
      if (all.length > 0) {
        console.log(`  sample allRecordSummaries[0]:`, JSON.stringify(all[0]).slice(0,200));
      }
      // Top 5 by score
      all.sort((a: any, b: any) => a.overallScore - b.overallScore);
      for (const r of all.slice(0, 8)) {
        console.log(`    ${r.recordId.slice(0,8)} ${r.recordType} score=${r.overallScore} issues=[${(r.issues ?? []).slice(0,2).join(",")}]`);
      }
    }
  }
})();
