"use client";

import { useQuery } from "@tanstack/react-query";
import {
  storylineTabQueryOptions,
  coursePlanTabQueryOptions,
} from "@/lib/query-options/studentRecord";

/**
 * Phase 4: 설계 데이터 훅
 * - 스토리라인/로드맵
 * - 수강 계획
 * - 온보딩 체크리스트에서도 사용하므로 항상 활성
 */
export function useDesignStageData({
  studentId,
  initialSchoolYear,
}: {
  studentId: string;
  initialSchoolYear: number;
}) {
  const { data: storylineData, isLoading: storylineLoading, error: storylineError } = useQuery(
    storylineTabQueryOptions(studentId, initialSchoolYear),
  );

  const { data: coursePlanData } = useQuery(coursePlanTabQueryOptions(studentId));

  return {
    storylineData: storylineData ?? null,
    storylineLoading,
    storylineError,
    coursePlanData: coursePlanData ?? null,
  };
}
