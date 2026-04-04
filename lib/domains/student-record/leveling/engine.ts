/**
 * 레벨링 엔진 — 순수 연산 함수 (DB 호출 없음)
 *
 * 이중 축 교차:
 *   축 1 (목표): 학교권 → 기대 레벨
 *   축 2 (현실): 내신 평균 등급 → 적정 레벨
 *   교차점 = adequateLevel
 */

import type { SchoolTier } from "@/lib/constants/school-tiers";
import { SCHOOL_TIER_LABELS } from "@/lib/constants/school-tiers";
import type {
  DifficultyLevel,
  LevelingInput,
  LevelingResult,
} from "./types";
import { DIFFICULTY_LABELS } from "./types";

// ─── 학교권 → 기대 레벨 매핑 ───

const TIER_TO_EXPECTED_LEVEL: Record<SchoolTier, DifficultyLevel> = {
  sky_plus: 5,   // SKY+: 최심화
  in_seoul: 4,   // 인서울: 심화
  regional: 3,   // 지방거점: 표준+
  general: 2,    // 일반: 표준
};

/** 학교권 → 기대 내신 등급 범위 (참고용) */
export const TIER_TO_GPA_RANGE: Record<SchoolTier, { min: number; max: number }> = {
  sky_plus: { min: 1.0, max: 2.0 },
  in_seoul: { min: 2.0, max: 3.5 },
  regional: { min: 3.0, max: 5.0 },
  general: { min: 4.0, max: 9.0 },
};

// ─── 내신 → 레벨 매핑 ───

/** 내신 평균 등급 → 난이도 레벨 (등급이 낮을수록 높은 레벨) */
export function gpaToLevel(gpa: number): DifficultyLevel {
  if (gpa <= 1.5) return 5;
  if (gpa <= 2.5) return 4;
  if (gpa <= 4.0) return 3;
  if (gpa <= 6.0) return 2;
  return 1;
}

/** 내신 평균 등급 → 추론 학교권 (폴백 2순위) */
export function gpaToInferredTier(gpa: number): SchoolTier {
  if (gpa <= 2.0) return "sky_plus";
  if (gpa <= 3.5) return "in_seoul";
  if (gpa <= 5.0) return "regional";
  return "general";
}

/** 학교권 → 기대 레벨 */
export function tierToExpectedLevel(tier: SchoolTier): DifficultyLevel {
  return TIER_TO_EXPECTED_LEVEL[tier];
}

// ─── 핵심: 이중 축 교차 ───

/**
 * 적정 레벨 산출 (이중 축 교차)
 *
 * - 내신 데이터 있음: min(기대, 내신 기반) — 현실적 상한
 *   단, 내신이 기대보다 높으면 기대 레벨 유지 (목표 존중)
 * - 내신 데이터 없음: 기대 레벨 그대�� (축 1 단독)
 */
export function computeAdequateLevel(input: LevelingInput): LevelingResult {
  const { targetSchoolTier, currentGpa, grade, currentLevel: inputCurrentLevel } = input;

  // 학교��� 결정 (null이면 ���본값)
  const resolvedTier: SchoolTier = targetSchoolTier ?? "general";
  const expectedLevel = tierToExpectedLevel(resolvedTier);

  const hasGpaData = currentGpa !== null && currentGpa > 0;

  let adequateFromGpa: DifficultyLevel;
  let adequateLevel: DifficultyLevel;

  if (hasGpaData) {
    adequateFromGpa = gpaToLevel(currentGpa!);

    // ��차: 기대와 현실 중 낮은 쪽 (현실적 상한)
    // 단, 내신이 기대보다 높으면(=더 좋으면) 기대 레벨 유지
    adequateLevel = Math.min(expectedLevel, adequateFromGpa) as DifficultyLevel;

    // 고3은 1단계 상향 보정 (��시 임박)
    if (grade === 3 && adequateLevel < 5) {
      adequateLevel = (adequateLevel + 1) as DifficultyLevel;
    }
  } else {
    // 내신 없음 (신입생): 축 1 단독
    adequateFromGpa = expectedLevel;
    adequateLevel = expectedLevel;
  }

  // 현재 수준: 외부 주입(projected scores 기반) 또는 null
  const currentLevel = inputCurrentLevel ?? null;

  // 갭 = 기대 vs 현재 (설계서 정의). 현재 없으면 기대 vs 적정으로 폴백.
  const gap = currentLevel !== null
    ? expectedLevel - currentLevel
    : expectedLevel - adequateFromGpa;

  const tierLabel = SCHOOL_TIER_LABELS[resolvedTier];
  const levelLabel = DIFFICULTY_LABELS[adequateLevel];

  return {
    adequateLevel,
    expectedLevel,
    adequateFromGpa,
    currentLevel,
    gap,
    resolvedTier,
    tierLabel,
    levelLabel,
    levelDirective: buildLevelDirective(resolvedTier, adequateLevel, gap, hasGpaData),
    hasGpaData,
  };
}

// ─── 프롬프트 디렉티브 생성 ───

function buildLevelDirective(
  tier: SchoolTier,
  level: DifficultyLevel,
  gap: number,
  hasGpaData: boolean,
): string {
  const tierLabel = SCHOOL_TIER_LABELS[tier];
  const levelLabel = DIFFICULTY_LABELS[level];

  const depthGuide: Record<DifficultyLevel, string> = {
    1: "기초 개념 이해와 교과 내용 정리 수준으로 작성합니다. 교과서 핵심 내용을 충실히 반영하세요.",
    2: "교과 내용을 바탕으로 기본적인 탐구 활동을 포함합니다. 교과 연계 활동��� 구체적으로 서술하세요.",
    3: "교과 심화 내용과 자기주도적 탐구를 포함합니다. 교과 내 주제를 확장하여 깊이 있게 다루세요.",
    4: "교과 간 융합 탐구와 학술적 깊이를 갖춘 내용으로 작성합니다. 선행 연구나 이론을 참고한 탐구를 포함하세요.",
    5: "학술 논문 수준의 탐구 ��계와 비판적 분석을 포함합니다. 독창���인 연구 질문과 방법론을 제시하세요.",
  };

  let directive = `[난이도: ${levelLabel}] 목표 학교권 ${tierLabel} 기준, 난이도 레벨 ${level}/5입니다.\n`;
  directive += depthGuide[level];

  if (hasGpaData && gap > 0) {
    directive += `\n현재 내신 대비 목표 학교권 기대 수준이 ${gap}단계 높습니다. 단계적 성장을 고려하여 도전적이되 달성 가능한 수준으로 조정하세요.`;
  } else if (hasGpaData && gap < 0) {
    directive += `\n내신 성적이 목표 학교권 기준 이상입니다. 현재 역량을 최대한 발휘할 수 있는 심화 탐구를 권장합니다.`;
  }

  return directive;
}
