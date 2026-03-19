// ============================================
// 수시 6장 최적 배분 — 타입
// Phase 8.5b
// ============================================

import type { PlacementLevel } from "../placement/types";

/** 배분 후보 (수시 전형 한정) */
export interface AllocationCandidate {
  id: string;
  universityName: string;
  department: string;
  /** 수시 전형 (early_* only) */
  round: string;
  /** 컨설턴트 판정 (5단계) */
  placementLevel: PlacementLevel;
  /** 면접일 (YYYY-MM-DD) */
  interviewDate?: string | null;
}

/** 소신/적정/안정 티어 */
export type AllocationTier = "reach" | "target" | "safety";

/** 배분 설정 (슬롯 수 제약) */
export interface AllocationConfig {
  reach: { min: number; max: number };
  target: { min: number; max: number };
  safety: { min: number; max: number };
  /** 총 슬롯 수 (기본 6) */
  maxSlots: number;
  /** 전형 다양성 보너스 가중치 (0-1) */
  diversityBonus: number;
}

/** 추천 결과 (하나의 조합) */
export interface AllocationRecommendation {
  /** 선택된 후보 */
  slots: AllocationCandidate[];
  /** 티어별 분류 */
  byTier: Record<AllocationTier, AllocationCandidate[]>;
  /** 전형별 분류 */
  byRound: Record<string, AllocationCandidate[]>;
  /** 판정별 분류 */
  byLevel: Record<PlacementLevel, AllocationCandidate[]>;
  /** 종합 점수 (0-100) */
  score: number;
  /** 경고 메시지 */
  warnings: string[];
  /** 면접 겹침 */
  interviewConflicts: { university1: string; university2: string; date: string }[];
}

/** 기본 배분 설정 */
export const DEFAULT_ALLOCATION_CONFIG: AllocationConfig = {
  reach: { min: 1, max: 2 },
  target: { min: 2, max: 3 },
  safety: { min: 1, max: 2 },
  maxSlots: 6,
  diversityBonus: 0.2,
};

/** PlacementLevel → AllocationTier 매핑 */
export const LEVEL_TO_TIER: Record<PlacementLevel, AllocationTier> = {
  safe: "safety",
  possible: "target",
  bold: "reach",
  unstable: "reach",
  danger: "reach",
};

/** 티어 라벨 */
export const TIER_LABELS: Record<AllocationTier, string> = {
  reach: "소신",
  target: "적정",
  safety: "안정",
};
