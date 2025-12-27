"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, Wand2 } from "lucide-react";
import {
  getDashboardData,
  movePlanToDate,
  autoBalancePlans,
  toggleContentPause,
  deletePlan,
  moveMultiplePlansToDate,
  deleteMultiplePlans,
  type DashboardPlan,
} from "@/lib/domains/plan/actions/adjustDashboard";
import { PlanDetailModal } from "./PlanDetailModal";
import { WeeklyCalendarView } from "./WeeklyCalendarView";
import { ContentProgressList } from "./ContentProgressList";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type PlanGroupOption = {
  id: string;
  name: string;
};

type AdjustDashboardProps = {
  planGroups: PlanGroupOption[];
  defaultPlanGroupId: string;
};

export function AdjustDashboard({
  planGroups,
  defaultPlanGroupId,
}: AdjustDashboardProps) {
  const [selectedPlanGroupId, setSelectedPlanGroupId] = useState(defaultPlanGroupId);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState<DashboardPlan | null>(null);
  const [isPlanDetailOpen, setIsPlanDetailOpen] = useState(false);
  const [filterContentId, setFilterContentId] = useState<string | null>(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // 대시보드 데이터 조회
  const {
    data: dashboardResult,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["adjustDashboard", selectedPlanGroupId, weekOffset],
    queryFn: () => getDashboardData(selectedPlanGroupId, { weekOffset, weeksToShow: 2 }),
    staleTime: 1000 * 60, // 1분
  });

  const handlePlanMove = (planId: string, newDate: string) => {
    startTransition(async () => {
      const result = await movePlanToDate(planId, newDate);
      if (result.success) {
        showToast("플랜이 이동되었습니다.", "success");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
      } else {
        showToast(result.error || "플랜 이동 실패", "error");
      }
    });
  };

  const handleAutoBalance = () => {
    startTransition(async () => {
      const result = await autoBalancePlans(selectedPlanGroupId);
      if (result.success) {
        showToast(
          `${result.movedPlans || 0}개 플랜이 재배치되었습니다.`,
          "success"
        );
        refetch();
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
      } else {
        showToast(result.error || "자동 배치 실패", "error");
      }
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleWeekChange = (delta: number) => {
    setWeekOffset((prev) => prev + delta);
  };

  const handlePlanClick = (plan: DashboardPlan) => {
    setSelectedPlan(plan);
    setIsPlanDetailOpen(true);
  };

  const handlePlanDelete = (planId: string) => {
    startTransition(async () => {
      const result = await deletePlan(planId);
      if (result.success) {
        showToast("플랜이 삭제되었습니다.", "success");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
      } else {
        showToast(result.error || "플랜 삭제 실패", "error");
      }
    });
  };

  const handleContentPauseToggle = (contentId: string, isPaused: boolean) => {
    startTransition(async () => {
      const result = await toggleContentPause(contentId, isPaused);
      if (result.success) {
        showToast(
          isPaused ? "콘텐츠가 일시정지되었습니다." : "콘텐츠가 재개되었습니다.",
          "success"
        );
        refetch();
      } else {
        showToast(result.error || "상태 변경 실패", "error");
      }
    });
  };

  const handleMultiPlanMove = (planIds: string[], newDate: string) => {
    startTransition(async () => {
      const result = await moveMultiplePlansToDate(planIds, newDate);
      if (result.success) {
        showToast(`${result.movedCount}개 플랜이 이동되었습니다.`, "success");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
      } else {
        showToast(result.error || "플랜 이동 실패", "error");
      }
    });
  };

  const handleMultiPlanDelete = (planIds: string[]) => {
    startTransition(async () => {
      const result = await deleteMultiplePlans(planIds);
      if (result.success) {
        showToast(`${result.deletedCount}개 플랜이 삭제되었습니다.`, "success");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
      } else {
        showToast(result.error || "플랜 삭제 실패", "error");
      }
    });
  };

  const handleContentFilterClick = (contentId: string) => {
    setFilterContentId((prev) => (prev === contentId ? null : contentId));
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return "이번 주 ~ 다음 주";
    if (weekOffset === -1) return "지난 주 ~ 이번 주";
    if (weekOffset === 1) return "다음 주 ~ 그 다음 주";
    if (weekOffset > 0) return `${weekOffset}주 후`;
    return `${Math.abs(weekOffset)}주 전`;
  };

  return (
    <div className="space-y-6">
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* 플랜 그룹 선택 */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            플래너:
          </label>
          <select
            value={selectedPlanGroupId}
            onChange={(e) => setSelectedPlanGroupId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          >
            {planGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        {/* 주 네비게이션 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleWeekChange(-1)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-gray-700 dark:text-gray-300">
            {getWeekLabel()}
          </span>
          <button
            type="button"
            onClick={() => handleWeekChange(1)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            오늘
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isPending}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw
              className={cn("h-4 w-4", (isLoading || isPending) && "animate-spin")}
            />
            새로고침
          </button>
          <button
            type="button"
            onClick={handleAutoBalance}
            disabled={isPending || isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Wand2 className="h-4 w-4" />
            자동 배치
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* 에러 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">
            데이터를 불러오는 중 오류가 발생했습니다.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      {dashboardResult?.success && dashboardResult.data && (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* 캘린더 (왼쪽 3/4) */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <WeeklyCalendarView
                data={dashboardResult.data}
                onPlanMove={handlePlanMove}
                onPlanClick={handlePlanClick}
                onMultiPlanMove={handleMultiPlanMove}
                onMultiPlanDelete={handleMultiPlanDelete}
                isMoving={isPending}
                filterContentId={filterContentId}
              />
            </div>
          </div>

          {/* 사이드바 (오른쪽 1/4) */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <ContentProgressList
                contents={dashboardResult.data.contents}
                onPauseToggle={handleContentPauseToggle}
                onContentClick={(content) => handleContentFilterClick(content.contentId)}
                selectedContentId={filterContentId}
              />
            </div>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <h4 className="font-medium text-gray-700 dark:text-gray-300">사용 방법</h4>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>플랜을 드래그하여 다른 날짜로 이동할 수 있습니다.</li>
          <li>플랜을 클릭하면 상세 정보를 확인하고 수정할 수 있습니다.</li>
          <li>플랜 왼쪽 상단의 체크박스로 여러 플랜을 선택하여 한 번에 이동/삭제할 수 있습니다.</li>
          <li>오른쪽 콘텐츠 목록을 클릭하면 해당 콘텐츠 플랜만 필터링됩니다.</li>
          <li>지난 날짜 또는 완료된 플랜은 이동할 수 없습니다.</li>
          <li>콘텐츠를 일시정지하면 새로운 플랜이 생성되지 않습니다.</li>
          <li>
            &quot;자동 배치&quot; 버튼을 누르면 과부하된 날의 플랜을 여유 있는 날로
            자동 분산합니다.
          </li>
        </ul>
      </div>

      {/* 플랜 상세 모달 */}
      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          open={isPlanDetailOpen}
          onOpenChange={setIsPlanDetailOpen}
          onMove={handlePlanMove}
          onDelete={handlePlanDelete}
          isMoving={isPending}
        />
      )}
    </div>
  );
}
