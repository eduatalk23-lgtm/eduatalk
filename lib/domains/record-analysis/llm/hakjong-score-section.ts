// ============================================
// 격차 6: 학종 3요소 통합 점수 → S3 진단 / S5 전략 프롬프트 섹션 빌더
//
// α2 Reward 엔진 compute-hakjong-score.ts 가 student_state_snapshots 에 저장한
// hakjongScore(학업/진로/공동체 3축, 0~100)를 마크다운 섹션으로 렌더한다.
//
// 소비처:
//   pipeline/synthesis/phase-s3-diagnosis.ts  → diagQualityPatternSection 에 병합
//   pipeline/synthesis/phase-s5-strategy.ts   → combinedHyperedgeSection 에 병합
//
// 설계 원칙:
//   - hakjongScore 미계산(null) 또는 입력 누락 시 undefined 반환 (graceful, no-op)
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
//   - 단계별 해석 힌트: <50 약점 / 50~70 보통 / >=70 강점 (projected-quality 패턴 답습)
// ============================================

import type { HakjongScore } from "@/lib/domains/student-record/types/student-state";

/**
 * 학종 3요소 통합 점수를 S3 진단 / S5 전략 프롬프트용 마크다운 섹션으로 렌더한다.
 *
 * @param score - α2 Reward 엔진이 계산한 HakjongScore. null/undefined이면 no-op.
 * @returns 마크다운 섹션, 입력 없거나 total이 null이면 undefined
 */
export function buildHakjongScoreSection(
  score: HakjongScore | null | undefined,
): string | undefined {
  if (!score) return undefined;

  // 3축 중 하나도 계산되지 않은 경우 no-op
  if (score.academic === null && score.career === null && score.community === null) {
    return undefined;
  }

  const lines: string[] = [];
  lines.push("## 학종 3요소 통합 점수 (α2 Reward 엔진, student_state_snapshot 기준)");
  lines.push(
    "아래 점수는 역량 분석 결과를 학업/진로/공동체 3축으로 0~100 스케일로 변환한 학종 Reward 점수입니다. " +
      "진단/전략 작성 시 약점 축(🔴)을 명시적으로 언급하고 해당 영역의 보강을 우선 방향으로 제시하세요.",
  );
  lines.push("");

  // 각 축 렌더
  lines.push("### 축별 점수");

  const axes: Array<{ label: string; value: number | null; confidence: number }> = [
    { label: "학업역량 (academic)", value: score.academic, confidence: score.confidence.academic },
    { label: "진로역량 (career)", value: score.career, confidence: score.confidence.career },
    { label: "공동체역량 (community)", value: score.community, confidence: score.confidence.community },
  ];

  for (const axis of axes) {
    if (axis.value === null) {
      lines.push(`- ${axis.label}: 미계산 (데이터 부족 — 해당 축 역량 분석 선행 필요)`);
      continue;
    }
    const badge = axisHint(axis.value);
    const confPct = Math.round(axis.confidence * 100);
    lines.push(`- ${badge} ${axis.label}: **${axis.value}점** (신뢰도 ${confPct}%)`);
    const hint = interpretationHint(axis.label.split(" ")[0], axis.value);
    if (hint) lines.push(`  → ${hint}`);
  }

  lines.push("");

  // total 렌더
  if (score.total !== null) {
    const totalBadge = axisHint(score.total);
    lines.push(`**종합 학종 Reward**: ${totalBadge} **${score.total}점** (학업×0.3 + 진로×0.4 + 공동체×0.3)`);
  } else {
    lines.push("**종합 학종 Reward**: 미계산 (3축 중 일부 데이터 부족)");
  }

  // 산출 메타
  const computedAt = score.computedAt ? score.computedAt.slice(0, 10) : "미상";
  lines.push(`*(산출: ${computedAt}, version: ${score.version})*`);
  lines.push("");

  // 통합 진단/전략 지침
  const weakAxes: string[] = [];
  if (score.academic !== null && score.academic < 50) weakAxes.push("학업역량");
  if (score.career !== null && score.career < 50) weakAxes.push("진로역량");
  if (score.community !== null && score.community < 50) weakAxes.push("공동체역량");

  if (weakAxes.length > 0) {
    lines.push(
      `**진단/전략 작성 지침**: **${weakAxes.join(", ")}** 축이 50점 미만(약점)입니다. ` +
        "진단에서 해당 영역의 활동·기록 부족을 명시적 약점으로 분류하고, " +
        "전략에서 해당 축 보강(봉사·수상·창체 연계 등)을 최우선 제안으로 배치하세요.",
    );
  } else {
    lines.push(
      "**진단/전략 작성 지침**: 3축 모두 50점 이상입니다. " +
        "각 축 점수를 참고하여 상대적으로 낮은 축의 구체적 보강 방안을 전략에 포함하세요.",
    );
  }

  return lines.join("\n");
}

/** 점수 단계별 배지 반환 */
function axisHint(score: number): string {
  if (score < 50) return "🔴";
  if (score < 70) return "🟡";
  return "🟢";
}

/** 축별 해석 힌트 문장 반환 (없으면 빈 문자열) */
function interpretationHint(axisKey: string, score: number): string {
  if (score >= 70) return "";

  if (score < 50) {
    switch (axisKey) {
      case "학업역량":
        return "학업 역량 전반 부족. 세특 탐구 깊이·구체성 보강 필요.";
      case "진로역량":
        return "진로 탐구·교과 연계 활동 부족. 진로 세특·동아리 강화 필요.";
      case "공동체역량":
        return "봉사·수상·창체 등 공동체 기여 기록 부족. 관련 활동 적극 추가 필요.";
      default:
        return "해당 축 역량 전반 부족 — 보강 우선순위 높음.";
    }
  }

  // 50~70 구간 (보통)
  switch (axisKey) {
    case "학업역량":
      return "학업 역량 중간 수준. specificity/depth가 낮은 세특 항목 집중 보강 권장.";
    case "진로역량":
      return "진로 탐구 중간 수준. 진로 연계 교과 세특·동아리 활동 보강 권장.";
    case "공동체역량":
      return "공동체 역량 중간 수준. 봉사 실적·리더십 활동 내실화 권장.";
    default:
      return "중간 수준 — specificity 또는 depth 낮은 항목 중심 보강.";
  }
}
