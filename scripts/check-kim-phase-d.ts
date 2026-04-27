#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const STUDENT_ID = "0e3e149d-4b9c-402d-ad5c-b3df04190889";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";

(async () => {
  const sb = createSupabaseAdminClient()!;

  const { data: cards, error: ce } = await sb
    .from("student_record_profile_cards")
    .select("*")
    .eq("student_id", STUDENT_ID);
  if (ce) console.log("err:", ce);
  console.log(`== D1 profile_cards == count=${cards?.length ?? 0}`);
  for (const c of cards ?? []) {
    console.log(`G${c.target_grade}/${c.source}: strengths=${(c.persistent_strengths ?? []).length}, weaknesses=${(c.persistent_weaknesses ?? []).length}, themes=${(c.cross_grade_themes ?? []).length}, narrative=${c.interest_consistency ? "yes" : "no"} hash=${c.content_hash?.slice(0,8)}`);
  }

  const { data: pipes } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, pipeline_type, mode, grade, status, completed_at, task_results")
    .eq("student_id", STUDENT_ID)
    .eq("tenant_id", TENANT_ID)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(10);

  console.log("\n== D2 gradeThemes + D3 _midPlan per grade ==");
  for (const p of pipes ?? []) {
    if (p.pipeline_type !== "grade") continue;
    const tr = (p.task_results ?? {}) as Record<string, any>;
    const theme = tr.cross_subject_theme_extraction;
    const midPlan = tr._midPlan;
    const dom = theme?.dominantThemeIds ?? [];
    const labels = (theme?.themes ?? [])
      .filter((t: any) => dom.includes(t.id))
      .map((t: any) => t.label);
    console.log(`G${p.grade} mode=${p.mode}: themes=${theme?.themes?.length ?? 0} dominant=[${labels.join(", ")}] _midPlan=${midPlan ? "YES" : "NO"}`);
    if (midPlan) {
      const focus = midPlan.focusHypothesis;
      const overrideKeys = midPlan.recordPriorityOverride ? Object.keys(midPlan.recordPriorityOverride) : [];
      const concerns = midPlan.concernFlags ?? [];
      console.log(`   focusHypothesis: ${focus ? focus.slice(0, 120) : "none"}`);
      console.log(`   recordPriorityOverride: ${overrideKeys.length} entries [${overrideKeys.slice(0,3).join(", ")}]`);
      console.log(`   concernFlags: ${concerns.length}`);
    }
  }

  const { data: synthRows, error: serr } = await sb
    .from("student_record_analysis_pipelines")
    .select("id, status, completed_at, task_results, pipeline_type")
    .eq("student_id", STUDENT_ID)
    .eq("pipeline_type", "synthesis")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(3);
  console.log("\nsynthRows count:", synthRows?.length, "err:", serr?.message);
  for (const sr of synthRows ?? []) console.log("  synth", sr.id, sr.status, sr.completed_at);
  const synth = synthRows?.[0];
  if (synth) {
    const tr = (synth.task_results ?? {}) as Record<string, any>;
    console.log("\n== Synthesis pipelineId =", synth.id, "==");
    console.log("ai_diagnosis qualityPatterns =", Array.isArray(tr.ai_diagnosis?.qualityPatterns) ? tr.ai_diagnosis.qualityPatterns.length : "N/A");
    console.log("interview questions =", Array.isArray(tr.interview_generation?.questions) ? tr.interview_generation.questions.length : "N/A");
    console.log("roadmap semesters =", Array.isArray(tr.roadmap_generation?.semesters) ? tr.roadmap_generation.semesters.length : tr.roadmap_generation ? Object.keys(tr.roadmap_generation).length : "N/A");
    console.log("ai_strategy suggestions =", Array.isArray(tr.ai_strategy?.suggestions) ? tr.ai_strategy.suggestions.length : "N/A");
  }
})();
