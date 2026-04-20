// ============================================
// α2 v1: 학종 Reward 계산 (규칙 기반)
//
// StudentState 를 입력받아 학업/진로/공동체 3영역 0~100 점수와
// 가중합 total 을 산출하는 순수 함수.
//
// 공식:
//   - CompetencyGrade (A+/A-/B+/B/B-/C) → 0~100 선형 매핑
//   - area score = 해당 영역 non-null 축 점수 평균
//     · academic  : academic_* 3 축 평균 (≥ 2 축 non-null 필요)
//     · career    : career_* 3 축 평균 (≥ 2 축 non-null 필요)
//     · community : Layer1 공동체 4 축 평균 × 0.7 + aux 3 종 기여 × 0.3
//       · aux 기여: (volunteer + awards + attendanceIntegrityBonus) / 3 × 100
//         · volunteer present → 100, else 0
//         · awards items ≥ 1 → 100, else 0
//         · attendance integrityScore (0~100) 그대로 사용
//   - total = academic × 0.3 + career × 0.4 + community × 0.3
//     · 세 영역 모두 not null 일 때만 산출. 하나라도 null → null.
//   - confidence (0~1) = 축 개수 / (영역별 최대 축 수) → min 제약으로 total confidence
//
// v1 설계 원칙:
//   - 순수 함수. I/O 없음. 테스트 용이.
//   - 계산 불가(데이터 부족) → null. Agent 의사결정에서 "알 수 없음" 처리.
//   - v2 (exemplar 거리 학습) 는 별도 함수로 추가. v1 교체가 아닌 병행.
// ============================================

import type {
  StudentState,
  HakjongScore,
  CompetencyAxisState,
  AwardState,
  VolunteerState,
  AttendanceState,
} from "../types/student-state";
import type { CompetencyGrade } from "../types/enums";

// ─── 상수 ────────────────────────────────────────────────

/** CompetencyGrade → 0~100 선형 매핑 */
const GRADE_TO_SCORE: Record<CompetencyGrade, number> = {
  "A+": 95,
  "A-": 85,
  "B+": 75,
  B: 65,
  "B-": 55,
  C: 40,
};

/** 영역별 Reward 가중치 (대교협 공통 기준) */
const AREA_WEIGHTS = {
  academic: 0.3,
  career: 0.4,
  community: 0.3,
} as const;

/** 영역별 Reward 산출 최소 축 수 (axes.filter(a.grade != null).length >= MIN) */
const MIN_AXES_FOR_AREA_SCORE = 2;

/** 공동체 Reward 내 Layer1 축 vs aux 가중 비율 */
const COMMUNITY_LAYER1_WEIGHT = 0.7;
const COMMUNITY_AUX_WEIGHT = 0.3;

/** 영역별 축 최대 수 (confidence 계산용) */
const AREA_AXIS_MAX = {
  academic: 3,
  career: 3,
  community: 4,
} as const;

// ─── 내부 헬퍼 ───────────────────────────────────────────

function axisScore(axis: CompetencyAxisState): number | null {
  if (axis.grade === null) return null;
  return GRADE_TO_SCORE[axis.grade];
}

function averageAxisScores(axes: readonly CompetencyAxisState[]): number | null {
  const scores = axes
    .map(axisScore)
    .filter((s): s is number => s !== null);
  if (scores.length < MIN_AXES_FOR_AREA_SCORE) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

function computeAuxContribution(
  volunteer: VolunteerState | null,
  awards: AwardState | null,
  attendance: AttendanceState | null,
): number {
  const volunteerContribution = volunteer !== null ? 100 : 0;
  const awardsContribution = (awards?.items.length ?? 0) > 0 ? 100 : 0;
  // attendance 는 0~100 integrityScore 그대로 사용. null → 미계산 (0 기여로 처리 → 보수적).
  const attendanceContribution = attendance?.integrityScore ?? 0;
  return (volunteerContribution + awardsContribution + attendanceContribution) / 3;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function confidenceOfAxes(
  axes: readonly CompetencyAxisState[],
  maxAxes: number,
): number {
  const nonNull = axes.filter((a) => a.grade !== null).length;
  return Math.max(0, Math.min(1, nonNull / maxAxes));
}

// ─── 공개 API ───────────────────────────────────────────

/**
 * StudentState → HakjongScore (v1 규칙 기반).
 *
 * 계산 불가 영역 → null. total 은 세 영역 모두 non-null 일 때만 산출.
 * confidence 는 영역별 축 채움률(0~1). total confidence = min 3 영역.
 */
export function computeHakjongScore(state: StudentState): HakjongScore {
  const axes = state.competencies?.axes ?? [];
  const academicAxes = axes.filter((a) => a.area === "academic");
  const careerAxes = axes.filter((a) => a.area === "career");
  const communityAxes = axes.filter((a) => a.area === "community");

  const academic = averageAxisScores(academicAxes);
  const career = averageAxisScores(careerAxes);

  // community: Layer1 평균 × 0.7 + aux 기여 × 0.3
  const communityLayer1 = averageAxisScores(communityAxes);
  const communityAux = computeAuxContribution(
    state.aux?.volunteer ?? null,
    state.aux?.awards ?? null,
    state.aux?.attendance ?? null,
  );
  const community =
    communityLayer1 !== null
      ? communityLayer1 * COMMUNITY_LAYER1_WEIGHT +
        communityAux * COMMUNITY_AUX_WEIGHT
      : null;

  const total =
    academic !== null && career !== null && community !== null
      ? academic * AREA_WEIGHTS.academic +
        career * AREA_WEIGHTS.career +
        community * AREA_WEIGHTS.community
      : null;

  const academicConfidence = confidenceOfAxes(academicAxes, AREA_AXIS_MAX.academic);
  const careerConfidence = confidenceOfAxes(careerAxes, AREA_AXIS_MAX.career);
  const communityConfidence = confidenceOfAxes(
    communityAxes,
    AREA_AXIS_MAX.community,
  );
  const totalConfidence =
    total !== null
      ? Math.min(academicConfidence, careerConfidence, communityConfidence)
      : 0;

  return {
    academic: academic !== null ? round1(academic) : null,
    career: career !== null ? round1(career) : null,
    community: community !== null ? round1(community) : null,
    total: total !== null ? round1(total) : null,
    computedAt: new Date().toISOString(),
    version: "v1_rule",
    confidence: {
      academic: round1(academicConfidence * 100) / 100,
      career: round1(careerConfidence * 100) / 100,
      community: round1(communityConfidence * 100) / 100,
      total: round1(totalConfidence * 100) / 100,
    },
  };
}
