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
 */
function adequateLevelToDifficulty(
  level: import("@/lib/domains/student-record/leveling").DifficultyLevel,
): SlotDifficulty {
  if (level <= 2) return "basic";
  if (level === 3) return "intermediate";
  return "advanced";
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
      out[grades[i]] = r ? adequateLevelToDifficulty(r.adequateLevel) : "advanced";
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
 * 소스: ctx.belief.analysisContext (P1-P3 grade pipeline 산출 → synthesis belief seed).
 * `pipeline-task-runners-shared.ts` 가 이미 B-/C 만 필터해 누적하므로 별도 등급 필터 불필요.
 *
 * 미초기화/빈값 시 빈 객체 반환 — Slot Generator 가 weakCompetencies=[] 슬롯으로 정상 동작
 * (weaknessFix 보너스만 0점 처리, 다른 4개 보너스는 정상).
 */
function buildWeakCompetenciesByGrade(
  ctx: ShadowRunCtx,
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  const ac = ctx.belief.analysisContext;
  if (!ac) return out;
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
      // weakCompetenciesByGrade: ctx.belief.analysisContext 에서 학년별 B- 이하 추출 (TODO #1, 2026-04-29).
      // qualityIssuesByGrade: TODO #1 후속에서 동일 경로로 합류 예정.
      weakCompetenciesByGrade: buildWeakCompetenciesByGrade(ctx),
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
