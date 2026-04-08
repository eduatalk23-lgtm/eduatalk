"use client";

import { useQuery } from "@tanstack/react-query";
import { strategyTabQueryOptions } from "@/lib/query-options/studentRecord";
import { scorePanelDataQueryOptions } from "@/lib/query-options/scores";

/**
 * Phase 4: 전략 데이터 훅
 * - 전략 탭 (applications, minScoreTargets 등)
 * - 성적 패널 데이터 (curriculum year, mock scores)
 */
export function useStrategyStageData({
  studentId,
  initialSchoolYear,
}: {
  studentId: string;
  initialSchoolYear: number;
}) {
  const { data: strategyData, isLoading: strategyLoading, error: strategyError } = useQuery(
    strategyTabQueryOptions(studentId, initialSchoolYear),
  );

  const { data: scorePanelData, isLoading: scorePanelLoading } = useQuery(
    scorePanelDataQueryOptions(studentId),
  );

  return {
    strategyData: strategyData ?? null,
    strategyLoading,
    strategyError,
    scorePanelData: scorePanelData ?? null,
    scorePanelLoading,
  };
}
