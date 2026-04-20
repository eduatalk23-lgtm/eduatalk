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
//
// α2 v2-pre (2026-04-20): aux 연속 기여 (computeHakjongScoreV2Pre)
//   - volunteer binary(0/100) → `log10(hours+1) × 50` cap 100
//   - awards binary(0/100)   → level 가중(교내 0.8 / 교외 1.0 / 전국 1.3) × 20 합계, cap 100
//   - attendance: 동일 (이미 연속 0~100)
//   - v1 과 병행. buildStudentState 연결·영속은 Step C 에서.
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

// ─── α2 v2-pre (2026-04-20): aux 연속 기여 Calibrated Reward ────────────
//
// v1 의 aux binary(0/100) 를 연속 기여로 교체하되, 대학-전공 루브릭(Step A) 이
// 아직 없으므로 **가중치는 v1 그대로** (academic 0.3 / career 0.4 / community 0.3).
// v1 은 교체하지 않고 병행 — buildStudentState 는 여전히 v1 을 영속하며, v2-pre
// 는 opt-in 라이브러리 API. UI/프롬프트 연결은 Step C 에서.

/**
 * volunteer 연속 기여 (0~100).
 * base 10 로그 스케일. totalHours=0 → 0, 10h → 50, 100h → 100 (cap).
 * Math.log10(0+1)=0 / log10(11)=1.04·50≈52 / log10(101)=2.004·50≈100.
 */
function volunteerContributionContinuous(volunteer: VolunteerState | null): number {
  if (!volunteer) return 0;
  const hours = Math.max(0, Number(volunteer.totalHours ?? 0));
  const raw = Math.log10(hours + 1) * 50;
  return Math.max(0, Math.min(100, raw));
}

/**
 * award level → 가중치. 자유 텍스트이므로 키워드 기반 매칭.
 * - '전국' / '국가' / '국제' 포함 → 1.3
 * - '교외' / '시도' / '지역' 포함 → 1.0
 * - '교내' 포함 → 0.8
 * - 그 외 / 빈 문자열 → 1.0 (중립 default)
 *
 * '도' 단독 키워드는 '교도'/'인도'/'수도권' 등 엉뚱한 매칭 위험이 있어 제외.
 * '시도'/'지역' 포괄 범위로 충분.
 */
function awardLevelWeight(level: string): number {
  const s = level.trim();
  if (s.length === 0) return 1.0;
  if (s.includes("전국") || s.includes("국가") || s.includes("국제")) return 1.3;
  if (s.includes("교외") || s.includes("시도") || s.includes("지역")) return 1.0;
  if (s.includes("교내")) return 0.8;
  return 1.0;
}

/**
 * awards 연속 기여 (0~100).
 * weighted_count = sum(level_weight); score = min(100, weighted_count × 20).
 *
 * 예: 1 교내 → 16 / 3 교내 → 48 / 5 교내 → 80 / 1 전국 → 26 / 3 전국 → 78.
 */
function awardsContributionContinuous(awards: AwardState | null): number {
  if (!awards || awards.items.length === 0) return 0;
  const weighted = awards.items.reduce(
    (sum, item) => sum + awardLevelWeight(item.level ?? ""),
    0,
  );
  return Math.max(0, Math.min(100, weighted * 20));
}

/** v2-pre aux 연속 기여 평균 (3 축). */
function computeAuxContributionV2Pre(
  volunteer: VolunteerState | null,
  awards: AwardState | null,
  attendance: AttendanceState | null,
): number {
  const vol = volunteerContributionContinuous(volunteer);
  const awd = awardsContributionContinuous(awards);
  // attendance null → 0 (v1 과 동일 보수적 처리)
  const att = attendance?.integrityScore ?? 0;
  return (vol + awd + att) / 3;
}

/**
 * α2 v2-pre: StudentState → HakjongScore (규칙 기반, aux 연속 기여).
 *
 * v1 과의 차이는 community 영역의 aux 축 기여가 binary → continuous 로 교체된 것.
 * academic / career / 가중치 / confidence 는 동일.
 *
 * target 매개변수는 추후 대학-전공 루브릭(Step A) 연결 지점 — v2-pre 단계에서는
 * 수용만 하고 적용은 하지 않는다. 루브릭 yaml 이 들어오면 AREA_WEIGHTS 오버라이드.
 */
export interface HakjongScoreTargetV2Pre {
  readonly universityTier?: string;
  readonly majorTier?: string;
}

export function computeHakjongScoreV2Pre(
  state: StudentState,
  _target?: HakjongScoreTargetV2Pre,
): HakjongScore {
  const axes = state.competencies?.axes ?? [];
  const academicAxes = axes.filter((a) => a.area === "academic");
  const careerAxes = axes.filter((a) => a.area === "career");
  const communityAxes = axes.filter((a) => a.area === "community");

  const academic = averageAxisScores(academicAxes);
  const career = averageAxisScores(careerAxes);

  const communityLayer1 = averageAxisScores(communityAxes);
  const communityAux = computeAuxContributionV2Pre(
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
  const communityConfidence = confidenceOfAxes(communityAxes, AREA_AXIS_MAX.community);
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
    version: "v2_rule_calibrated",
    confidence: {
      academic: round1(academicConfidence * 100) / 100,
      career: round1(careerConfidence * 100) / 100,
      community: round1(communityConfidence * 100) / 100,
      total: round1(totalConfidence * 100) / 100,
    },
  };
}
