// ============================================
// β+1: MidPlan → 가이드 프롬프트 섹션 빌더
//
// ctx.midPlan (MidPipeline Planner 메타 판정 결과) 을 P4/P5/P6 가이드 프롬프트에
// 주입할 마크다운 섹션으로 렌더한다.
//
// 소비처:
//   pipeline-task-runners-guide.ts → guide-modules.ts → generateSetekGuide/generateChangcheGuide/generateHaengteukGuide
//   → prompts/setekGuide|changcheGuide|haengteukGuide buildUserPrompt
//
// 설계 원칙:
//   - midPlan undefined/null 또는 모든 필드 비어있으면 undefined 반환 (graceful, 섹션 생략)
//   - recordPriorityOverride 는 점수 70 이상만 표시 (Top-N 가독성)
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
// ============================================

import type { MidPlan } from "../pipeline/orient/mid-pipeline-planner";

/**
 * MidPlan 메타 판정 결과를 가이드 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
 *
 * @param midPlan - ctx.midPlan 또는 task_results["_midPlan"] 에서 복원한 동일 형태
 * @returns 마크다운 섹션 문자열, 또는 undefined (midPlan 없거나 비어있으면 생략)
 */
export function buildMidPlanGuideSection(
  midPlan: MidPlan | null | undefined,
): string | undefined {
  if (!midPlan) return undefined;

  const { focusHypothesis, concernFlags, recordPriorityOverride, rationale } = midPlan;

  // 모든 실질 필드가 비어있으면 섹션 생략
  const hasFocus = typeof focusHypothesis === "string" && focusHypothesis.trim().length > 0;
  const hasFlags = Array.isArray(concernFlags) && concernFlags.length > 0;
  const highPriorityRecords = recordPriorityOverride
    ? Object.entries(recordPriorityOverride).filter(([, score]) => score >= 70)
    : [];
  const hasOverride = highPriorityRecords.length > 0;
  const hasRationale = Array.isArray(rationale) && rationale.length > 0;

  if (!hasFocus && !hasFlags && !hasOverride && !hasRationale) {
    return undefined;
  }

  const lines: string[] = [];
  lines.push(`## 컨설턴트 메타 판정 (이번 학년 보강 우선순위)`);
  lines.push(``);

  if (hasFocus) {
    lines.push(`### 핵심 탐구 축 가설`);
    lines.push(focusHypothesis!.trim());
    lines.push(``);
  }

  if (hasFlags) {
    lines.push(`### 우려 플래그`);
    for (const flag of concernFlags!) {
      lines.push(`- ${flag}`);
    }
    lines.push(``);
  }

  if (hasOverride) {
    // 점수 내림차순 정렬
    const sorted = highPriorityRecords.sort(([, a], [, b]) => b - a);
    lines.push(`### 우선 보강 레코드 (점수 70 이상)`);
    for (const [recordId, score] of sorted) {
      lines.push(`- record_id ${recordId}: 우선순위 점수 ${score}`);
    }
    lines.push(``);
  }

  if (hasRationale) {
    lines.push(`### 판정 근거`);
    for (const r of rationale) {
      lines.push(`- ${r}`);
    }
    lines.push(``);
  }

  lines.push(
    `**위 우선순위와 가설을 반영하여 가이드 방향을 결정하세요.` +
    ` 특히 "우선 보강 레코드" 가 명시된 경우 해당 레코드 보완 가이드를 우선 작성하세요.**`,
  );

  return lines.join("\n");
}

// ============================================
// β 격차 1: MidPlan → Synthesis(진단/전략) 프롬프트 섹션 빌더
//
// S3 진단과 S5 전략은 recordPriorityOverride(레코드 단위 점수)를 필요로 하지 않는다.
// 진단/전략 프롬프트의 톤은 "학생의 탐구 방향과 우려 사항" 중심이므로
// focusHypothesis + concernFlags + rationale 만 포함한다.
// ============================================

/**
 * MidPlan 메타 판정 결과를 S3 진단 / S5 전략 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
 *
 * recordPriorityOverride(레코드별 점수)는 P4~P6 가이드 단계에서만 의미 있으므로 synthesis 섹션에서는 제외한다.
 *
 * @param midPlan - ctx.midPlan 또는 task_results["_midPlan"] 에서 복원한 동일 형태
 * @returns 마크다운 섹션 문자열, 또는 undefined (midPlan 없거나 focusHypothesis 비어있으면 생략)
 */
export function buildMidPlanSynthesisSection(
  midPlan: MidPlan | null | undefined,
): string | undefined {
  if (!midPlan) return undefined;

  const { focusHypothesis, concernFlags, rationale } = midPlan;

  // focusHypothesis가 없으면 synthesis 맥락에서는 섹션 자체 생략
  const hasFocus = typeof focusHypothesis === "string" && focusHypothesis.trim().length > 0;
  if (!hasFocus) return undefined;

  const hasFlags = Array.isArray(concernFlags) && concernFlags.length > 0;
  const hasRationale = Array.isArray(rationale) && rationale.length > 0;

  const lines: string[] = [];
  lines.push(`## 컨설턴트 메타 판정 — 핵심 탐구 축 가설`);
  lines.push(``);
  lines.push(`**핵심 탐구 축**: ${focusHypothesis!.trim()}`);
  lines.push(``);

  if (hasFlags) {
    lines.push(`### 우려 플래그`);
    for (const flag of concernFlags!) {
      lines.push(`- ${flag}`);
    }
    lines.push(``);
  }

  if (hasRationale) {
    lines.push(`### 판정 근거`);
    for (const r of rationale) {
      lines.push(`- ${r}`);
    }
    lines.push(``);
  }

  lines.push(
    `**위 핵심 탐구 축 가설과 우려 사항을 반영하여 진단/전략 방향을 결정하세요.` +
    ` 가설이 가리키는 방향의 약점을 우선적으로 해석하고, 우려 사항이 명시된 영역을 보완전략의 우선순위에 반영하세요.**`,
  );

  return lines.join("\n");
}
