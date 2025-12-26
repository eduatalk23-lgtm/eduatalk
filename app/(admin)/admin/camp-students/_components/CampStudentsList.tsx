"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { campStudentsListQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampTemplate } from "@/lib/domains/camp/types";
import type { CampStudentSummary, CampStudentsListResponse } from "@/app/api/admin/camps/students/route";
import { CampSelector } from "../../camp-attendance/_components/CampSelector";

type CampStudentsListProps = {
  initialCamps: CampTemplate[];
};

type SortField = "name" | "attendance" | "completion" | "alerts" | "camps";
type SortOrder = "asc" | "desc";

export function CampStudentsList({ initialCamps }: CampStudentsListProps) {
  // 선택된 캠프 ID들
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>(() =>
    initialCamps.slice(0, 5).map((c) => c.id)
  );

  // 검색어
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 정렬
  const [sortBy, setSortBy] = useState<SortField>("alerts");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 검색어 디바운스
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 데이터 조회
  const {
    data: studentsData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery(
    campStudentsListQueryOptions(selectedCampIds, {
      search: debouncedSearch,
      sortBy,
      sortOrder,
    })
  ) as {
    data: CampStudentsListResponse | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
    isFetching: boolean;
  };

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

  // 정렬 변경
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">학생 관리</h1>
            <p className="text-sm text-gray-500">
              캠프에 참여 중인 학생들의 현황을 통합 조회합니다.
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
              href="/admin/camp-alerts"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              이상 징후
            </Link>
          </div>
        </div>

        {/* 캠프 선택 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <CampSelector
            camps={initialCamps}
            selectedCampIds={selectedCampIds}
            onSelectionChange={handleCampSelectionChange}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-sm text-gray-500">학생 정보를 불러오는 중...</p>
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-800">{error.message}</p>
          </div>
        )}

        {/* 데이터 표시 */}
        {!isLoading && studentsData && (
          <>
            {/* 요약 통계 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">전체 학생</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {studentsData.summary.totalStudents}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-red-600">심각 주의</p>
                    <p className="text-2xl font-bold text-red-700">
                      {studentsData.summary.studentsWithCriticalAlerts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-100 p-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-yellow-600">주의 필요</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {studentsData.summary.studentsWithAlerts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-green-600">평균 출석률</p>
                    <p className="text-2xl font-bold text-green-700">
                      {studentsData.summary.avgAttendanceRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-indigo-600">평균 완료율</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      {studentsData.summary.avgCompletionRate}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 검색 및 정렬 */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="학생 이름 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>정렬:</span>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(
                    [
                      { key: "name", label: "이름" },
                      { key: "attendance", label: "출석률" },
                      { key: "completion", label: "완료율" },
                      { key: "alerts", label: "알림" },
                      { key: "camps", label: "캠프수" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleSort(key)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
                        sortBy === key
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {label}
                      {sortBy === key && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 학생 목록 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  학생 목록 ({studentsData.students.length})
                </h2>
              </div>

              {studentsData.students.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">
                    {selectedCampIds.length === 0
                      ? "캠프를 선택해주세요."
                      : debouncedSearch
                        ? "검색 결과가 없습니다."
                        : "참여 중인 학생이 없습니다."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {studentsData.students.map((student) => (
                    <StudentRow key={student.studentId} student={student} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function StudentRow({ student }: { student: CampStudentSummary }) {
  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition">
      <div className="flex items-center gap-4">
        {/* 학생 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/admin/camp-students/${student.studentId}`}
              className="text-base font-semibold text-gray-900 hover:text-indigo-600 hover:underline"
            >
              {student.studentName}
            </Link>

            {student.criticalAlertCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                심각 {student.criticalAlertCount}
              </span>
            )}

            {student.alertCount > 0 && student.criticalAlertCount === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                <AlertTriangle className="h-3 w-3" />
                주의 {student.alertCount}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              캠프 {student.campCount}개 (진행 중 {student.activeCampCount}개)
            </span>
          </div>

          {/* 캠프 태그 */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {student.camps.slice(0, 3).map((camp) => (
              <span
                key={camp.campId}
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-xs",
                  camp.campStatus === "active"
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-50 text-gray-600"
                )}
              >
                {camp.campName}
              </span>
            ))}
            {student.camps.length > 3 && (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                +{student.camps.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* 통계 */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p
              className={cn(
                "text-2xl font-bold",
                student.overallAttendanceRate >= 80
                  ? "text-green-600"
                  : student.overallAttendanceRate >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              )}
            >
              {student.overallAttendanceRate}%
            </p>
            <p className="text-xs text-gray-500">출석률</p>
          </div>
          <div className="text-center">
            <p
              className={cn(
                "text-2xl font-bold",
                student.overallCompletionRate >= 80
                  ? "text-indigo-600"
                  : student.overallCompletionRate >= 50
                    ? "text-gray-700"
                    : "text-orange-600"
              )}
            >
              {student.overallCompletionRate}%
            </p>
            <p className="text-xs text-gray-500">완료율</p>
          </div>
        </div>

        {/* 상세 보기 */}
        <Link
          href={`/admin/camp-students/${student.studentId}`}
          className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition"
        >
          상세보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
