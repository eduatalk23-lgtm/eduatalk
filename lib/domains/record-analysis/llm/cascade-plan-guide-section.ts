// ============================================
// M1-c Sprint 1 (2026-04-27): mainTheme + cascadePlan → 가이드 프롬프트 섹션 빌더
//
// ctx.belief.mainTheme + ctx.belief.cascadePlan (P3.6 derive_main_theme 산출물)
// 을 P4 setek_guide 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
//
// 소비처:
//   pipeline-task-runners-guide.ts → guide-modules.ts → generateSetekGuide
//   → prompts/setekGuide.buildUserPrompt (input.cascadePlanSection)
//
// 설계 원칙:
//   - mainTheme/cascadePlan 모두 undefined 면 undefined 반환 (graceful, 섹션 생략)
//   - mainTheme 만 있고 cascadePlan 없으면 메인 탐구 라벨/근거만 노출
//   - cascadePlan.byGrade[targetGrade] 우선, 없으면 전체 학년 요약 fallback
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
// ============================================

import type { MainTheme } from "../capability/main-theme";
import type { CascadePlan } from "../capability/cascade-plan";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * mainTheme + cascadePlan 을 가이드 프롬프트 섹션으로 렌더한다.
 *
 * @param mainTheme - belief.mainTheme (없으면 undefined)
 * @param cascadePlan - belief.cascadePlan (없으면 undefined)
 * @param targetGrade - 가이드 대상 학년. cascadePlan.byGrade[grade] 노드 선택용
 * @returns 마크다운 섹션, 또는 undefined (둘 다 없으면 생략)
 */
export function buildCascadePlanGuideSection(
  mainTheme: MainTheme | null | undefined,
  cascadePlan: CascadePlan | null | undefined,
  targetGrade: number,
): string | undefined {
  if (!mainTheme && !cascadePlan) return undefined;

  let s = `## 메인 탐구 척추 (M1-c — 학년별 cascade)\n\n`;
  s += `→ 아래 메인 탐구주제·학년 분배에 정합하게 가이드 방향을 작성하세요. `;
  s += `학년 tier 에서 벗어난 난이도, 메인테마와 동떨어진 주제 금지.\n\n`;

  if (mainTheme) {
    s += `### 메인 탐구주제\n`;
    s += `- label: ${mainTheme.label}\n`;
    if (mainTheme.keywords && mainTheme.keywords.length > 0) {
      s += `- keywords: ${mainTheme.keywords.join(", ")}\n`;
    }
    if (mainTheme.rationale) {
      s += `- rationale: ${mainTheme.rationale}\n`;
    }
    if (mainTheme.sourceCitations && mainTheme.sourceCitations.length > 0) {
      s += `- sources: ${mainTheme.sourceCitations.slice(0, 4).join(" / ")}\n`;
    }
    s += `\n`;
  }

  if (cascadePlan?.byGrade) {
    const node = cascadePlan.byGrade[String(targetGrade)];
    if (node) {
      s += `### ${targetGrade}학년 cascade 분배\n`;
      s += `- tier: **${node.tier}** (이 학년 도달 난이도)\n`;
      if (node.subjects && node.subjects.length > 0) {
        s += `- 정합 교과: ${node.subjects.join(", ")}\n`;
      }
      if (node.rationale) {
        s += `- 학년 근거: ${node.rationale}\n`;
      }
      if (node.contentSummary) {
        s += `- 학년 탐구 요약: ${node.contentSummary}\n`;
      }
      if (node.evidenceFromNeis && node.evidenceFromNeis.length > 0) {
        s += `- NEIS 근거(이미 충족): ${node.evidenceFromNeis.slice(0, 4).join(" / ")}\n`;
      }
      s += `\n`;
    }

    // 다른 학년 1줄 요약 (척추 연속성 인지)
    const otherGrades = Object.keys(cascadePlan.byGrade)
      .map((g) => Number(g))
      .filter((g) => Number.isFinite(g) && g !== targetGrade)
      .sort((a, b) => a - b);
    if (otherGrades.length > 0) {
      s += `### 타 학년 cascade (참고 — 연속성)\n`;
      for (const g of otherGrades) {
        const n = cascadePlan.byGrade[String(g)];
        if (!n) continue;
        s += `- ${g}학년 (${n.tier})`;
        if (n.subjects && n.subjects.length > 0) {
          s += ` — ${n.subjects.slice(0, 3).join(", ")}`;
        }
        s += `\n`;
      }
      s += `\n`;
    }

    if (cascadePlan.coherenceNote) {
      s += `### 정합성 노트\n${cascadePlan.coherenceNote}\n\n`;
    }
  }

  return s;
}

// ============================================
// 비파이프라인 fallback — DB 직접 조회로 cascade 섹션 빌드
//
// 호출 컨텍스트: generateSetekGuide 등이 파이프라인 ctx 없이 (예: UI 수동 재생성,
// agent tool) 실행될 때 ctx.belief 부재 → cascadePlanSection 인자 undefined.
// 이 헬퍼는 student_record_analysis_pipelines.task_results 에서 가장 최근 completed
// 파이프라인의 _mainTheme / _cascadePlan 을 회수하여 섹션을 생성한다.
//
// 설계 원칙:
//  - 실패 시 graceful undefined (cascade 섹션 생략, 가이드 정상 진행)
//  - cap pipelineRows = 8 (최근 풀런만 — 오래된 cascade 회피)
//  - synthesis 우선, 없으면 grade pipeline fallback (pipeline-synthesis-belief D4 와 동일)
// ============================================

export async function loadAndBuildCascadeSection(
  studentId: string,
  tenantId: string,
  targetGrade: number,
  supabase: SupabaseClient,
): Promise<string | undefined> {
  try {
    const { data: pipelineRows } = await supabase
      .from("student_record_analysis_pipelines")
      .select("task_results")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(8);

    let mainTheme: MainTheme | undefined;
    let cascadePlan: CascadePlan | undefined;

    for (const row of (pipelineRows ?? []) as Array<{ task_results: unknown }>) {
      const tr = row.task_results as Record<string, unknown> | null;
      if (!tr) continue;
      const theme = tr._mainTheme as MainTheme | undefined;
      const cascade = tr._cascadePlan as CascadePlan | undefined;
      if (!mainTheme && theme && typeof theme === "object" && "label" in theme) {
        mainTheme = theme;
      }
      if (
        !cascadePlan &&
        cascade &&
        typeof cascade === "object" &&
        "byGrade" in cascade
      ) {
        cascadePlan = cascade;
      }
      if (mainTheme && cascadePlan) break;
    }

    if (!mainTheme && !cascadePlan) return undefined;
    return buildCascadePlanGuideSection(mainTheme, cascadePlan, targetGrade);
  } catch {
    // graceful: DB 조회 실패 시 섹션 생략
    return undefined;
  }
}
