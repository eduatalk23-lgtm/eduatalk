"use client";

import { useImperativeHandle, forwardRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { getScheduleResultDataAction } from "@/app/(student)/actions/planGroupActions";
import { ScheduleTableView } from "@/app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
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
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
    gcTime: 1000 * 60 * 10, // 10분간 메모리 유지
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
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">오류 발생</h3>
            <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-800">
          총 {plans.length}개의 플랜이 생성되었습니다.
        </p>
      </div>
      <ScheduleTableView
        dailySchedule={dailySchedule}
        plans={plans}
        contents={contents}
        blocks={blocks}
      />
    </div>
  );
  }
);

PlanScheduleView.displayName = "PlanScheduleView";

