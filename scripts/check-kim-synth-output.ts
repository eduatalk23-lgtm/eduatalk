#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

(async () => {
  const sb = createSupabaseAdminClient()!;

  const { data } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, completed_at, task_results")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(2);

  for (const p of data ?? []) {
    const tr = (p.task_results ?? {}) as Record<string, any>;
    console.log(`\n=== Synthesis ${p.id.slice(0,8)} (${p.completed_at?.slice(0,16) ?? "running"}) ===`);

    // 1. ai_diagnosis 본문 — G1 키워드 grep
    const diag = tr.ai_diagnosis;
    if (diag) {
      const text = JSON.stringify(diag);
      const g1Keywords = ["사회적 책임", "리더십", "우주 탐사", "우주 탐구"];
      const g2Keywords = ["비판적 사고", "데이터 분석", "사회적 이슈"];
      console.log("\n[ai_diagnosis 키워드 hit]");
      for (const kw of g1Keywords) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  G1: ${kw} × ${count}`);
      }
      for (const kw of g2Keywords) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  G2: ${kw} × ${count}`);
      }
    }

    // 2. ai_strategy
    const strat = tr.ai_strategy;
    if (strat) {
      const text = JSON.stringify(strat);
      const g1Keywords = ["사회적 책임", "리더십", "우주 탐사", "우주 탐구"];
      const g2Keywords = ["비판적 사고", "데이터 분석", "사회적 이슈"];
      console.log("\n[ai_strategy 키워드 hit]");
      for (const kw of g1Keywords) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  G1: ${kw} × ${count}`);
      }
      for (const kw of g2Keywords) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  G2: ${kw} × ${count}`);
      }
    }

    // 3. interview / roadmap
    const iv = tr.interview_generation;
    const rm = tr.roadmap_generation;
    if (iv) {
      const text = JSON.stringify(iv);
      const g1 = ["사회적 책임", "리더십", "우주 탐사"];
      const g2 = ["비판적 사고", "데이터 분석", "사회적 이슈"];
      console.log("\n[interview_generation 키워드 hit]");
      for (const kw of [...g1, ...g2]) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  ${kw} × ${count}`);
      }
    }
    if (rm) {
      const text = JSON.stringify(rm);
      const g1 = ["사회적 책임", "리더십", "우주 탐사"];
      const g2 = ["비판적 사고", "데이터 분석", "사회적 이슈"];
      console.log("\n[roadmap_generation 키워드 hit]");
      for (const kw of [...g1, ...g2]) {
        const count = (text.match(new RegExp(kw, "g")) ?? []).length;
        if (count > 0) console.log(`  ${kw} × ${count}`);
      }
    }
  }
})();
