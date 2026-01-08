"use client";

/**
 * 플래너 선택 컴포넌트
 *
 * 플랜 생성 전 필수로 플래너를 선택하도록 유도
 * 관리자 영역에서 플랜 생성 시 일관된 UI 제공
 *
 * @module components/plan/PlannerSelector
 */

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  ChevronDown,
  Loader2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Planner } from "@/lib/domains/admin-plan/actions/planners";

export type PlannerSelectorProps = {
  /** 학생 ID - 해당 학생의 플래너 목록 조회 */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 현재 선택된 플래너 ID */
  selectedId: string | undefined;
  /** 플래너 선택 시 콜백 */
  onSelect: (id: string) => void;
  /** 새 플래너 생성 버튼 클릭 시 콜백 */
  onCreateNew?: () => void;
  /** 선택 필수 여부 (기본값: true) */
  required?: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스명 */
  className?: string;
  /** 플래너 목록 (외부에서 제공 시) */
  planners?: Planner[];
  /** 로딩 상태 (외부에서 제공 시) */
  isLoading?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
};

/**
 * 플래너 선택 드롭다운 컴포넌트
 *
 * 사용 예시:
 * ```tsx
 * <PlannerSelector
 *   studentId={studentId}
 *   tenantId={tenantId}
 *   selectedId={selectedPlannerId}
 *   onSelect={setSelectedPlannerId}
 *   onCreateNew={() => setShowCreateModal(true)}
 *   required
 * />
 * ```
 */
export function PlannerSelector({
  studentId,
  tenantId,
  selectedId,
  onSelect,
  onCreateNew,
  required = true,
  disabled = false,
  className,
  planners: externalPlanners,
  isLoading: externalLoading,
  compact = false,
}: PlannerSelectorProps) {
  const [internalPlanners, setInternalPlanners] = useState<Planner[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 외부 데이터 사용 여부
  const planners = externalPlanners ?? internalPlanners;
  const isLoading = externalLoading ?? internalLoading;

  // 플래너 목록 로드 (외부 데이터가 없을 때만)
  useEffect(() => {
    if (externalPlanners !== undefined) {
      setInternalLoading(false);
      return;
    }

    async function loadPlanners() {
      if (!studentId || !tenantId) {
        setInternalLoading(false);
        return;
      }

      try {
        setError(null);
        const response = await fetch(
          `/api/admin/students/${studentId}/planners`
        );

        if (!response.ok) {
          throw new Error("플래너 목록 조회 실패");
        }

        const result = await response.json();
        if (result.success && result.data) {
          // 활성 상태의 플래너만 필터링
          const activePlanners = result.data.filter(
            (p: Planner) => p.status !== "archived" && p.status !== "completed"
          );
          setInternalPlanners(activePlanners);
        }
      } catch (err) {
        console.error("[PlannerSelector] 플래너 로드 실패:", err);
        setError("플래너 목록을 불러올 수 없습니다.");
        setInternalPlanners([]);
      } finally {
        setInternalLoading(false);
      }
    }

    loadPlanners();
  }, [studentId, tenantId, externalPlanners]);

  const selectedPlanner = planners.find((p) => p.id === selectedId);

  const formatPeriod = useCallback(
    (start: string | null, end: string | null) => {
      if (!start || !end) return "";
      const startDate = new Date(start);
      const endDate = new Date(end);
      return `${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`;
    },
    []
  );

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setIsOpen(false);
    },
    [onSelect]
  );

  // 로딩 상태
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400",
          compact && "py-1.5",
          className
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>플래너 로드 중...</span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-600 dark:bg-red-900/20 dark:text-red-400",
          className
        )}
      >
        <AlertTriangle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  // 플래너가 없을 때
  if (planners.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-900/20",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {required
              ? "플래너가 없습니다. 먼저 플래너를 생성해주세요."
              : "등록된 플래너가 없습니다."}
          </span>
        </div>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            플래너 만들기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* 선택 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors",
          compact ? "py-2" : "py-2.5",
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800"
            : "border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500",
          isOpen && "border-indigo-500 ring-2 ring-indigo-500/20",
          !selectedId &&
            required &&
            "border-amber-400 dark:border-amber-500"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar
            className={cn(
              "h-4 w-4 shrink-0",
              selectedId ? "text-indigo-500" : "text-gray-400"
            )}
          />
          {selectedPlanner ? (
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                {selectedPlanner.name}
              </span>
              {!compact && selectedPlanner.periodStart && selectedPlanner.periodEnd && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatPeriod(
                    selectedPlanner.periodStart,
                    selectedPlanner.periodEnd
                  )}
                </span>
              )}
            </div>
          ) : (
            <span
              className={cn(
                required
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              {required ? "플래너 선택 (필수)" : "플래너 선택"}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <>
          {/* 오버레이 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 옵션 목록 */}
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {planners.map((planner) => (
              <button
                key={planner.id}
                type="button"
                onClick={() => handleSelect(planner.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors",
                  selectedId === planner.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                )}
              >
                <Calendar className="h-4 w-4 shrink-0 text-indigo-500" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate font-medium">{planner.name}</span>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {planner.periodStart && planner.periodEnd && (
                      <span>
                        {formatPeriod(planner.periodStart, planner.periodEnd)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        planner.status === "active" &&
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        planner.status === "draft" &&
                          "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
                        planner.status === "paused" &&
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}
                    >
                      {planner.status === "active" && "활성"}
                      {planner.status === "draft" && "초안"}
                      {planner.status === "paused" && "일시정지"}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* 새 플래너 만들기 버튼 */}
            {onCreateNew && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600" />
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCreateNew();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>새 플래너 만들기</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 플래너 미선택 경고 배너
 */
export function PlannerRequiredBanner({
  onCreateNew,
  className,
}: {
  onCreateNew?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20",
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-amber-800 dark:text-amber-200">
          플래너를 선택해주세요
        </h4>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          플랜을 생성하려면 먼저 상단에서 플래너를 선택하거나 생성해야 합니다.
        </p>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            플래너 만들기
          </button>
        )}
      </div>
    </div>
  );
}
