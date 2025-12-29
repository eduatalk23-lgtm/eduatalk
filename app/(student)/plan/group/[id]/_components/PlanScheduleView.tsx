"use client";

import { useImperativeHandle, forwardRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { getScheduleResultDataAction } from "@/app/(student)/actions/planGroupActions";
import {
  CACHE_STALE_TIME_STABLE,
  CACHE_GC_TIME_STABLE
} from "@/lib/constants/queryCache";
import { PlanListView } from "./PlanListView";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

// 스케줄 테이블 뷰를 동적 import로 로드 (번들 분할)
const ScheduleTableView = dynamic(
  () => import("@/app/(student)/plan/new-group/_components/_features/scheduling/components/ScheduleTableView").then((mod) => ({ default: mod.ScheduleTableView })),
  { loading: () => <LoadingSkeleton variant="schedule" />, ssr: false }
);
import type {
  ContentData,
  BlockData,
} from "@/app/(student)/plan/new-group/_components/utils/scheduleTransform";

type PlanScheduleViewProps = {
  groupId: string;
};

export type PlanScheduleViewRef = {
  refresh: () => void;
};

export const PlanScheduleView = forwardRef<PlanScheduleViewRef, PlanScheduleViewProps>(
  ({ groupId }, ref) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"schedule" | "table">("schedule");

  // React Query를 사용한 데이터 페칭
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["planSchedule", groupId],
    queryFn: async () => {
      const result = await getScheduleResultDataAction(groupId);

      if (result.plans.length === 0) {
        throw new Error("생성된 플랜이 없습니다.");
      }

      // contents 배열을 Map으로 변환
      const contentsMap = new Map(
        result.contents.map((c) => [c.id, c])
      );

      return {
        dailySchedule: result.dailySchedule || [],
        plans: result.plans || [],
        contents: contentsMap,
        blocks: result.blocks || [],
      };
    },
    staleTime: CACHE_STALE_TIME_STABLE, // 5분간 캐시 유지 (Stable Data)
    gcTime: CACHE_GC_TIME_STABLE, // 15분간 메모리 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 재요청 방지
    refetchOnMount: false, // 마운트 시 자동 재요청 방지 (캐시된 데이터가 있으면 사용)
    refetchOnReconnect: false, // 네트워크 재연결 시 자동 재요청 방지
  });

  // ref를 통해 외부에서 refresh 함수 호출 가능하도록
  useImperativeHandle(ref, () => ({
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["planSchedule", groupId] });
    },
  }));

  if (isLoading) {
    return <LoadingSkeleton variant="schedule" />;
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "데이터를 불러오는 중 오류가 발생했습니다.";
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex flex-1 flex-col gap-1">
            <h3 className="text-sm font-semibold text-red-800">오류 발생</h3>
            <p className="text-sm text-red-700">{errorMessage}</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { dailySchedule, plans, contents, blocks } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-800">
          총 {plans.length}개의 플랜이 생성되었습니다.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("schedule")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "schedule"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            일별 스케줄
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "table"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            플랜 테이블
          </button>
        </div>
      </div>
      {viewMode === "schedule" ? (
        <ScheduleTableView
          dailySchedule={dailySchedule}
          plans={plans}
          contents={contents}
          blocks={blocks}
        />
      ) : (
        <PlanListView
          plans={plans}
          contents={contents}
          isLoading={isLoading}
        />
      )}
    </div>
  );
  }
);

PlanScheduleView.displayName = "PlanScheduleView";

