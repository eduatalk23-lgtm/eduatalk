"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { multiCampAttendanceQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampTemplate } from "@/lib/domains/camp/types";
import { CampSelector } from "./CampSelector";
import { AttendanceSummaryCards } from "./AttendanceSummaryCards";
import { AttendanceDateGrid } from "./AttendanceDateGrid";
import { AttendanceStudentTable } from "./AttendanceStudentTable";

type ViewMode = "date" | "camp" | "student";

type MultiCampAttendanceDashboardProps = {
  initialCamps: CampTemplate[];
};

export function MultiCampAttendanceDashboard({
  initialCamps,
}: MultiCampAttendanceDashboardProps) {
  // 선택된 캠프 ID들
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>(() =>
    initialCamps.slice(0, 3).map((c) => c.id)
  );

  // 날짜 범위
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>(() => {
    // 선택된 캠프들의 기간을 계산
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

    // 기본값: 오늘 기준 ±7일
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
  const [viewMode, setViewMode] = useState<ViewMode>("date");

  // 상세 정보 펼침 상태
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary"])
  );

  // 데이터 조회
  const {
    data: attendanceData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery(
    multiCampAttendanceQueryOptions(
      selectedCampIds,
      dateRange.startDate,
      dateRange.endDate
    )
  );

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

  // 날짜 범위 변경
  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ startDate: start, endDate: end });
  };

  // 섹션 토글
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              출석 통합 관리
            </h1>
            <p className="text-sm text-gray-500">
              여러 캠프의 출석 현황을 한눈에 확인하고 관리하세요.
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

            {/* 날짜 범위 및 보기 모드 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      handleDateRangeChange(e.target.value, dateRange.endDate)
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      handleDateRangeChange(dateRange.startDate, e.target.value)
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">보기:</span>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {[
                    { value: "date", label: "날짜별" },
                    { value: "camp", label: "캠프별" },
                    { value: "student", label: "학생별" },
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
              <p className="text-sm text-gray-500">출석 데이터를 불러오는 중...</p>
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
              출석 현황을 확인할 캠프를 선택해주세요.
            </p>
          </div>
        )}

        {/* 데이터 표시 */}
        {!isLoading && attendanceData && selectedCampIds.length > 0 && (
          <>
            {/* 요약 통계 */}
            <AttendanceSummaryCards
              summary={attendanceData.summary}
              camps={attendanceData.camps}
            />

            {/* 날짜별 출석 그리드 */}
            {viewMode === "date" && (
              <AttendanceDateGrid
                dailyStats={attendanceData.dailyStats}
                camps={selectedCamps}
              />
            )}

            {/* 캠프별 보기 */}
            {viewMode === "camp" && (
              <div className="flex flex-col gap-4">
                {attendanceData.camps.map((camp) => (
                  <div
                    key={camp.id}
                    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {camp.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {camp.campStartDate} ~ {camp.campEndDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">
                            {camp.totalParticipants}
                          </p>
                          <p className="text-xs text-gray-500">참여자</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {camp.attendanceRate}%
                          </p>
                          <p className="text-xs text-gray-500">출석률</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-yellow-600">
                            {camp.lateRate}%
                          </p>
                          <p className="text-xs text-gray-500">지각률</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600">
                            {camp.absentRate}%
                          </p>
                          <p className="text-xs text-gray-500">결석률</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 학생별 보기 */}
            {viewMode === "student" && (
              <AttendanceStudentTable
                students={attendanceData.students}
                camps={selectedCamps}
                dateRange={dateRange}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
