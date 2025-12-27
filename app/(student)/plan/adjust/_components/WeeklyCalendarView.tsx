"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, Lightbulb, Check, X, ArrowRight, Trash2 } from "lucide-react";
import type { DashboardData, DashboardPlan, ConflictInfo } from "@/lib/domains/plan/actions/adjustDashboard";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type WeeklyCalendarViewProps = {
  data: DashboardData;
  onPlanMove: (planId: string, newDate: string) => void;
  onPlanClick?: (plan: DashboardPlan) => void;
  onMultiPlanMove?: (planIds: string[], newDate: string) => void;
  onMultiPlanDelete?: (planIds: string[]) => void;
  isMoving?: boolean;
  filterContentId?: string | null;
};

export function WeeklyCalendarView({
  data,
  onPlanMove,
  onPlanClick,
  onMultiPlanMove,
  onMultiPlanDelete,
  isMoving = false,
  filterContentId = null,
}: WeeklyCalendarViewProps) {
  const [draggedPlan, setDraggedPlan] = useState<DashboardPlan | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [targetDateForMove, setTargetDateForMove] = useState<string | null>(null);

  // 멀티 선택 토글
  const togglePlanSelection = useCallback((planId: string) => {
    setSelectedPlanIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      // 선택된 항목이 없으면 멀티 선택 모드 해제
      if (newSet.size === 0) {
        setIsMultiSelectMode(false);
      }
      return newSet;
    });
  }, []);

  // 전체 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedPlanIds(new Set());
    setIsMultiSelectMode(false);
    setTargetDateForMove(null);
  }, []);

  // 멀티 이동 실행
  const handleMultiMove = useCallback(() => {
    if (onMultiPlanMove && targetDateForMove && selectedPlanIds.size > 0) {
      onMultiPlanMove(Array.from(selectedPlanIds), targetDateForMove);
      clearSelection();
    }
  }, [onMultiPlanMove, targetDateForMove, selectedPlanIds, clearSelection]);

  // 멀티 삭제 실행
  const handleMultiDelete = useCallback(() => {
    if (onMultiPlanDelete && selectedPlanIds.size > 0) {
      onMultiPlanDelete(Array.from(selectedPlanIds));
      clearSelection();
    }
  }, [onMultiPlanDelete, selectedPlanIds, clearSelection]);

  // 날짜 배열 생성
  const dates = useMemo(() => {
    const result: string[] = [];
    const start = new Date(data.dateRange.startDate);
    const end = new Date(data.dateRange.endDate);

    const current = new Date(start);
    while (current <= end) {
      result.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return result;
  }, [data.dateRange]);

  // 주 단위로 날짜 그룹화
  const weeks = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      result.push(dates.slice(i, i + 7));
    }
    return result;
  }, [dates]);

  // 날짜별 충돌 맵
  const conflictsByDate = useMemo(() => {
    const map = new Map<string, ConflictInfo>();
    for (const conflict of data.conflicts) {
      map.set(conflict.date, conflict);
    }
    return map;
  }, [data.conflicts]);

  // 필터링 적용된 플랜 맵
  const filteredPlans = useMemo(() => {
    if (!filterContentId) return data.plans;

    const filtered: Record<string, DashboardPlan[]> = {};
    for (const [date, plans] of Object.entries(data.plans)) {
      const filteredDatePlans = plans.filter((p) => p.contentId === filterContentId);
      if (filteredDatePlans.length > 0) {
        filtered[date] = filteredDatePlans;
      }
    }
    return filtered;
  }, [data.plans, filterContentId]);

  // 일별 통계 계산
  const dailyStats = useMemo(() => {
    const stats: Record<string, { totalMinutes: number; planCount: number; completedCount: number }> = {};
    for (const date of dates) {
      const datePlans = data.plans[date] || [];
      stats[date] = {
        totalMinutes: datePlans.reduce((sum, p) => sum + p.estimatedMinutes, 0),
        planCount: datePlans.length,
        completedCount: datePlans.filter((p) => p.status === "completed").length,
      };
    }
    return stats;
  }, [dates, data.plans]);

  // 최대 학습 시간 (차트 스케일링용)
  const maxMinutes = useMemo(() => {
    return Math.max(...Object.values(dailyStats).map((s) => s.totalMinutes), 60);
  }, [dailyStats]);

  const handleDragStart = (e: React.DragEvent, plan: DashboardPlan) => {
    e.dataTransfer.setData("planId", plan.id);
    setDraggedPlan(plan);
  };

  const handleDragEnd = () => {
    setDraggedPlan(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(date);
  };

  const handleDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    const planId = e.dataTransfer.getData("planId");
    if (planId && draggedPlan && date !== draggedPlan.planDate) {
      onPlanMove(planId, date);
    }
    setDraggedPlan(null);
    setDragOverDate(null);
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  const isPast = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr < today;
  };

  return (
    <div className="space-y-6">
      {/* 멀티 선택 액션 바 */}
      {selectedPlanIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedPlanIds.size}개 선택됨
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* 이동 대상 날짜 선택 */}
            {onMultiPlanMove && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={targetDateForMove || ""}
                  onChange={(e) => setTargetDateForMove(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="rounded-lg border border-blue-300 px-2 py-1 text-sm dark:border-blue-600 dark:bg-blue-900/50"
                />
                <button
                  type="button"
                  onClick={handleMultiMove}
                  disabled={!targetDateForMove || isMoving}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <ArrowRight className="h-4 w-4" />
                  이동
                </button>
              </div>
            )}
            {/* 삭제 버튼 */}
            {onMultiPlanDelete && (
              <button
                type="button"
                onClick={handleMultiDelete}
                disabled={isMoving}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            )}
          </div>
        </div>
      )}

      {/* 충돌 경고 */}
      {data.conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-medium">학습량 과부하 경고</h3>
          </div>
          <ul className="mt-2 space-y-1">
            {data.conflicts.map((conflict, idx) => (
              <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                • {conflict.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 추천 */}
      {data.recommendations.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Lightbulb className="h-5 w-5" />
            <h3 className="font-medium">추천</h3>
          </div>
          <ul className="mt-2 space-y-1">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                • {rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 캘린더 */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* 요일 헤더 */}
            <div className="mb-2 grid grid-cols-7 gap-2">
              {week.map((date) => {
                const dayOfWeek = new Date(date).getDay();
                const conflict = conflictsByDate.get(date);

                return (
                  <div
                    key={date}
                    className={cn(
                      "rounded-lg p-2 text-center",
                      isToday(date)
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : isPast(date)
                          ? "bg-gray-100 dark:bg-gray-800"
                          : "bg-gray-50 dark:bg-gray-900",
                      conflict && "ring-2 ring-red-400"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-medium",
                        dayOfWeek === 0
                          ? "text-red-500"
                          : dayOfWeek === 6
                            ? "text-blue-500"
                            : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {WEEKDAY_LABELS[dayOfWeek]}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isToday(date)
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-900 dark:text-gray-100"
                      )}
                    >
                      {formatDateDisplay(date)}
                    </div>
                    {conflict && (
                      <div className="mt-1 text-xs text-red-500">
                        ⚠️ {Math.round(conflict.totalMinutes / 60)}h
                      </div>
                    )}
                    {/* 일별 학습량 바 */}
                    {!conflict && dailyStats[date] && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              dailyStats[date].totalMinutes > 180
                                ? "bg-red-500"
                                : dailyStats[date].totalMinutes > 120
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            )}
                            style={{
                              width: `${Math.min((dailyStats[date].totalMinutes / maxMinutes) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {dailyStats[date].totalMinutes}분
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 플랜 셀 */}
            <div className="grid grid-cols-7 gap-2">
              {week.map((date) => {
                const datePlans = filteredPlans[date] || [];
                const isDragOver = dragOverDate === date;
                const canDrop = !isPast(date);

                return (
                  <div
                    key={date}
                    className={cn(
                      "min-h-[120px] rounded-lg border-2 border-dashed p-2 transition-colors",
                      isDragOver && canDrop
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700",
                      isPast(date) && "opacity-60"
                    )}
                    onDragOver={(e) => canDrop && handleDragOver(e, date)}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(e) => canDrop && handleDrop(e, date)}
                  >
                    {datePlans.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                        플랜 없음
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {datePlans.map((plan) => {
                          const isSelected = selectedPlanIds.has(plan.id);
                          const canSelect = plan.status === "pending" && !isPast(date);

                          return (
                            <div
                              key={plan.id}
                              className={cn(
                                "relative rounded-md transition-all",
                                isSelected && "ring-2 ring-blue-500 ring-offset-1"
                              )}
                            >
                              {/* 체크박스 (pending 상태만) */}
                              {canSelect && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePlanSelection(plan.id);
                                    if (!isMultiSelectMode) {
                                      setIsMultiSelectMode(true);
                                    }
                                  }}
                                  className={cn(
                                    "absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                                    isSelected
                                      ? "border-blue-500 bg-blue-500 text-white"
                                      : "border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800"
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </button>
                              )}
                              <div
                                draggable={canSelect && !isMoving && !isMultiSelectMode}
                                onDragStart={(e) => handleDragStart(e, plan)}
                                onDragEnd={handleDragEnd}
                                onClick={() => !isMultiSelectMode && onPlanClick?.(plan)}
                                className={cn(
                                  "cursor-pointer rounded-md px-2 py-1.5 text-xs transition-all",
                                  "hover:shadow-md",
                                  plan.status === "completed"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    : plan.status === "in_progress"
                                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                      : "text-white",
                                  canSelect && !isMultiSelectMode && "cursor-grab active:cursor-grabbing",
                                  draggedPlan?.id === plan.id && "opacity-50"
                                )}
                                style={{
                                  backgroundColor:
                                    plan.status === "pending"
                                      ? plan.color
                                      : undefined,
                                }}
                              >
                                <div className="truncate font-medium">
                                  {plan.contentTitle}
                                </div>
                                <div className="flex items-center justify-between opacity-80">
                                  <span>
                                    {plan.rangeStart}-{plan.rangeEnd}
                                  </span>
                                  <span>{plan.estimatedMinutes}분</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
