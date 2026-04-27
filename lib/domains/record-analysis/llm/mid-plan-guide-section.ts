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

// ============================================
// 격차 1: 다학년 MidPlan dict → Synthesis(진단/전략/면접/tier_plan) 프롬프트 섹션
//
// S3/S5/S6/S7 에 전 학년 MidPlan 을 요약 형태로 동시 주입한다.
// 단일 midPlanSynthesisSection(최신 학년)은 기존 그대로 유지하며,
// 이 섹션은 추가 컨텍스트로 병렬 슬롯에 배치한다.
// ============================================

/**
 * 학년별 MidPlan dict 를 Synthesis 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
 *
 * 각 학년별로 focusHypothesis + recordPriorityOverride 키 수 + concernFlags 수를 1줄 요약.
 * 단일 섹션(최신 학년)과 병렬 주입 — LLM 은 두 섹션 모두 참조.
 *
 * @param midPlanByGrade - belief.midPlanByGrade (grade → MidPlan dict)
 * @returns 마크다운 섹션, 또는 undefined (dict 없거나 비어있으면 생략)
 */
export function buildMidPlanByGradeSection(
  midPlanByGrade: Record<number, MidPlan> | null | undefined,
): string | undefined {
  if (!midPlanByGrade || Object.keys(midPlanByGrade).length === 0) return undefined;

  const grades = Object.keys(midPlanByGrade)
    .map(Number)
    .sort((a, b) => a - b); // 학년 오름차순 (G1 → G2 → G3)

  const lines: string[] = [];
  lines.push(`## 학년별 MidPlan 통합 (다학년 탐구 축 맥락)`);
  lines.push(``);

  for (const grade of grades) {
    const mp = midPlanByGrade[grade];
    if (!mp) continue;

    const focusSummary =
      typeof mp.focusHypothesis === "string" && mp.focusHypothesis.trim().length > 0
        ? mp.focusHypothesis.trim().slice(0, 80)
        : "(가설 없음)";

    const overrideCount = mp.recordPriorityOverride
      ? Object.keys(mp.recordPriorityOverride).length
      : 0;
    const concernCount = Array.isArray(mp.concernFlags) ? mp.concernFlags.length : 0;

    lines.push(
      `- **G${grade}**: focusHypothesis: ${focusSummary}` +
      ` / 우선 레코드 ${overrideCount}건 / 우려 ${concernCount}건`,
    );
  }

  lines.push(``);
  lines.push(
    `**위 학년별 탐구 축 가설을 참고하여 학년 간 탐구 연속성과 방향 정합성을 평가하세요.` +
    ` 특히 학년이 올라갈수록 탐구 축이 심화·수렴하는지 확인하고, 역행하거나 단절된 경우 약점으로 지적하세요.**`,
  );

  return lines.join("\n");
}

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
