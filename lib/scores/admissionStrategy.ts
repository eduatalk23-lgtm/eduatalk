/**
 * 수시/정시 유불리 분석 엔진
 * 
 * 내신과 모의고사 성적을 비교하여 수시/정시 전략을 분석합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 전략 유형
 */
export type StrategyType =
  | "MOCK_ADVANTAGE" // 모의고사/정시 우위
  | "INTERNAL_ADVANTAGE" // 내신/수시 우위
  | "BALANCED" // 균형형
  | "SPECIAL_HIGH_SCHOOL"; // 특목/자사고 패턴

/**
 * 전략 분석 결과
 */
export type StrategyResult = {
  type: StrategyType;
  message: string;
  data: {
    internalPct: number | null;
    mockPct: number | null;
    diff: number | null;
  };
};

/**
 * 내신 GPA를 백분위로 환산
 * 
 * @param curriculumRevisionId - 교육과정 개정 ID
 * @param totalGpa - 전체 내신 평균 등급
 * @returns 환산된 백분위 또는 null
 */
export async function getInternalPercentile(
  curriculumRevisionId: string,
  totalGpa: number
): Promise<number | null> {
  // grade_conversion_rules 테이블이 없으므로 간단한 환산 공식 사용
  // GPA 1.0 = 100%, GPA 9.0 = 0% (선형 환산)
  // 실제로는 더 정교한 환산 공식이 필요할 수 있음
  
  // 기본 환산 공식: percentile = 100 - (totalGpa - 1) * 12.5
  // GPA 1.0 → 100%, GPA 2.0 → 87.5%, GPA 3.0 → 75%, ..., GPA 9.0 → 0%
  const percentile = Math.max(0, Math.min(100, 100 - (totalGpa - 1) * 12.5));
  
  console.log(`[scores/admissionStrategy] GPA ${totalGpa} → 백분위 ${percentile.toFixed(2)}%`);
  
  return percentile;
}

/**
 * 수시/정시 유불리 전략 분석
 * 
 * @param internalPct - 내신 환산 백분위
 * @param mockPct - 모의고사 평균 백분위
 * @param zIndex - 내신 Z-Index (학업역량 지수)
 * @returns 전략 분석 결과
 */
export function analyzeAdmissionStrategy(
  internalPct: number | null,
  mockPct: number | null,
  zIndex: number | null
): StrategyResult {
  if (internalPct == null || mockPct == null) {
    return {
      type: "BALANCED",
      message: "내신 또는 모의고사 데이터가 부족해 정밀 비교가 어렵습니다.",
      data: { internalPct, mockPct, diff: null },
    };
  }

  const diff = mockPct - internalPct;

  let type: StrategyType;
  let message: string;

  if (diff > 5) {
    type = "MOCK_ADVANTAGE";
    message = "정시 파이터 전략이 유리합니다. 수능 중심 로드맵이 필요합니다.";
  } else if (diff < -5) {
    type = "INTERNAL_ADVANTAGE";
    message = "수시/학생부 위주 전략이 유리합니다. 내신·학교활동에 집중하세요.";
  } else {
    type = "BALANCED";
    message = "수시/정시 균형형입니다. 두 축 모두 준비하는 전략이 필요합니다.";
  }

  // 특목/자사고 패턴: 내신 등급은 낮은데, 내신 Z-Index + 모의고사 실력은 높은 경우
  if (diff > 5 && zIndex != null && zIndex >= 1.5) {
    type = "SPECIAL_HIGH_SCHOOL";
    message =
      "특목/자사고 유형 패턴입니다. 내신 등급 대비 원점수 경쟁력이 높아 학종·정시 병행 전략이 유리합니다.";
  }

  return {
    type,
    message,
    data: { internalPct, mockPct, diff },
  };
}

