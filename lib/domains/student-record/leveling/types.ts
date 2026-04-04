/**
 * 설계 모드 레벨링 타입 — L0~L7
 *
 * 이중 축: 목표(학교권) × 현실(내신) → 적정 레벨
 * 갭: 기대(학교권 기준) / 적정(내신 기준) / 현재(최신 분석)
 */

import type { SchoolTier } from "@/lib/constants/school-tiers";

/** 난이도 레벨 1(기초)~5(최심화) */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: "기초",
  2: "표준",
  3: "표준+",
  4: "심화",
  5: "최심화",
};

/** 레벨링 엔진 입력 (순수 함수용) */
export interface LevelingInput {
  /** 목표 학교권 (null이면 폴백 체인에서 추론) */
  targetSchoolTier: SchoolTier | null;
  /** 내신 전과목 평균 등급 1.0~9.0 (null이면 데이터 없음) */
  currentGpa: number | null;
  /** 학년 1~3 */
  grade: number;
  /** 최신 분석 결과 기반 현재 레벨 (projected scores 평균에서 산출, null이면 미분석) */
  currentLevel?: DifficultyLevel | null;
}

/** 레벨링 엔진 출력 */
export interface LevelingResult {
  /** 적정 레벨 — P7/P8에서 직접 사용 */
  adequateLevel: DifficultyLevel;

  /** 기대 수준: 목표 학교권 합격자 평균 기준 */
  expectedLevel: DifficultyLevel;
  /** 적정 수준: 현재 내신 기반 현실적 도달 가능 수준 */
  adequateFromGpa: DifficultyLevel;
  /** 현재 수준: 최신 분석 결과 (projected scores 기반, null이면 미분석) */
  currentLevel: DifficultyLevel | null;

  /** 갭 = 기대 - 현재 (양수=목표 대비 부족, 0=충족, 음수=초과). 현재 없으면 기대-적정 */
  gap: number;

  /** 사용된 학교권 (폴백 결과 포함) */
  resolvedTier: SchoolTier;
  /** 학교권 라벨 */
  tierLabel: string;
  /** 레벨 라벨 */
  levelLabel: string;

  /** P7 프롬프트 주입용 디렉티브 */
  levelDirective: string;

  /** 내신 데이터 존재 여부 */
  hasGpaData: boolean;
}

/** 파이프라인 통합 함수 입력 (DB 조회 포함) */
export interface LevelingForStudentInput {
  studentId: string;
  tenantId: string;
  grade: number;
}
