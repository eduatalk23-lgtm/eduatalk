// ============================================
// pipeline/slots/shadow-run.ts
//
// Step 2.1 Shadow run wiring helper.
// runGuideMatching 진입부에서 호출되며, ctx.belief에서 입력을 모아
// generateSlots 호출 → ctx.previews + ctx.results 박제.
//
// **매칭 로직 변경 없음**. 결과는 Step 2.2부터 매칭이 소비.
// 어떤 에러도 매칭 파이프라인을 중단시키지 않음 (graceful).
// ============================================

import { generateSlots } from "./slot-generator";
import type {
  Slot,
  SlotDifficulty,
  SlotGeneratorInput,
  MidPlanShape,
} from "./types";
import { logActionWarn } from "@/lib/logging/actionLogger";

const LOG_CTX = "[slot-shadow-run]";

interface ShadowRunCtx {
  studentId: string;
  tenantId: string;
  studentGrade: number | null;
  belief: {
    cascadePlan?: import("../../capability/cascade-plan").CascadePlan;
    mainTheme?: import("../../capability/main-theme").MainTheme;
    midPlanByGrade?: Record<number, MidPlanShape | null | undefined>;
  };
  coursePlanData?:
    | import("@/lib/domains/student-record/course-plan/types").CoursePlanTabData
    | null;
  results: Record<string, unknown>;
  previews: Record<string, string>;
}

function buildCoursePlanByGrade(
  data: ShadowRunCtx["coursePlanData"],
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  if (!data?.plans) return out;
  for (const plan of data.plans) {
    const g = plan.grade;
    if (!g) continue;
    const name = plan.subject?.name;
    if (!name) continue;
    if (!out[g]) out[g] = [];
    if (!out[g].includes(name)) out[g].push(name);
  }
  return out;
}

function buildMaxDifficulty(
  ctx: ShadowRunCtx,
): Record<number, SlotDifficulty> {
  // Step 2.1: leveling 통합은 Step 2.2 이후. 일단 모든 학년 advanced 허용.
  // 후속 작업에서 ctx.leveling.maxDifficultyByGrade로 교체 예정.
  void ctx;
  return { 1: "advanced", 2: "advanced", 3: "advanced" };
}

function buildMainThemeKeywords(
  belief: ShadowRunCtx["belief"],
): string[] {
  const out = new Set<string>();
  const mt = belief.mainTheme;
  if (!mt) return [];
  if (mt.themeLabel) out.add(mt.themeLabel);
  if (Array.isArray(mt.themeKeywords)) {
    for (const k of mt.themeKeywords) if (k) out.add(k);
  }
  return Array.from(out);
}

function buildCareerCompatibility(
  belief: ShadowRunCtx["belief"],
): string[] {
  const mt = belief.mainTheme;
  if (!mt?.careerField) return [];
  return [mt.careerField];
}

/**
 * Shadow run 진입점.
 * runGuideMatching 진입부에서 단 1회 호출. 어떤 에러도 throw 안 함.
 */
export async function runSlotGeneratorShadow(ctx: ShadowRunCtx): Promise<void> {
  try {
    const cascadePlan = ctx.belief.cascadePlan ?? null;
    const blueprint =
      (ctx.results["_blueprint"] as
        | import("../../blueprint/types").BlueprintPhaseOutput
        | undefined) ?? null;
    const blueprintId =
      (ctx.results["_blueprintId"] as string | undefined) ?? null;
    const tierPlan =
      (ctx.results["_tierPlan"] as
        | import("@/lib/domains/student-record/repository/main-exploration-repository").MainExplorationTierPlan
        | undefined) ?? null;

    const input: SlotGeneratorInput = {
      studentId: ctx.studentId,
      tenantId: ctx.tenantId,
      currentGrade: ctx.studentGrade ?? null,
      blueprint,
      blueprintId,
      cascadePlan,
      tierPlan,
      midPlanByGrade: ctx.belief.midPlanByGrade ?? {},
      coursePlanByGrade: buildCoursePlanByGrade(ctx.coursePlanData ?? null),
      // Step 2.1: weak/issues 통합은 Step 2.2 이후. 일단 빈 배열.
      weakCompetenciesByGrade: {},
      qualityIssuesByGrade: {},
      maxDifficultyByGrade: buildMaxDifficulty(ctx),
      careerCompatibility: buildCareerCompatibility(ctx.belief),
      mainThemeKeywords: buildMainThemeKeywords(ctx.belief),
    };

    const out = generateSlots(input);

    // 영속 — 측정 + Step 2.2 소비용
    ctx.results["_slots"] = out.slots as unknown as Record<string, unknown>;
    ctx.previews["slot_generation_v2"] = JSON.stringify({
      version: "v2.0",
      stats: out.generationStats,
      warnings: out.warnings,
      // 디버깅용 — 슬롯 ID + grade + area + tier + priority + expectedCount만 (full slot은 results에 있음)
      slotsSummary: out.slots
        .slice(0, 60)
        .map((s: Slot) => ({
          id: s.id,
          grade: s.grade,
          area: s.area,
          subarea: s.subareaKey,
          tier: s.tier,
          priority: s.state.priority,
          expected: s.state.expectedCount,
        })),
    });
  } catch (err) {
    // 어떤 이유로든 실패해도 매칭 진행 — Shadow run의 핵심 원칙.
    logActionWarn(LOG_CTX, "slot generator shadow run 실패 — graceful skip", {
      error: err instanceof Error ? err.message : String(err),
    });
    ctx.previews["slot_generation_v2"] = JSON.stringify({
      version: "v2.0",
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
