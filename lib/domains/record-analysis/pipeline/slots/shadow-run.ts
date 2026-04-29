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
  /** G1 fix (2026-04-29): synthesis pipeline 에서 ctx.belief.analysisContext 가 미시드된 경우
   * weakCompetencies/qualityIssues 를 DB 에서 직접 회수하기 위해 주입. */
  supabase?: import("../pipeline-types").PipelineContext["supabase"];
  belief: {
    cascadePlan?: import("../../capability/cascade-plan").CascadePlan;
    mainTheme?: import("../../capability/main-theme").MainTheme;
    midPlanByGrade?: Record<number, MidPlanShape | null | undefined>;
    analysisContext?: import("../pipeline-types").AnalysisContextByGrade;
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

/**
 * adequateLevel(L1~5) → SlotDifficulty 매핑.
 *
 * Slot tier 와 동일 의미축(foundational/development/advanced) 으로 정렬:
 *   L1, L2 → basic         (lower / general 권역, 기초 다지기)
 *   L3     → intermediate  (mid 권역, 발전형)
 *   L4, L5 → advanced      (top 권역, 심화)
 *
 * G3 fix (2026-04-29): 학년별 점진 차등 보정.
 * top 권역 학생도 1학년에 advanced 가이드를 곧바로 받는 건 비현실적.
 * 1학년 = 기초 다지기 / 2학년 = 발전 / 3학년 = 심화 라는 학종 컨설팅 통념을 반영.
 *   1학년: 산출 cap 한 단계 낮춤 (advanced → intermediate, intermediate → basic)
 *   2학년: 그대로 유지
 *   3학년: 입시 임박 → adequateLevel 의 grade=3 보정이 이미 적용됨, 그대로
 */
function adequateLevelToDifficulty(
  level: import("@/lib/domains/student-record/leveling").DifficultyLevel,
  grade: number,
): SlotDifficulty {
  const baseDifficulty: SlotDifficulty =
    level <= 2 ? "basic" : level === 3 ? "intermediate" : "advanced";
  if (grade === 1) {
    if (baseDifficulty === "advanced") return "intermediate";
    if (baseDifficulty === "intermediate") return "basic";
  }
  return baseDifficulty;
}

/**
 * 학년별 난이도 cap 산출.
 *
 * `computeLevelingForStudent` 는 학년 1 회 호출당 학생 row + projected scores 조회.
 * 학년 3개 병렬 호출 (Promise.all). 어느 학년이라도 실패 시 advanced 폴백.
 *
 * Hard filter (slot-aware-score) 가 strict tier 슬롯에서만 cap 차단을 발동하므로
 * 폴백 advanced 는 안전 기본값(과차단 회피).
 */
export async function buildMaxDifficultyByGradeAsync(
  studentId: string,
  tenantId: string,
): Promise<Record<number, SlotDifficulty>> {
  try {
    const { computeLevelingForStudent } = await import(
      "@/lib/domains/student-record/leveling"
    );
    const grades = [1, 2, 3] as const;
    const results = await Promise.all(
      grades.map((g) =>
        computeLevelingForStudent({ studentId, tenantId, grade: g }).catch(
          () => null,
        ),
      ),
    );
    const out: Record<number, SlotDifficulty> = {};
    for (let i = 0; i < grades.length; i++) {
      const r = results[i];
      out[grades[i]] = r ? adequateLevelToDifficulty(r.adequateLevel, grades[i]) : "advanced";
    }
    return out;
  } catch {
    // graceful — leveling 모듈 자체 실패 시 advanced 폴백 (과차단 회피).
    return { 1: "advanced", 2: "advanced", 3: "advanced" };
  }
}

/**
 * 학년별 약점 역량(B- 이하) 추출.
 *
 * 소스 (2 단계):
 *   1차: ctx.belief.analysisContext (P1-P3 grade pipeline 산출 → 같은 ctx 내).
 *        `pipeline-task-runners-shared.ts` 가 이미 B-/C 만 필터해 누적.
 *   2차 (G1 fix, 2026-04-29): synthesis pipeline 같이 belief 가 reseed 안 된 경우
 *        DB 직접 조회. competency_scores AI 산출 행에서 학년별 B-/C 추출.
 *
 * 둘 다 빈 결과면 빈 객체 반환 — Slot Generator 가 weakCompetencies=[] 슬롯으로 정상 동작.
 */
async function buildWeakCompetenciesByGrade(
  ctx: ShadowRunCtx,
): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};

  // 1차 — ctx.belief.analysisContext
  const ac = ctx.belief.analysisContext;
  if (ac) {
    for (const [gradeKey, gradeCtx] of Object.entries(ac)) {
      const grade = Number(gradeKey);
      if (!Number.isFinite(grade)) continue;
      if (!gradeCtx?.weakCompetencies?.length) continue;
      const items = new Set<string>();
      for (const wc of gradeCtx.weakCompetencies) {
        if (wc.item) items.add(wc.item);
      }
      if (items.size > 0) out[grade] = Array.from(items);
    }
  }
  if (Object.keys(out).length > 0) return out;

  // 2차 — DB fallback (synthesis pipeline 등 belief 미시드 환경)
  if (!ctx.supabase || !ctx.studentId || ctx.studentGrade == null) return out;
  try {
    const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
    const currentSchoolYear = calculateSchoolYear();
    const { data } = await ctx.supabase
      .from("student_record_competency_scores")
      .select("school_year, competency_item, grade_value")
      .eq("student_id", ctx.studentId)
      .eq("source", "ai")
      .in("grade_value", ["B-", "C", "D"]);
    for (const row of (data ?? []) as Array<{
      school_year: number;
      competency_item: string;
      grade_value: string;
    }>) {
      // school_year → 학년 변환: schoolYear - (currentSchoolYear - studentGrade)
      const grade = row.school_year - (currentSchoolYear - ctx.studentGrade);
      if (grade < 1 || grade > 3) continue;
      if (!out[grade]) out[grade] = [];
      if (!out[grade].includes(row.competency_item)) out[grade].push(row.competency_item);
    }
  } catch {
    // graceful — DB 실패 시 빈 객체 유지
  }
  return out;
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
    // B1 phase 가 _blueprintPhase 단일 키에 id/tierPlan/본체 4필드를 담아 영속.
    // (이전엔 _blueprint/_blueprintId/_tierPlan 3키를 읽었으나 후 2키는 영속되지 않아
    // shadow run 입력이 항상 null 이었음 — 2026-04-29 fix.)
    const blueprintPhase =
      (ctx.results["_blueprintPhase"] as
        | import("../../blueprint/types").BlueprintPhaseOutput
        | undefined) ?? null;
    const blueprint = blueprintPhase;
    const blueprintId = blueprintPhase?.id ?? null;
    const tierPlan = blueprintPhase?.tierPlan ?? null;

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
      // weakCompetenciesByGrade: ctx.belief.analysisContext 1차 → DB fallback 2차 (G1 fix, 2026-04-29).
      // qualityIssuesByGrade: TODO #1 후속에서 동일 경로로 합류 예정.
      weakCompetenciesByGrade: await buildWeakCompetenciesByGrade(ctx),
      qualityIssuesByGrade: {},
      maxDifficultyByGrade: await buildMaxDifficultyByGradeAsync(
        ctx.studentId,
        ctx.tenantId,
      ),
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
