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
 * - 파이프라인 상태 구독 (폴링은 DesignPipelineResultsPanel 가 담당, 본 훅은 동일 query key 공유로 데이터만 수신)
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

  const { data: pipelineData } = useQuery({
    ...pipelineStatusQueryOptions(studentId),
    // 본 훅은 자체 폴링하지 않음 — 동일 queryKey 의 다른 subscriber(DesignPipelineResultsPanel)
    // 가 폴링할 때만 갱신 데이터를 수신. 우발적 폴링 발생을 막기 위해 명시.
    refetchInterval: false,
  });
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
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.warningSnapshots(studentId) });
    }
  }, [isPipelineRunning, queryClient, studentId, initialSchoolYear]);

  return {
    warnings: overviewData?.warnings ?? [],
    progressCounts: overviewData?.progressCounts ?? { recordFilled: 0, recordTotal: 7, diagnosisFilled: 0, designFilled: 0, strategyFilled: 0 },
    pipelineData: pipelineData ?? null,
    isPipelineRunning,
  };
}
