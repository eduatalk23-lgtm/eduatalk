#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";

(async () => {
  const sb = createSupabaseAdminClient()!;

  // S2-guide-match 출력 — 학생에게 배정된 가이드들의 ranking 정보
  const { data: synth } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, completed_at, task_results")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (!synth?.[0]) { console.log("synth pipeline 없음"); return; }
  const tr = (synth[0].task_results ?? {}) as Record<string, any>;
  const gm = tr.guide_matching;
  if (!gm) { console.log("guide_matching task_result 없음"); return; }

  console.log("=== guide_matching task_result keys ===");
  console.log(Object.keys(gm));

  // 다양한 path 로 확인
  const candidates = [gm.assignments, gm.ranked, gm.poolRanked, gm.guides, gm.matched];
  let assignments: any[] = [];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) { assignments = c; break; }
  }

  // 직접 student_record_assignments 도 확인
  const { data: assign } = await sb
    .from("student_guide_assignments")
    .select("guide_id, match_reason, score_breakdown, final_score")
    .eq("student_id", STUDENT_ID)
    .order("created_at", { ascending: false })
    .limit(20);
  console.log(`\n=== student_guide_assignments (recent 20) ===`);
  console.log("count:", assign?.length);
  if (assign?.[0]) console.log("sample keys:", Object.keys(assign[0]));

  // midPlanBonus 가 있는 row 찾기
  let withBonus = 0;
  let withoutBonus = 0;
  let nonOneBonus = 0;
  for (const a of assign ?? []) {
    const sb_ = a.score_breakdown as any;
    if (!sb_) continue;
    if ("midPlanBonus" in sb_) {
      withBonus++;
      if (sb_.midPlanBonus !== 1.0 && sb_.midPlanBonus !== 1) nonOneBonus++;
    } else withoutBonus++;
  }
  console.log(`midPlanBonus 필드 있음: ${withBonus}건, 없음: ${withoutBonus}건, 1.0이 아닌(active): ${nonOneBonus}건`);

  // 1.10 적용된 가이드 출력
  console.log("\n=== midPlanBonus active (>1.0) 가이드 ===");
  for (const a of (assign ?? []).slice(0, 20)) {
    const sb_ = a.score_breakdown as any;
    if (sb_?.midPlanBonus && sb_.midPlanBonus !== 1.0 && sb_.midPlanBonus !== 1) {
      console.log(`  guide=${(a.guide_id as string).slice(0,8)} bonus=${sb_.midPlanBonus} final=${a.final_score}`);
    }
  }
})();
