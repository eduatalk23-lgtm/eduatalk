#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { loadSynthesisCumulativeBelief } from "../lib/domains/record-analysis/pipeline/pipeline-synthesis-belief";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

(async () => {
  const sb = createSupabaseAdminClient()!;
  const seeded = await loadSynthesisCumulativeBelief(sb, STUDENT_ID, TENANT_ID, "test-pid");

  console.log("== loadSynthesisCumulativeBelief output ==\n");
  console.log("D1 profileCard:");
  if (seeded.profileCard) {
    console.log(`  length=${seeded.profileCard.length} chars`);
    console.log("  preview:", seeded.profileCard.slice(0, 300).replace(/\n/g, " | "));
  } else {
    console.log("  (undefined — DEAD)");
  }

  console.log("\nD2 gradeThemesByGrade:");
  if (seeded.gradeThemesByGrade) {
    for (const [grade, data] of Object.entries(seeded.gradeThemesByGrade)) {
      const dom = data.dominantThemeIds.length;
      const labels = data.themes.filter((t) => data.dominantThemeIds.includes(t.id)).map((t) => t.label);
      console.log(`  G${grade}: themes=${data.themes.length} dominant=[${labels.join(", ")}]`);
    }
  } else {
    console.log("  (undefined — DEAD)");
  }

  console.log("\nD3 midPlan (단일, 최신 학년):");
  if (seeded.midPlan) {
    console.log("  focusHypothesis:", seeded.midPlan.focusHypothesis?.slice(0, 120) ?? "none");
    console.log("  recordPriorityOverride keys:", Object.keys(seeded.midPlan.recordPriorityOverride ?? {}).length);
    console.log("  concernFlags:", (seeded.midPlan.concernFlags ?? []).length);
  } else {
    console.log("  (null/undefined — DEAD)");
  }

  console.log("\n격차 1 — midPlanByGrade (다학년 통합):");
  if (seeded.gradeThemesByGrade && seeded.midPlan) {
    // seeded 는 SynthesisCumulativeBelief 타입이지만 midPlanByGrade 가 거기 없음.
    // belief 에 들어가는지 별도 확인 필요 — 방금 가져온 seeded 는 partial. ctx.belief 에는 들어감.
  }
  const seededAny = seeded as unknown as { midPlanByGrade?: Record<number, any> };
  if (seededAny.midPlanByGrade) {
    for (const [g, mp] of Object.entries(seededAny.midPlanByGrade)) {
      const overrides = Object.keys(mp.recordPriorityOverride ?? {}).length;
      console.log(`  G${g}: focusHypothesis=${(mp.focusHypothesis ?? "").slice(0,80)}... / override ${overrides}건 / concern ${(mp.concernFlags ?? []).length}건`);
    }
  } else {
    console.log("  (undefined — midPlanByGrade 시딩 안 됨)");
  }
})();
