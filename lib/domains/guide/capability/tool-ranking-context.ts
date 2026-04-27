// ============================================
// guide/capability/tool-ranking-context.ts
//
// Tool path (auto-recommend / chat / MCP) 에서 학생 컨텍스트를 BeliefState 와
// 동등한 신호로 변환하는 어댑터. M1-b (2026-04-27).
//
// pipeline 은 ctx.belief 를 직접 들고 있지만, tool path 는 학생 id 만 받으므로
// 가장 최근 synthesis 파이프라인의 task_results 에서 _midPlan / _gradeThemes 를
// 재로드해 동일한 midPlanFocusTokens 집합을 만들어준다.
//
// 신호 부재(미실행 학생, 신규 1학년) 시 빈 Set 반환 → midPlanBonus = 1.0 no-op.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

interface MidPlanShape {
  focusHypothesis?: { label?: string; keywords?: string[] } | string | null;
}

interface GradeThemesShape {
  themes?: Array<{ id?: string; label?: string; keywords?: string[] }>;
  dominantThemeIds?: string[];
}

export interface ToolRankingTokens {
  /** 격차 3 v3+v4: MidPlan focusHypothesis + gradeThemes dominant 키워드 토큰 (lowercase). */
  midPlanFocusTokens: Set<string>;
  /** 학생 학년 (난이도 적합도용). 미해결 시 null → caller 가 폴백 결정. */
  studentGrade: number | null;
  /** 학생 tenant_id (메타 조회용). */
  tenantId: string | null;
}

/**
 * Tool path 가 학생 단위로 호출 시 사용하는 ranking context 로더.
 *
 * 1. students 테이블에서 grade + tenant_id 조회
 * 2. 최근 completed synthesis pipeline 의 task_results 에서 `_midPlan` / `_gradeThemes` 회수
 * 3. focusHypothesis label/keywords + gradeThemes dominant theme keywords 를 토큰화
 *
 * 모든 단계는 best-effort — 실패 시 빈 Set 으로 폴백 (보너스 no-op).
 */
export async function loadToolRankingTokens(
  supabase: Client,
  studentId: string,
): Promise<ToolRankingTokens> {
  const tokens = new Set<string>();
  let studentGrade: number | null = null;
  let tenantId: string | null = null;

  try {
    const { data: studentRow } = await supabase
      .from("students")
      .select("tenant_id, grade")
      .eq("id", studentId)
      .maybeSingle();
    if (studentRow) {
      tenantId = (studentRow.tenant_id as string | null) ?? null;
      studentGrade = (studentRow.grade as number | null) ?? null;
    }
  } catch {
    // ignore
  }

  if (!tenantId) {
    return { midPlanFocusTokens: tokens, studentGrade, tenantId };
  }

  try {
    // synthesis pipeline 의 task_results JSON 에 _midPlan + _gradeThemes 가 저장됨.
    // grade pipeline 의 task_results 도 fallback 으로 함께 회수 (학년별 midPlan).
    const { data: pipelineRows } = await supabase
      .from("student_record_analysis_pipelines")
      .select("pipeline_type, status, task_results, completed_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(8);

    for (const row of pipelineRows ?? []) {
      const results = (row.task_results ?? {}) as Record<string, unknown>;
      const midPlan = results._midPlan ?? results.midPlan ?? null;
      if (midPlan) extractMidPlanTokens(midPlan as MidPlanShape, tokens);
      const gradeThemes = results._gradeThemes ?? results.gradeThemes ?? null;
      if (gradeThemes) extractGradeThemeTokens(gradeThemes as GradeThemesShape, tokens);
      if (tokens.size >= 12) break; // 충분히 모이면 조기 종료
    }
  } catch {
    // ignore — best effort
  }

  return { midPlanFocusTokens: tokens, studentGrade, tenantId };
}

function extractMidPlanTokens(midPlan: MidPlanShape | null, out: Set<string>): void {
  if (!midPlan) return;
  const focus = midPlan.focusHypothesis;
  if (!focus) return;
  if (typeof focus === "string") {
    addTokens(focus, out);
    return;
  }
  if (focus.label) addTokens(focus.label, out);
  if (Array.isArray(focus.keywords)) {
    for (const kw of focus.keywords) addTokens(kw, out);
  }
}

function extractGradeThemeTokens(
  themes: GradeThemesShape | null,
  out: Set<string>,
): void {
  if (!themes?.themes) return;
  const dominantIds = new Set(themes.dominantThemeIds ?? []);
  for (const theme of themes.themes) {
    const isDominant = theme.id && dominantIds.has(theme.id);
    if (!isDominant && dominantIds.size > 0) continue; // dominant 만 사용
    if (theme.id) addTokens(theme.id, out);
    if (theme.label) addTokens(theme.label, out);
    if (Array.isArray(theme.keywords)) {
      for (const kw of theme.keywords) addTokens(kw, out);
    }
  }
}

function addTokens(raw: string | undefined | null, out: Set<string>): void {
  if (!raw) return;
  for (const tok of raw.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?]+/)) {
    const t = tok.trim().toLowerCase();
    if (t.length >= 2) out.add(t);
  }
}
