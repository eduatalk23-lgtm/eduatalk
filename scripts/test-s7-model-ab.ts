#!/usr/bin/env npx tsx
/**
 * S7 tier_plan_refinement 모델 A/B 측정 (xrun-seed-01).
 *
 * 동일한 입력(v1 main_exploration + 현 DB 의 진단/전략/로드맵/qualityPatterns)으로
 * 여러 LLM 모델의 jaccard 출력을 비교. DB 쓰기 없음 — 측정 전용.
 *
 * 사용:
 *   npx tsx scripts/test-s7-model-ab.ts fast
 *   npx tsx scripts/test-s7-model-ab.ts advanced
 *   LLM_MODEL_OVERRIDE=gpt-5.4 npx tsx scripts/test-s7-model-ab.ts advanced
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const ARG_TIER = (process.argv[2] || "fast") as "fast" | "standard" | "advanced";
if (!["fast", "standard", "advanced"].includes(ARG_TIER)) {
  console.error(`❌ tier must be fast|standard|advanced, got: ${ARG_TIER}`);
  process.exit(1);
}
process.env.LLM_TIER_OVERRIDE = ARG_TIER;

const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001";
const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015";
const V1_MAIN_ID = "156ad6d3-76e9-4571-88f2-2a8e5110aa9e";

async function main() {
  const { createSupabaseAdminClient } = await import("../lib/supabase/admin");
  const { generateTextWithRateLimit } = await import("../lib/domains/record-analysis/llm/ai-client");
  const {
    TIER_PLAN_REFINEMENT_SYSTEM_PROMPT,
    buildTierPlanRefinementUserPrompt,
    parseTierPlanRefinementResponse,
  } = await import("../lib/domains/record-analysis/llm/prompts/tierPlanRefinement");
  const {
    compareTierPlans,
    DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD,
  } = await import("../lib/domains/record-analysis/blueprint/tier-plan-similarity");
  const { judgeTierPlanConvergence } = await import("../lib/domains/record-analysis/llm/actions/judgeTierPlanConvergence");
  const { MAJOR_TO_TIER1 } = await import("../lib/constants/career-classification");
  const { calculateSchoolYear } = await import("../lib/utils/schoolYear");

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  // ── 1. v1 main_exploration 로드 (current 으로 사용) ──
  const { data: v1, error: v1Err } = await supabase
    .from("student_main_explorations")
    .select("id, theme_label, theme_keywords, tier_plan, school_year, grade, semester, career_field")
    .eq("id", V1_MAIN_ID)
    .single();
  if (v1Err || !v1) throw v1Err ?? new Error("v1 not found");

  // ── 2. 학생 진로 정보 ──
  const { data: student } = await supabase
    .from("students")
    .select("grade, target_major, target_major_2")
    .eq("id", STUDENT_ID)
    .single();
  if (!student?.target_major) throw new Error("target_major 없음");

  const targetMajor = student.target_major as string;
  const targetMajor2 = (student.target_major_2 as string | null) ?? null;
  const tier1Code = MAJOR_TO_TIER1[targetMajor] ?? "";
  const currentGrade = ((student.grade ?? 1) as 1 | 2 | 3);

  // ── 3. Synthesis 산출물 (S3/S5/S6 결과) ──
  const currentSchoolYear = calculateSchoolYear();

  const [diagRes, stratRes, roadmapRes] = await Promise.all([
    supabase
      .from("student_record_diagnosis")
      .select("weaknesses")
      .eq("student_id", STUDENT_ID).eq("tenant_id", TENANT_ID).eq("scope", "overall")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("student_record_strategies")
      .select("strategy_content, priority, target_area")
      .eq("student_id", STUDENT_ID).eq("tenant_id", TENANT_ID).eq("school_year", currentSchoolYear)
      .order("updated_at", { ascending: false }).limit(5),
    supabase
      .from("student_record_roadmap_items")
      .select("grade, semester, area, plan_content")
      .eq("student_id", STUDENT_ID).eq("tenant_id", TENANT_ID)
      .order("grade", { ascending: true }).order("semester", { ascending: true }).limit(5),
  ]);

  const diagnosisWeaknesses = ((diagRes.data?.weaknesses as string[] | null) ?? []).slice(0, 5);
  const strategyHighlights = ((stratRes.data ?? []) as Array<{
    strategy_content: string; priority: string | null; target_area: string;
  }>).map((s) => `[${s.priority ?? "-"}·${s.target_area}] ${s.strategy_content.trim().slice(0, 120)}`)
    .filter((s) => s.length > 0);
  const roadmapHighlights = ((roadmapRes.data ?? []) as Array<{
    grade: number; semester: number | null; area: string; plan_content: string;
  }>).map((r) => `${r.grade}학년 ${r.semester ?? "-"}학기 ${r.area}: ${r.plan_content.trim().slice(0, 80)}`)
    .filter((s) => s.length > 0);

  // ── 4. qualityPatterns (S3 task_results 에서 복원) ──
  const { data: pip } = await supabase
    .from("student_record_analysis_pipelines")
    .select("task_results")
    .eq("student_id", STUDENT_ID).eq("pipeline_type", "synthesis")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  const diagResult = (pip?.task_results as Record<string, unknown> | null)?.ai_diagnosis as
    | { qualityPatterns?: Array<{ pattern: string; count: number; subjects: string[] }> } | undefined;
  const qualityPatterns = (diagResult?.qualityPatterns ?? []).slice(0, 5)
    .map((p) => `${p.pattern} (${p.count}회, 과목: ${p.subjects.join(", ")})`);

  // ── 5. 입력 요약 출력 ──
  const modelOverride = process.env.LLM_MODEL_OVERRIDE;
  const provider = process.env.LLM_PROVIDER_OVERRIDE ?? "gemini";
  console.log(`▶ S7 A/B test`);
  console.log(`  tier=${ARG_TIER} provider=${provider}${modelOverride ? ` modelOverride=${modelOverride}` : ""}`);
  console.log(`  diagnosisWeaknesses=${diagnosisWeaknesses.length} strategies=${strategyHighlights.length} roadmap=${roadmapHighlights.length} qualityPatterns=${qualityPatterns.length}`);
  console.log(`  v1 themeLabel="${v1.theme_label}" tier_plan keys=foundational/development/advanced`);

  // ── 6. LLM 호출 (직접) ──
  const tierPlanInput = {
    currentThemeLabel: v1.theme_label as string,
    currentThemeKeywords: (v1.theme_keywords as string[] | null) ?? [],
    currentTierPlan: v1.tier_plan as Parameters<typeof buildTierPlanRefinementUserPrompt>[0]["currentTierPlan"],
    targetMajor,
    targetMajor2,
    tier1Code,
    currentGrade,
    strategyHighlights,
    roadmapHighlights,
    qualityPatterns,
    diagnosisWeaknesses,
  };

  const userPrompt = buildTierPlanRefinementUserPrompt(tierPlanInput);

  const t0 = Date.now();
  const result = await generateTextWithRateLimit({
    system: TIER_PLAN_REFINEMENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: ARG_TIER,
    temperature: 0.3,
    maxTokens: 2400,
    responseFormat: "json",
  });
  const elapsedMs = Date.now() - t0;

  if (!result.content) {
    console.error("❌ AI 응답이 비어있습니다.");
    process.exit(1);
  }

  // ── 7. 파싱 + 비교 ──
  const parsed = parseTierPlanRefinementResponse(result.content);
  const similarity = compareTierPlans(
    v1.tier_plan as Parameters<typeof compareTierPlans>[0],
    parsed.tierPlan as Parameters<typeof compareTierPlans>[1],
    { threshold: DEFAULT_TIER_PLAN_CONVERGENCE_THRESHOLD },
  );

  console.log(`\n📊 [suggestion] 결과:`);
  console.log(`  modelId=${result.modelId ?? "?"} elapsed=${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  tokens: in=${result.usage?.inputTokens ?? "?"} out=${result.usage?.outputTokens ?? "?"}`);
  console.log(`  newThemeLabel = "${parsed.themeLabel}"`);

  console.log(`\n📊 [jaccard telemetry — 판정엔 사용 안 함]`);
  console.log(`  jaccardOverall = ${similarity.overall.toFixed(4)}`);
  console.log(`  byTier: foundational=${similarity.byTier.foundational.toFixed(4)} development=${similarity.byTier.development.toFixed(4)} advanced=${similarity.byTier.advanced.toFixed(4)}`);
  console.log(`  (구식) jaccard 판정 = ${similarity.converged ? "converged" : "refined"}`);

  // ── 8. LLM-judge 호출 (Sprint 4 신규) ──
  console.log(`\n📊 [LLM-judge — 신규 판정 로직]`);
  const judgeT0 = Date.now();
  const judge = await judgeTierPlanConvergence({
    targetMajor,
    targetMajor2,
    currentGrade,
    currentThemeLabel: v1.theme_label as string,
    proposedThemeLabel: parsed.themeLabel,
    currentTierPlan: v1.tier_plan as Parameters<typeof judgeTierPlanConvergence>[0]["currentTierPlan"],
    proposedTierPlan: parsed.tierPlan,
  });
  const judgeElapsedMs = Date.now() - judgeT0;

  if (!judge.success) {
    console.log(`  ❌ judge 실패: ${judge.error} (${(judgeElapsedMs / 1000).toFixed(1)}s)`);
  } else {
    console.log(`  judgeModel=${judge.modelName ?? "?"} elapsed=${(judgeElapsedMs / 1000).toFixed(1)}s`);
    console.log(`  tokens: in=${judge.usage?.inputTokens ?? "?"} out=${judge.usage?.outputTokens ?? "?"}`);
    console.log(`  ▶ verdict        = ${judge.data.verdict}`);
    console.log(`  ▶ reasoning      = ${judge.data.reasoning}`);
    console.log(`  ▶ deltaCategories = [${judge.data.deltaCategories.join(", ")}]`);
    console.log(`  ▶ converged       = ${judge.converged}`);
    console.log(`  ▶ (신규) action   = ${judge.converged ? "converged" : "refined"}`);
  }

  console.log(`\n--- new tier_plan summary ---`);
  for (const tier of ["foundational", "development", "advanced"] as const) {
    const t = parsed.tierPlan[tier];
    console.log(`  [${tier}] theme="${t.theme}"`);
    console.log(`     activities(${t.suggested_activities.length}): ${t.suggested_activities.map((a) => a.slice(0, 30)).join(" | ")}`);
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.stack : e);
  process.exit(1);
});
