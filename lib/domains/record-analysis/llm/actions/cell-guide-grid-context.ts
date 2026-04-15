// ============================================
// Phase β G7 — 셀 가이드(세특/창체/행특) 격자 컨텍스트 빌더
//
// 배경:
//   Phase β 에서 셀 가이드 LLM 의 "자유 문장 난이도 방향" 을 structured tier 로
//   강제하기 위해 프롬프트 input 에 학생 레벨 + 메인 탐구를 주입. 저장 시점에도
//   setek/changche/haengteuk_guides.main_exploration_id + main_exploration_tier 에
//   배선하여 격자 정합을 영속화.
//
// 호출 흐름:
//   generateSetekGuide / generateChangcheGuide / generateHaengteukGuide
//     → resolveCellGuideGridContext(studentId, tenantId)
//     → input.gridContext 주입 + insert 시 main_exploration_* 채움
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

/** 셀 가이드 LLM 에 주입하는 학생 격자 컨텍스트 */
export interface CellGuideGridContext {
  /** 학생 탐구 레벨 (1~5). null = 레벨 스냅샷 없음. */
  adequateLevel: number | null;
  expectedLevel: number | null;
  /** 활성 메인 탐구 (design → analysis fallback). null = 없음. */
  mainExploration: {
    id: string;
    themeLabel: string;
    themeKeywords: string[];
    careerField: string | null;
    direction: "analysis" | "design";
    tierSummaries: Array<{
      tier: "foundational" | "development" | "advanced";
      theme: string | null;
      keyQuestions: string[];
      suggestedActivities: string[];
    }>;
  } | null;
}

/**
 * studentId → 격자 컨텍스트 해결.
 * 모두 optional — 실패 시 adequateLevel=null, mainExploration=null.
 */
export async function resolveCellGuideGridContext(
  studentId: string,
  tenantId: string,
  supabase: SupabaseClient<unknown>,
): Promise<CellGuideGridContext> {
  const base: CellGuideGridContext = {
    adequateLevel: null,
    expectedLevel: null,
    mainExploration: null,
  };

  try {
    const { data: level } = await supabase
      .from("student_exploration_levels")
      .select("adequate_level, expected_level")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("school_year", { ascending: false })
      .order("semester", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (level) {
      base.adequateLevel = (level as { adequate_level: number | null })
        .adequate_level;
      base.expectedLevel = (level as { expected_level: number | null })
        .expected_level;
    }
  } catch {
    // fallback: null
  }

  try {
    const { getActiveMainExploration } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    const design = await getActiveMainExploration(studentId, tenantId, {
      scope: "overall",
      trackLabel: null,
      direction: "design",
    });
    const active =
      design ??
      (await getActiveMainExploration(studentId, tenantId, {
        scope: "overall",
        trackLabel: null,
        direction: "analysis",
      }));
    if (active) {
      base.mainExploration = {
        id: active.id,
        themeLabel: active.theme_label,
        themeKeywords: active.theme_keywords ?? [],
        careerField: active.career_field ?? null,
        direction: active.direction as "analysis" | "design",
        tierSummaries: summarizeTierPlan(active.tier_plan),
      };
    }
  } catch {
    // fallback: null
  }

  return base;
}

function summarizeTierPlan(
  tierPlan: unknown,
): CellGuideGridContext["mainExploration"] extends null
  ? never
  : Array<{
      tier: "foundational" | "development" | "advanced";
      theme: string | null;
      keyQuestions: string[];
      suggestedActivities: string[];
    }> {
  const out: Array<{
    tier: "foundational" | "development" | "advanced";
    theme: string | null;
    keyQuestions: string[];
    suggestedActivities: string[];
  }> = [];
  if (!tierPlan || typeof tierPlan !== "object") return out;
  for (const tier of ["foundational", "development", "advanced"] as const) {
    const entry = (tierPlan as Record<string, unknown>)[tier];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    out.push({
      tier,
      theme: typeof e.theme === "string" ? e.theme : null,
      keyQuestions: Array.isArray(e.key_questions)
        ? e.key_questions.filter((k): k is string => typeof k === "string")
        : [],
      suggestedActivities: Array.isArray(e.suggested_activities)
        ? e.suggested_activities.filter(
            (k): k is string => typeof k === "string",
          )
        : [],
    });
  }
  return out;
}

/**
 * 프롬프트 섹션 렌더러. null/빈 상태면 빈 문자열 반환.
 * 호출 측은 빈 문자열이면 섹션 자체 생략 — `if (section) prompt += section`.
 */
export function renderCellGuideGridContextSection(
  ctx: CellGuideGridContext | undefined,
): string {
  if (!ctx) return "";
  const hasLevel = ctx.adequateLevel != null || ctx.expectedLevel != null;
  const hasMain = ctx.mainExploration != null;
  if (!hasLevel && !hasMain) return "";

  let s = `## 학생 격자 컨텍스트 (Phase β — 난이도 cap + 메인 탐구)\n\n`;
  s += `→ 아래 컨텍스트에 정합하게 direction/keywords 를 제안하세요. 학생 레벨을 넘는 대학원급 심화 금지, 메인 탐구 tier 와 동떨어진 주제 금지.\n\n`;

  if (hasLevel) {
    s += `### 학생 탐구 레벨 (1=입문 ~ 5=최상위)\n`;
    if (ctx.adequateLevel != null) s += `- adequate_level: ${ctx.adequateLevel}\n`;
    if (ctx.expectedLevel != null) s += `- expected_level: ${ctx.expectedLevel}\n`;
    const cap = ctx.adequateLevel ?? ctx.expectedLevel ?? 3;
    const difficulty =
      cap <= 2 ? "basic" : cap === 3 ? "intermediate" : "advanced";
    s += `- 도달 가능 최대 난이도: **${difficulty}** (cap 초과 주제 제시 금지)\n\n`;
  }

  if (hasMain && ctx.mainExploration) {
    const m = ctx.mainExploration;
    s += `### 활성 메인 탐구 (direction=${m.direction})\n`;
    s += `- theme: ${m.themeLabel}\n`;
    if (m.themeKeywords.length > 0)
      s += `- keywords: ${m.themeKeywords.join(", ")}\n`;
    if (m.careerField) s += `- career_field: ${m.careerField}\n`;
    if (m.tierSummaries.length > 0) {
      s += `\n**tier_plan** (3단 위계):\n`;
      for (const t of m.tierSummaries) {
        s += `- **${t.tier}**`;
        if (t.theme) s += ` — ${t.theme}`;
        s += `\n`;
        if (t.keyQuestions.length > 0) {
          s += `  - key_questions: ${t.keyQuestions.slice(0, 3).join(" / ")}\n`;
        }
        if (t.suggestedActivities.length > 0) {
          s += `  - suggested: ${t.suggestedActivities.slice(0, 3).join(" / ")}\n`;
        }
      }
    }
    s += `\n`;
  }

  return s;
}

/**
 * 셀 가이드 row 에 main_exploration_id / main_exploration_tier 병합.
 * difficulty 는 난이도 1겹 cap 기반으로 tier 로 변환 — 기본 cap 의 tier 를 채움.
 * 호출 측은 insertSetek/Changche/Haengteuk 직전 row 에 병합.
 */
export function applyMainExplorationToRow<T extends Record<string, unknown>>(
  row: T,
  ctx: CellGuideGridContext | undefined,
): T {
  if (!ctx?.mainExploration) return row;
  const cap = ctx.adequateLevel ?? ctx.expectedLevel;
  const tier =
    cap == null
      ? null
      : cap <= 2
        ? "foundational"
        : cap === 3
          ? "development"
          : "advanced";
  return {
    ...row,
    main_exploration_id: ctx.mainExploration.id,
    main_exploration_tier: tier,
  };
}
