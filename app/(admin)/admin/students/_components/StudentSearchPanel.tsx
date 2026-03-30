"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, Users, Mail } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/atoms/Avatar";
import type {
  StudentSearchItem,
  StudentSearchFilters,
} from "@/lib/domains/student/actions/search";

type EmailFilter = "" | "connected" | "disconnected";
type SortBy = "created_at" | "name" | "grade";

type StudentSearchPanelProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  students: StudentSearchItem[];
  total: number;
  isLoading: boolean;
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  filters: StudentSearchFilters;
  onFiltersChange: (filters: StudentSearchFilters) => void;
};

function getActiveLabel(isActive: boolean): string {
  return isActive ? "활성" : "비활성";
}

function getActiveColor(isActive: boolean): string {
  return isActive
    ? "bg-green-50 text-green-700"
    : "bg-gray-100 text-gray-500";
}

const FILTER_SELECT_CLASS =
  "h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-600 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200";

export function StudentSearchPanel({
  searchQuery,
  onSearchChange,
  students,
  total,
  isLoading,
  selectedStudentId,
  onSelectStudent,
  filters,
  onFiltersChange,
}: StudentSearchPanelProps) {
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");

  // 클라이언트 사이드 이메일 필터 + 정렬
  const displayedStudents = useMemo(() => {
    let result = students;

    // 이메일 필터
    if (emailFilter === "connected") {
      result = result.filter((s) => s.has_email);
    } else if (emailFilter === "disconnected") {
      result = result.filter((s) => !s.has_email);
    }

    // 정렬
    if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "ko")
      );
    } else if (sortBy === "grade") {
      result = [...result].sort(
        (a, b) => (a.grade ?? 99) - (b.grade ?? 99)
      );
    }
    // "created_at" → 서버에서 이미 정렬된 순서 유지

    return result;
  }, [students, emailFilter, sortBy]);

  const displayedTotal =
    emailFilter ? displayedStudents.length : total;

  const updateFilter = (key: keyof StudentSearchFilters, value: string) => {
    const next = { ...filters };
    if (!value) {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = key === "isActive" ? value === "true" : value;
    }
    onFiltersChange(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름 또는 연락처 검색"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className={FILTER_SELECT_CLASS}
          value={filters.division ?? ""}
          onChange={(e) => updateFilter("division", e.target.value)}
        >
          <option value="">학부 전체</option>
          <option value="고등부">고등부</option>
          <option value="중등부">중등부</option>
          <option value="졸업">졸업</option>
        </select>

        <select
          className={FILTER_SELECT_CLASS}
          value={filters.grade ?? ""}
          onChange={(e) => updateFilter("grade", e.target.value)}
        >
          <option value="">학년</option>
          <option value="1">1학년</option>
          <option value="2">2학년</option>
          <option value="3">3학년</option>
        </select>

        <select
          className={FILTER_SELECT_CLASS}
          value={filters.isActive === undefined ? "" : String(filters.isActive)}
          onChange={(e) => updateFilter("isActive", e.target.value)}
        >
          <option value="">상태</option>
          <option value="true">활성</option>
          <option value="false">비활성</option>
        </select>

        <select
          className={FILTER_SELECT_CLASS}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value as EmailFilter)}
        >
          <option value="">이메일</option>
          <option value="connected">연결됨</option>
          <option value="disconnected">미연결</option>
        </select>
      </div>

      {/* 검색결과 카운트 + 정렬 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Users className="h-3.5 w-3.5" />
        <span>검색결과 {displayedTotal}명</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}

        <select
          className={cn(FILTER_SELECT_CLASS, "ml-auto")}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="created_at">최근 등록순</option>
          <option value="name">이름순</option>
          <option value="grade">학년순</option>
        </select>
      </div>

      {/* 학생 리스트 */}
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100dvh-340px)]">
        {displayedStudents.length === 0 && !isLoading && (
          <div className="py-8 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다" : "등록된 학생이 없습니다"}
          </div>
        )}
        {displayedStudents.map((student) => (
          <button
            key={student.id}
            type="button"
            onClick={() => onSelectStudent(student.id)}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
              selectedStudentId === student.id
                ? "bg-indigo-50 ring-1 ring-indigo-200"
                : "hover:bg-gray-50"
            )}
          >
            {/* 아바타 */}
            <Avatar
              src={student.profile_image_url}
              name={student.name ?? undefined}
              size="sm"
              className="mt-0.5 shrink-0"
            />

            {/* 정보 영역 */}
            <div className="flex-1 min-w-0">
              {/* Row 1: 이름 성별 학부 학년 */}
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-sm font-medium truncate",
                    selectedStudentId === student.id
                      ? "text-indigo-700"
                      : "text-gray-900"
                  )}
                >
                  {student.name ?? "이름 없음"}
                </span>
                {student.gender && (
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {student.gender}
                  </span>
                )}
                {student.division && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 shrink-0">
                    {student.division}
                  </span>
                )}
                {student.grade != null && (
                  <span className="text-[11px] text-gray-500 shrink-0">
                    {student.grade}학년
                  </span>
                )}
              </div>

              {/* Row 2: 연락처 */}
              {student.phone && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {student.phone}
                </div>
              )}

              {/* Row 3: 학교 */}
              {student.school_name && (
                <div
                  className="text-xs text-gray-500 mt-0.5 truncate"
                  title={student.school_name}
                >
                  {student.school_name}
                </div>
              )}

              {/* Row 4: 이메일 상태 · 활성 상태 */}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    student.has_email
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-50 text-gray-400"
                  )}
                >
                  <Mail className="h-2.5 w-2.5" />
                  {student.has_email ? "연결됨" : "미연결"}
                </span>

                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    getActiveColor(student.is_active)
                  )}
                >
                  {getActiveLabel(student.is_active)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
