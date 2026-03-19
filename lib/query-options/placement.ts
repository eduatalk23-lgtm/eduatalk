import { queryOptions } from "@tanstack/react-query";
import { fetchPlacementAnalysis } from "@/lib/domains/admission/placement/actions";
import type { SuneungScores } from "@/lib/domains/admission/calculator/types";

// ============================================
// Placement Analysis Query Options
// Phase 8.5a — 수동 실행 (enabled: false)
// ============================================

export const placementKeys = {
  all: ["placement"] as const,
  analysis: (studentId: string) =>
    [...placementKeys.all, "analysis", studentId] as const,
};

/**
 * 배치 분석 쿼리 옵션.
 * enabled: false → 수동 실행 (refetch로 트리거).
 */
export function placementAnalysisQueryOptions(
  studentId: string,
  suneungScores: SuneungScores | null,
  dataYear?: number,
) {
  return queryOptions({
    queryKey: placementKeys.analysis(studentId),
    queryFn: async () => {
      if (!suneungScores) throw new Error("점수 입력 필요");
      const result = await fetchPlacementAnalysis(studentId, suneungScores, dataYear);
      if (!result.success) throw new Error("error" in result ? result.error : "분석 실패");
      return result.data!;
    },
    staleTime: 5 * 60_000, // 5분
    gcTime: 10 * 60_000, // 10분
    enabled: false, // 수동 실행
  });
}
