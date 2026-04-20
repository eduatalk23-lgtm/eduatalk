// ============================================
// α3-1: 청사진 GAP 엔진 — 타입 스펙 (2026-04-20)
//
// StudentState × Blueprint 목표 → 전체 축 GAP 측정.
// Reward 엔진(α2) 의 짝 — Reward 는 "현 상태 점수", GAP 은 "목표와의 거리".
//
// 기존 record-analysis/blueprint/types.ts 의 GapTracker 는
//   하이퍼엣지 매칭 수준 gap (unmatched/partial/competency_gap/quality_gap).
// 이 파일의 BlueprintGap 은 그 상위 레이어 —
//   학종 3영역 × 10 역량 축 × 청사진 목표의 거리.
//
// v1 규칙 (단순):
//   - axisGap: CompetencyGrade 수치 차이 (A+=6 ~ C=1, null=0). 양수=부족.
//   - areaGap: Reward 점수(0~100) 차이. 영역별 축 target 평균을 기준.
//   - pattern 4분류: insufficient / excess / mismatch / latent.
//   - priority: remainingSemesters + gapSize 조합.
// ============================================

import type { CompetencyArea, CompetencyGrade, CompetencyItemCode } from "./enums";
import type { StudentState } from "./student-state";

// ─── 패턴 분류 ────────────────────────────────────────────

/**
 * GAP 패턴 4분류.
 *
 * - insufficient: current < target. 가장 흔한 케이스.
 * - excess:       current > target + 다른 영역 insufficient 공존 (기회비용).
 *                 v1 은 "다른 영역" 판정은 상위 priority 산정에서.
 * - mismatch:     설계(ai_projected) 만 존재 + 실측(ai) 없음. 계획대로 실행 안 됨.
 * - latent:       current=null + target 있음 + 학기 여유 ≥ 2. 아직 시도 가능.
 *
 * v2 (exemplar calibration) 에서 세분화 예정.
 */
export type GapPattern = "insufficient" | "excess" | "mismatch" | "latent";

// ─── 입력: Blueprint 의 역량 목표 ──────────────────────────

/**
 * BlueprintPhaseOutput.competencyGrowthTargets 에서 파생.
 * v1 GAP 엔진은 축별 목표 등급만 요구. yearTarget/pathway 는 제안 생성 단계(α4)에서 소비.
 */
export interface CompetencyGradeTarget {
  readonly code: CompetencyItemCode;
  readonly targetGrade: CompetencyGrade;
  /** 목표 학년 (달성 기한). 우선순위/latent 판정에 사용. */
  readonly yearTarget: 1 | 2 | 3;
}

// ─── 축 단위 GAP ───────────────────────────────────────────

export interface AxisGap {
  readonly code: CompetencyItemCode;
  readonly area: CompetencyArea;
  readonly currentGrade: CompetencyGrade | null;
  readonly targetGrade: CompetencyGrade | null;
  /** targetNum - currentNum (등급 수치, A+=6 ~ C=1). 양수=부족, 음수=과잉. null 어느쪽이든 0 처리. */
  readonly gapSize: number;
  readonly pattern: GapPattern;
  /** 한 줄 근거 (한국어). */
  readonly rationale: string;
}

// ─── 영역 단위 GAP ─────────────────────────────────────────

export interface AreaGap {
  readonly area: CompetencyArea;
  /** 현 Reward 영역 점수 (0~100). state.hakjongScore 의 값 그대로. */
  readonly currentScore: number | null;
  /** 목표 점수 (0~100). 해당 영역 target 축들의 grade → score 평균. target 없으면 null. */
  readonly targetScore: number | null;
  /** target - current (점수 차이, 양수=부족). 둘 중 하나 null → null. */
  readonly gapSize: number | null;
  /** 주 원인 1문장. v1 은 해당 영역 최대 axisGap 의 code+pattern 요약. */
  readonly mainCause: string | null;
}

// ─── 최종 GAP 산출물 ───────────────────────────────────────

export interface BlueprintGap {
  readonly computedAt: string;
  readonly version: "v1_rule";
  /** (3 - currentGrade) × 2 + (currentSemester === 1 ? 1 : 0). 시급도 판정에 사용. */
  readonly remainingSemesters: number;
  readonly areaGaps: {
    readonly academic: AreaGap;
    readonly career: AreaGap;
    readonly community: AreaGap;
  };
  readonly axisGaps: readonly AxisGap[];
  /** 전체 우선순위. 최대 areaGap.gapSize + remainingSemesters 조합. */
  readonly priority: "high" | "medium" | "low";
  /** UI 1줄 노출용 요약 (예: "공동체역량 갭 18점. 주원인 = 봉사 활동 기록 0건"). */
  readonly summary: string;
}

// ─── 공개 함수 입력 ────────────────────────────────────────

export interface BlueprintGapInput {
  readonly state: StudentState;
  /** blueprint.competencyGrowthTargets 에서 파생. 빈 배열 허용(= target 미수립). */
  readonly targets: readonly CompetencyGradeTarget[];
  readonly currentGrade: 1 | 2 | 3;
  readonly currentSemester: 1 | 2;
  /**
   * α2-StepC (2026-04-20): v2-pre Reward 기반 currentScore 사용 여부.
   * true 이면 state.hakjongScoreV2Pre?.academic|career|community 를 areaGap.currentScore
   * 로 사용. v2Pre null 이면 v1 fallback. 기본 false (v1 canonical 유지).
   *
   * 사용처: 공동체 영역의 aux 연속 기여 차이가 GAP 에도 반영되어야 하는 경우.
   * Proposal Engine (α4) 이 v2-pre 기반 GAP 을 선호할 경우 opt-in.
   */
  readonly useV2Pre?: boolean;
}

// ─── α3-3 (2026-04-20): 다중 시나리오 브랜치 ──────────────────
//
// 단일 blueprint target 대신 3 시나리오(baseline/stable/aggressive) 동시 계산.
// baseline = 현 anchor.competencyGrowthTargets 그대로,
// stable   = 각 target 등급 -1 (보수적, 하한 C),
// aggressive = 각 target 등급 +1 (공격적, 상한 A+).
// 융합형(fusion) 은 LLM 기반 진로×공동체 균형 규칙 필요 → β 이월.

/** 시나리오 종류. v1 은 3 종. β 에서 'fusion' 추가. */
export type ScenarioType = "baseline" | "stable" | "aggressive";

/**
 * 다중 시나리오 GAP 계산 결과.
 * baseline 은 항상 존재. stable/aggressive 는 baseline 이 비어있으면 null.
 * dominantScenario 는 max areaGap 기준 최대 gap 시나리오.
 */
export interface MultiScenarioBlueprintGap {
  readonly computedAt: string;
  readonly version: "v1_rule_multi";
  readonly baseline: BlueprintGap;
  readonly stable: BlueprintGap | null;
  readonly aggressive: BlueprintGap | null;
  /** 3 시나리오 중 maxAreaGap 가장 큰 것. baseline targets 비어있으면 null. */
  readonly dominantScenario: ScenarioType | null;
}
