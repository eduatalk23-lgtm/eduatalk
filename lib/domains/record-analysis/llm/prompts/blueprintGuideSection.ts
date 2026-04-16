// ============================================
// Blueprint Guide Section — 가이드/가안 프롬프트 공통 주입 섹션
//
// 4축×3층 통합 아키텍처 2026-04-16 D 결정 5.
// Grade Pipeline 설계 모드(P4~P7) 프롬프트에 주입하여
// 가이드/가안이 top-down 청사진 정합성을 유지하도록 가이드.
// ============================================

import type { BlueprintPhaseOutput } from "../../blueprint/types";

/**
 * Blueprint 산출물 → 가이드 프롬프트용 간결 섹션.
 * 전체 학년 출력은 너무 길어지므로, targetGrades가 지정되면 해당 학년만 강조.
 * blueprint가 없거나 비어 있으면 빈 문자열 반환 (주입 생략).
 */
export function buildBlueprintGuideSection(
  blueprint: BlueprintPhaseOutput | undefined,
  targetGrades?: number[],
): string {
  if (!blueprint || !blueprint.targetConvergences?.length) return "";

  const focusGrades = targetGrades && targetGrades.length > 0 ? new Set(targetGrades) : null;
  const lines: string[] = ["## 설계 청사진 (Blueprint) — 정합성 필수"];
  lines.push("");
  lines.push(
    "아래는 학생 진로에서 역산한 3년 top-down 설계입니다. 이 가이드·가안은 청사진 수렴에 직접 기여해야 합니다.",
  );
  lines.push("");

  // 3년 관통 테마
  if (blueprint.storylineSkeleton?.overarchingTheme) {
    lines.push(`### 관통 테마`);
    lines.push(blueprint.storylineSkeleton.overarchingTheme);
    lines.push("");
  }

  // 학년별 수렴 (targetGrades 우선)
  const byGrade = new Map<number, typeof blueprint.targetConvergences>();
  for (const conv of blueprint.targetConvergences) {
    const bucket = byGrade.get(conv.grade) ?? [];
    bucket.push(conv);
    byGrade.set(conv.grade, bucket);
  }

  const gradeEntries = [...byGrade.entries()].sort((a, b) => a[0] - b[0]);
  for (const [grade, convs] of gradeEntries) {
    const isFocus = focusGrades ? focusGrades.has(grade) : true;
    const marker = isFocus ? " **(집중)**" : "";
    const yearTheme = blueprint.storylineSkeleton?.yearThemes?.[grade];
    lines.push(`### ${grade}학년${marker}${yearTheme ? ` — ${yearTheme}` : ""}`);
    for (const c of convs) {
      const members = c.targetMembers
        .map((m) => `${m.subjectOrActivity}(${m.role})`)
        .join(", ");
      lines.push(`- "${c.themeLabel}": ${members}`);
      if (c.sharedCompetencies?.length) {
        lines.push(`  역량: ${c.sharedCompetencies.join(", ")}`);
      }
    }
    lines.push("");
  }

  // 학년별 마일스톤 (focus 학년만)
  if (blueprint.milestones && focusGrades) {
    const focusMs = [...focusGrades]
      .map((g) => blueprint.milestones[g])
      .filter((m): m is NonNullable<typeof m> => !!m);
    if (focusMs.length > 0) {
      lines.push(`### 집중 학년 마일스톤`);
      for (const ms of focusMs) {
        lines.push(`- ${ms.grade}학년: ${ms.narrativeGoal}`);
        if (ms.keyActivities?.length) {
          lines.push(`  핵심 활동: ${ms.keyActivities.join(", ")}`);
        }
        if (ms.competencyFocus?.length) {
          lines.push(`  역량 집중: ${ms.competencyFocus.join(", ")}`);
        }
      }
      lines.push("");
    }
  }

  // 역량 성장 타겟 (전체)
  if (blueprint.competencyGrowthTargets?.length) {
    lines.push(`### 역량 성장 목표`);
    for (const t of blueprint.competencyGrowthTargets) {
      const current = t.currentGrade ? `${t.currentGrade}→` : "";
      lines.push(`- ${t.competencyItem}: ${current}${t.targetGrade} (${t.yearTarget}학년)`);
    }
    lines.push("");
  }

  lines.push(
    "위 청사진에 정합하는 방향·키워드·탐구 주제를 우선 제안하세요. 이탈은 명확한 이유가 있을 때만 허용합니다.",
  );

  return lines.join("\n");
}
