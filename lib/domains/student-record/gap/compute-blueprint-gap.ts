// ============================================
// α3-1 v1: 청사진 GAP 계산 (규칙 기반, 순수 함수)
//
// StudentState × CompetencyGradeTarget[] → BlueprintGap
//
// 공식:
//   axisGap:
//     gapSize   = targetNum - currentNum  (A+=6, A-=5, B+=4, B=3, B-=2, C=1, null=0)
//     pattern:
//       · current=null, target 있음, remainingSemesters ≥ LATENT_THRESHOLD → latent
//       · current=null, target 있음, remainingSemesters <  LATENT_THRESHOLD → insufficient (urgent)
//       · current.source='ai_projected' only → mismatch  (설계만 있고 실측 없음)
//       · current && target && gapSize >=  INSUFFICIENT_THRESHOLD  → insufficient
//       · current && target && gapSize <= -EXCESS_THRESHOLD        → excess
//       · target=null → pattern 생성하지 않음 (배열에서 제외)
//
//   areaGap:
//     currentScore = state.hakjongScore[area]        (0~100, Reward 엔진 공식 재사용)
//     targetScore  = mean(GRADE_TO_SCORE[target.grade]) for targets where area matches
//     gapSize      = targetScore - currentScore      (양수=부족, null 있으면 null)
//     mainCause    = 해당 area 최대 axisGap 의 code + pattern 요약
//
//   priority:
//     high   : max(areaGap.gapSize) ≥ HIGH_AREA_GAP AND remainingSemesters ≤ HIGH_SEMESTERS
//              OR axisGap 중 pattern='insufficient' AND gapSize ≥ HIGH_AXIS_GAP 존재
//     medium : max(areaGap.gapSize) ≥ MED_AREA_GAP  OR  remainingSemesters ≤ MED_SEMESTERS
//     low    : 나머지
//
// v1 원칙:
//   - 순수 함수, I/O 없음.
//   - target 없음 → 빈 axisGaps + areaGaps.*.targetScore=null + priority='low'.
//   - v1 에서는 단순 grade 수치 차. v2 exemplar 학습으로 세밀 calibration 예정.
// ============================================

import type { CompetencyAxisState } from "../types/student-state";
import type {
  AreaGap,
  AxisGap,
  BlueprintGap,
  BlueprintGapInput,
  CompetencyGradeTarget,
  GapPattern,
} from "../types/blueprint-gap";
import type {
  CompetencyArea,
  CompetencyGrade,
  CompetencyItemCode,
} from "../types/enums";

// ─── 상수 ────────────────────────────────────────────────

/** CompetencyGrade → 등급 수치 (A+=6, C=1). null=0. gapSize 계산용. */
const GRADE_TO_NUM: Record<CompetencyGrade, number> = {
  "A+": 6,
  "A-": 5,
  "B+": 4,
  B: 3,
  "B-": 2,
  C: 1,
};

/** CompetencyGrade → 0~100 점수 (areaGap.targetScore 계산용. Reward 공식과 일치). */
const GRADE_TO_SCORE: Record<CompetencyGrade, number> = {
  "A+": 95,
  "A-": 85,
  "B+": 75,
  B: 65,
  "B-": 55,
  C: 40,
};

/** latent 판정 시 최소 잔여 학기. 이하이면 insufficient (urgent). */
const LATENT_THRESHOLD = 2;
/** 축별 insufficient 판정 최소 등급 차 (>=). */
const INSUFFICIENT_THRESHOLD = 1;
/** 축별 excess 판정 최소 역방향 차 (-(gapSize) >= 이 값). */
const EXCESS_THRESHOLD = 2;

/** priority=high: areaGap ≥ 이 값 + 잔여학기 ≤ HIGH_SEMESTERS */
const HIGH_AREA_GAP = 15;
const HIGH_SEMESTERS = 2;
const HIGH_AXIS_GAP = 3;

/** priority=medium: areaGap ≥ 이 값 OR 잔여학기 ≤ MED_SEMESTERS */
const MED_AREA_GAP = 10;
const MED_SEMESTERS = 4;

// ─── 내부 헬퍼 ────────────────────────────────────────────

function gradeNum(grade: CompetencyGrade | null): number {
  return grade === null ? 0 : GRADE_TO_NUM[grade];
}

function gradeScore(grade: CompetencyGrade | null): number | null {
  return grade === null ? null : GRADE_TO_SCORE[grade];
}

function remainingSemesters(
  currentGrade: 1 | 2 | 3,
  currentSemester: 1 | 2,
): number {
  return (3 - currentGrade) * 2 + (currentSemester === 1 ? 1 : 0);
}

function classifyAxisPattern(
  axis: CompetencyAxisState | null,
  target: CompetencyGradeTarget,
  remaining: number,
): { pattern: GapPattern; gapSize: number; rationale: string } {
  const targetNum = GRADE_TO_NUM[target.targetGrade];

  // 1) current 자체가 없음 — latent vs insufficient(urgent)
  if (!axis || axis.grade === null) {
    const gapSize = targetNum;
    if (remaining >= LATENT_THRESHOLD) {
      return {
        pattern: "latent",
        gapSize,
        rationale: `${codeKo(target.code)} 미측정. 잔여 ${remaining}학기 내 활성화 가능`,
      };
    }
    return {
      pattern: "insufficient",
      gapSize,
      rationale: `${codeKo(target.code)} 미측정. 잔여 ${remaining}학기 — 시간 부족`,
    };
  }

  // 2) 실측(ai) 없이 ai_projected 만 있음 — mismatch
  if (axis.source === "ai_projected") {
    return {
      pattern: "mismatch",
      gapSize: targetNum - gradeNum(axis.grade),
      rationale: `${codeKo(target.code)} 설계(${axis.grade}) 만 있고 실측 없음`,
    };
  }

  // 3) 수치 비교
  const currentNum = gradeNum(axis.grade);
  const diff = targetNum - currentNum;

  if (diff >= INSUFFICIENT_THRESHOLD) {
    return {
      pattern: "insufficient",
      gapSize: diff,
      rationale: `${codeKo(target.code)} ${axis.grade} → 목표 ${target.targetGrade} (차 ${diff}등급)`,
    };
  }
  if (diff <= -EXCESS_THRESHOLD) {
    return {
      pattern: "excess",
      gapSize: diff,
      rationale: `${codeKo(target.code)} ${axis.grade} 가 목표 ${target.targetGrade} 보다 ${-diff}등급 높음`,
    };
  }
  // balanced — 호출자가 배열 제외
  return {
    pattern: "insufficient",
    gapSize: diff,
    rationale: "",
  };
}

function codeKo(code: CompetencyItemCode): string {
  const MAP: Record<CompetencyItemCode, string> = {
    academic_achievement: "학업성취도",
    academic_attitude: "학업태도",
    academic_inquiry: "탐구력",
    career_course_effort: "진로교과 이수노력",
    career_course_achievement: "진로교과 성취도",
    career_exploration: "진로탐색",
    community_collaboration: "협업/소통",
    community_caring: "나눔/배려",
    community_integrity: "성실/규칙준수",
    community_leadership: "리더십",
  };
  return MAP[code];
}

function areaKo(area: CompetencyArea): string {
  return area === "academic" ? "학업역량" : area === "career" ? "진로역량" : "공동체역량";
}

// ─── 공개 API ────────────────────────────────────────────

/**
 * StudentState × Blueprint target → BlueprintGap (v1 규칙 기반).
 *
 * target 이 빈 배열이면 axisGaps=[], areaGap.targetScore=null, priority='low'.
 * state.hakjongScore 가 null 영역이면 areaGap.gapSize=null.
 */
export function computeBlueprintGap(input: BlueprintGapInput): BlueprintGap {
  const { state, targets, currentGrade, currentSemester } = input;
  const remaining = remainingSemesters(currentGrade, currentSemester);

  const axes = state.competencies?.axes ?? [];
  const axisByCode = new Map<CompetencyItemCode, CompetencyAxisState>();
  for (const a of axes) axisByCode.set(a.code, a);

  // ── axisGaps 계산 (target 이 있는 축만) ──
  const axisGaps: AxisGap[] = [];
  for (const target of targets) {
    const axis = axisByCode.get(target.code) ?? null;
    const { pattern, gapSize, rationale } = classifyAxisPattern(axis, target, remaining);

    // balanced (|diff| < INSUFFICIENT_THRESHOLD) 는 rationale 빈 문자열로 표시 → 배열 제외
    if (rationale === "") continue;

    axisGaps.push({
      code: target.code,
      area: axis?.area ?? inferAreaFromCode(target.code),
      currentGrade: axis?.grade ?? null,
      targetGrade: target.targetGrade,
      gapSize,
      pattern,
      rationale,
    });
  }

  // ── areaGaps 계산 ──
  const areaGaps = {
    academic: computeAreaGap("academic", state.hakjongScore?.academic ?? null, targets, axisGaps),
    career: computeAreaGap("career", state.hakjongScore?.career ?? null, targets, axisGaps),
    community: computeAreaGap("community", state.hakjongScore?.community ?? null, targets, axisGaps),
  };

  // ── priority 산정 ──
  const maxAreaGap = Math.max(
    areaGaps.academic.gapSize ?? 0,
    areaGaps.career.gapSize ?? 0,
    areaGaps.community.gapSize ?? 0,
  );
  const hasHighAxisGap = axisGaps.some(
    (g) => g.pattern === "insufficient" && g.gapSize >= HIGH_AXIS_GAP,
  );

  let priority: "high" | "medium" | "low" = "low";
  if (targets.length === 0) {
    priority = "low";
  } else if ((maxAreaGap >= HIGH_AREA_GAP && remaining <= HIGH_SEMESTERS) || hasHighAxisGap) {
    priority = "high";
  } else if (maxAreaGap >= MED_AREA_GAP || remaining <= MED_SEMESTERS) {
    priority = "medium";
  }

  // ── summary ──
  const summary = buildSummary(areaGaps, axisGaps, targets.length === 0);

  return {
    computedAt: new Date().toISOString(),
    version: "v1_rule",
    remainingSemesters: remaining,
    areaGaps,
    axisGaps,
    priority,
    summary,
  };
}

function inferAreaFromCode(code: CompetencyItemCode): CompetencyArea {
  if (code.startsWith("academic_")) return "academic";
  if (code.startsWith("career_")) return "career";
  return "community";
}

function computeAreaGap(
  area: CompetencyArea,
  currentScore: number | null,
  targets: readonly CompetencyGradeTarget[],
  axisGaps: readonly AxisGap[],
): AreaGap {
  const areaTargets = targets.filter((t) => inferAreaFromCode(t.code) === area);

  let targetScore: number | null = null;
  if (areaTargets.length > 0) {
    const scores = areaTargets
      .map((t) => gradeScore(t.targetGrade))
      .filter((s): s is number => s !== null);
    if (scores.length > 0) {
      targetScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  const gapSize =
    targetScore !== null && currentScore !== null
      ? round1(targetScore - currentScore)
      : null;

  // mainCause: 해당 area 최대 axisGap
  const areaAxisGaps = axisGaps.filter((g) => g.area === area);
  areaAxisGaps.sort((a, b) => Math.abs(b.gapSize) - Math.abs(a.gapSize));
  const top = areaAxisGaps[0] ?? null;
  const mainCause = top ? top.rationale : null;

  return {
    area,
    currentScore,
    targetScore: targetScore !== null ? round1(targetScore) : null,
    gapSize,
    mainCause,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildSummary(
  areaGaps: BlueprintGap["areaGaps"],
  axisGaps: readonly AxisGap[],
  targetsEmpty: boolean,
): string {
  if (targetsEmpty) return "청사진 역량 목표 미수립 — GAP 계산 보류";

  // 가장 큰 areaGap 영역
  const entries: ReadonlyArray<[CompetencyArea, AreaGap]> = [
    ["academic", areaGaps.academic],
    ["career", areaGaps.career],
    ["community", areaGaps.community],
  ];
  const withGap = entries.filter(([, g]) => g.gapSize !== null && g.gapSize > 0);
  if (withGap.length === 0) {
    return "전 영역 청사진 목표 충족 (gap ≤ 0)";
  }
  withGap.sort(([, a], [, b]) => (b.gapSize ?? 0) - (a.gapSize ?? 0));
  const [topArea, topAreaGap] = withGap[0];
  // axisGaps 가 balanced 기준에 걸려 빈 경우에도 area 수준 gap 은 남을 수 있음.
  // mainCause null 이면 "축 세부 원인 없음 — 영역 평균 기준" 으로 폴백.
  const cause = topAreaGap.mainCause ?? "축별 세부 없음 — 영역 평균 기준";
  return `${areaKo(topArea)} 갭 ${topAreaGap.gapSize!}점. 주원인 = ${cause}`;
}
