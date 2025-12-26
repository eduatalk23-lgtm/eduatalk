"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { multiCampPlansQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampTemplate } from "@/lib/domains/camp/types";
import { CampSelector } from "../../camp-attendance/_components/CampSelector";
import { PlanSummaryCards } from "./PlanSummaryCards";
import { PlanTimeline } from "./PlanTimeline";
import { PlanStudentTable } from "./PlanStudentTable";
import { PlanDateGrid } from "./PlanDateGrid";

type ViewMode = "timeline" | "student" | "date";

type MultiCampPlansDashboardProps = {
  initialCamps: CampTemplate[];
};

export function MultiCampPlansDashboard({
  initialCamps,
}: MultiCampPlansDashboardProps) {
  // 선택된 캠프 ID들
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>(() =>
    initialCamps.slice(0, 3).map((c) => c.id)
  );

  // 선택된 날짜 (타임라인 뷰용)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // 날짜 범위 (전체 기간 조회용)
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>(() => {
    const selectedCamps = initialCamps.filter((c) =>
      selectedCampIds.includes(c.id)
    );
    const dates = selectedCamps
      .filter((c) => c.camp_start_date && c.camp_end_date)
      .flatMap((c) => [c.camp_start_date!, c.camp_end_date!]);

    if (dates.length > 0) {
      return {
        startDate: dates.sort()[0],
        endDate: dates.sort().reverse()[0],
      };
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7);

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  });

  // 보기 모드
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  // 데이터 조회 (타임라인은 특정 날짜, 나머지는 기간)
  const queryOptions =
    viewMode === "timeline"
      ? { date: selectedDate }
      : { startDate: dateRange.startDate, endDate: dateRange.endDate };

  const {
    data: plansData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery(multiCampPlansQueryOptions(selectedCampIds, queryOptions));

  // 선택된 캠프 정보
  const selectedCamps = useMemo(
    () => initialCamps.filter((c) => selectedCampIds.includes(c.id)),
    [initialCamps, selectedCampIds]
  );

  // 캠프 선택 변경
  const handleCampSelectionChange = (campId: string, selected: boolean) => {
    setSelectedCampIds((prev) => {
      if (selected) {
        return [...prev, campId];
      }
      return prev.filter((id) => id !== campId);
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedCampIds(initialCamps.map((c) => c.id));
    } else {
      setSelectedCampIds([]);
    }
  };

  // 날짜 이동
  const handleDateChange = (direction: "prev" | "next" | "today") => {
    const current = new Date(selectedDate);

    switch (direction) {
      case "prev":
        current.setDate(current.getDate() - 1);
        break;
      case "next":
        current.setDate(current.getDate() + 1);
        break;
      case "today":
        return setSelectedDate(new Date().toISOString().split("T")[0]);
    }

    setSelectedDate(current.toISOString().split("T")[0]);
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              플랜 진행 통합 관리
            </h1>
            <p className="text-sm text-gray-500">
              여러 캠프의 플랜 진행 현황을 한눈에 확인하고 관리하세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50",
                isFetching && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              새로고침
            </button>
            <Link
              href="/admin/camp-templates"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              캠프 목록
            </Link>
          </div>
        </div>

        {/* 캠프 선택 및 필터 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* 캠프 선택 */}
            <CampSelector
              camps={initialCamps}
              selectedCampIds={selectedCampIds}
              onSelectionChange={handleCampSelectionChange}
              onSelectAll={handleSelectAll}
            />

            {/* 날짜 및 보기 모드 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
              {/* 타임라인 뷰: 단일 날짜 선택 */}
              {viewMode === "timeline" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDateChange("prev")}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleDateChange("next")}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    →
                  </button>
                  <button
                    onClick={() => handleDateChange("today")}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    오늘
                  </button>
                </div>
              ) : (
                /* 다른 뷰: 기간 선택 */
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">보기:</span>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {[
                    { value: "timeline", label: "타임라인" },
                    { value: "student", label: "학생별" },
                    { value: "date", label: "날짜별" },
                  ].map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => setViewMode(mode.value as ViewMode)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition",
                        viewMode === mode.value
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-sm text-gray-500">플랜 데이터를 불러오는 중...</p>
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-800">{error.message}</p>
          </div>
        )}

        {/* 선택된 캠프 없음 */}
        {!isLoading && selectedCampIds.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <Filter className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              플랜 현황을 확인할 캠프를 선택해주세요.
            </p>
          </div>
        )}

        {/* 데이터 표시 */}
        {!isLoading && plansData && selectedCampIds.length > 0 && (
          <>
            {/* 요약 통계 */}
            <PlanSummaryCards
              summary={plansData.summary}
              camps={plansData.camps}
            />

            {/* 타임라인 뷰 */}
            {viewMode === "timeline" && (
              <PlanTimeline
                timeline={plansData.dailyTimeline}
                students={plansData.students}
                selectedDate={selectedDate}
              />
            )}

            {/* 학생별 뷰 */}
            {viewMode === "student" && (
              <PlanStudentTable
                students={plansData.students}
                camps={selectedCamps}
              />
            )}

            {/* 날짜별 뷰 */}
            {viewMode === "date" && (
              <PlanDateGrid
                dailyStats={plansData.dailyStats}
                camps={selectedCamps}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
