"use client";

import { useQueries } from "@tanstack/react-query";
import { diagnosisTabQueryOptions } from "@/lib/query-options/studentRecord";
import type { GradeYearPair } from "./useRecordStageData";

/**
 * Phase 4: 진단 데이터 훅 (항상 활성 — 3+ 스테이지에서 사용)
 * - 전 학년 진단 prefetch
 * - diagnosisData, loading, error 반환
 */
export function useDiagnosisStageData({
  studentId,
  tenantId,
  initialSchoolYear,
  yearGradePairs,
}: {
  studentId: string;
  tenantId: string;
  initialSchoolYear: number;
  yearGradePairs: GradeYearPair[];
}) {
  const diagnosisQueries = useQueries({
    queries: yearGradePairs.map((p) => diagnosisTabQueryOptions(studentId, p.schoolYear, tenantId)),
  });

  const initialDiagIdx = yearGradePairs.findIndex((p) => p.schoolYear === initialSchoolYear);
  const diagnosisData = diagnosisQueries[initialDiagIdx >= 0 ? initialDiagIdx : 0]?.data ?? null;
  const diagnosisLoading = diagnosisQueries.some((q) => q.isLoading);
  const diagnosisError = diagnosisQueries.find((q) => q.error)?.error ?? null;

  return {
    diagnosisData,
    diagnosisLoading,
    diagnosisError,
  };
}
