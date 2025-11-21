"use client";

import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { AlertCircle } from "lucide-react";
import { getScheduleResultDataAction } from "@/app/(student)/actions/planGroupActions";
import { ScheduleTableView } from "@/app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailySchedule, setDailySchedule] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [contents, setContents] = useState<Map<string, ContentData>>(new Map());
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getScheduleResultDataAction(groupId);

      if (result.plans.length === 0) {
        setError("생성된 플랜이 없습니다.");
        setLoading(false);
        return;
      }

      // contents 배열을 Map으로 변환
      const contentsMap = new Map(
        result.contents.map((c) => [c.id, c])
      );

      setDailySchedule(result.dailySchedule || []);
      setPlans(result.plans || []);
      setContents(contentsMap);
      setBlocks(result.blocks || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
      fetchData();
    }, [groupId, refreshKey]);

    // ref를 통해 외부에서 refresh 함수 호출 가능하도록
    useImperativeHandle(ref, () => ({
      refresh: () => {
        setRefreshKey((prev) => prev + 1);
      },
    }));

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
        <p className="mt-4 text-sm text-gray-500">스케줄을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">오류 발생</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
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

