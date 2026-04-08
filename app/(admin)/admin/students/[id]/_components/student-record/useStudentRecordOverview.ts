"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pipelineStatusQueryOptions,
  overviewQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";

/**
 * Phase 4: overview + pipeline 상태 훅 (항상 활성)
 * - 서버 overview: warnings + progressCounts
 * - 파이프라인 상태 폴링 (2초)
 * - 파이프라인 완료 시 관련 쿼리 자동 무효화
 */
export function useStudentRecordOverview({
  studentId,
  studentGrade,
  initialSchoolYear,
}: {
  studentId: string;
  studentGrade: number;
  initialSchoolYear: number;
}) {
  const { data: overviewData } = useQuery(
    overviewQueryOptions(studentId, studentGrade, initialSchoolYear),
  );

  const { data: pipelineData } = useQuery(pipelineStatusQueryOptions(studentId));
  const isPipelineRunning = pipelineData?.status === "running";

  // ─── 파이프라인 완료 시 관련 쿼리 자동 갱신 ──────────
  const queryClient = useQueryClient();
  const prevPipelineRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevPipelineRunningRef.current;
    prevPipelineRunningRef.current = isPipelineRunning;

    if (wasRunning && !isPipelineRunning) {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.overview(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTabPrefix(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.strategyTab(studentId, initialSchoolYear) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.edges(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.setekGuides(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.changcheGuides(studentId) });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.haengteukGuide(studentId) });
    }
  }, [isPipelineRunning, queryClient, studentId, initialSchoolYear]);

  return {
    warnings: overviewData?.warnings ?? [],
    progressCounts: overviewData?.progressCounts ?? { recordFilled: 0, recordTotal: 7, diagnosisFilled: 0, designFilled: 0, strategyFilled: 0 },
    pipelineData: pipelineData ?? null,
    isPipelineRunning,
  };
}
