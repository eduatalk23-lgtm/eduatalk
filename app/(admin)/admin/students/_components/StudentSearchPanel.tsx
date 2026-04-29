"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Loader2, Users, Mail, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/atoms/Avatar";
import { WITHDRAWN_REASONS } from "@/lib/constants/students";
import type {
  StudentSearchItem,
  StudentSearchFilters,
} from "@/lib/domains/student/actions/search";

/** 화면 어디서나 / 또는 Cmd/Ctrl+K 누르면 검색창 포커스 */
function useSearchShortcut(inputRef: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      // Cmd/Ctrl+K — 입력 중에도 동작
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      // / — 다른 입력에 포커스 중이면 무시
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}

/** 적용된 필터를 chip 으로 시각화 */
type FilterChip = { key: string; label: string; onRemove: () => void };

type EmailFilter = "" | "connected" | "disconnected";
type SortBy = "created_at" | "name" | "grade";
type StatusTab = "enrolled" | "not_enrolled" | "all";

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

const FILTER_SELECT_CLASS =
  "h-7 rounded-md border border-border bg-white px-1.5 text-xs text-text-secondary focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200";

const TAB_BASE =
  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors";
const TAB_ACTIVE =
  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
const TAB_INACTIVE =
  "text-text-tertiary hover:bg-bg-secondary hover:text-text-primary";

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchInputRef);

  // 현재 탭 상태 (filters.status에서 파생)
  const currentTab: StatusTab = filters.status ?? "enrolled";

  const handleTabChange = (tab: StatusTab) => {
    const next = { ...filters };
    if (tab === "all") {
      delete next.status;
    } else {
      next.status = tab;
    }
    // 탭 전환 시 사유 필터 초기화
    delete next.withdrawnReason;
    onFiltersChange(next);
  };

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

    return result;
  }, [students, emailFilter, sortBy]);

  const displayedTotal =
    emailFilter ? displayedStudents.length : total;

  // 활성 필터 chip — 디버깅 용이성 + 일괄 해제
  const activeChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = [];
    if (filters.division) {
      chips.push({
        key: "division",
        label: `학부: ${filters.division}`,
        onRemove: () => {
          const next = { ...filters };
          delete next.division;
          onFiltersChange(next);
        },
      });
    }
    if (filters.grade) {
      chips.push({
        key: "grade",
        label: `학년: ${filters.grade}`,
        onRemove: () => {
          const next = { ...filters };
          delete next.grade;
          onFiltersChange(next);
        },
      });
    }
    if (emailFilter) {
      chips.push({
        key: "email",
        label: `계정: ${emailFilter === "connected" ? "연결됨" : "미연결"}`,
        onRemove: () => setEmailFilter(""),
      });
    }
    if (filters.withdrawnReason) {
      const reason = WITHDRAWN_REASONS.find((r) => r.value === filters.withdrawnReason);
      chips.push({
        key: "withdrawnReason",
        label: `사유: ${reason?.label ?? filters.withdrawnReason}`,
        onRemove: () => {
          const next = { ...filters };
          delete next.withdrawnReason;
          onFiltersChange(next);
        },
      });
    }
    return chips;
  }, [filters, emailFilter, onFiltersChange]);

  const clearAllFilters = () => {
    setEmailFilter("");
    onFiltersChange({ status: filters.status });
  };

  const updateFilter = (key: keyof StudentSearchFilters, value: string) => {
    const next = { ...filters };
    if (!value) {
      delete next[key];
    } else {
      if (key === "isActive") {
        (next as Record<string, unknown>)[key] = value === "true";
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
    }
    onFiltersChange(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-sm">
      {/* 탭: 재원 / 비재원 / 전체 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleTabChange("enrolled")}
          className={cn(TAB_BASE, currentTab === "enrolled" ? TAB_ACTIVE : TAB_INACTIVE)}
        >
          재원
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("not_enrolled")}
          className={cn(TAB_BASE, currentTab === "not_enrolled" ? TAB_ACTIVE : TAB_INACTIVE)}
        >
          비재원
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={cn(TAB_BASE, currentTab === "all" ? TAB_ACTIVE : TAB_INACTIVE)}
        >
          전체
        </button>
      </div>

      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름 또는 연락처 검색"
          aria-label="학생 검색"
          className="w-full rounded-lg border border-border py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className={FILTER_SELECT_CLASS}
          value={filters.division ?? ""}
          onChange={(e) => updateFilter("division", e.target.value)}
          aria-label="학부 필터"
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
          aria-label="학년 필터"
        >
          <option value="">학년</option>
          <option value="1">1학년</option>
          <option value="2">2학년</option>
          <option value="3">3학년</option>
        </select>

        <select
          className={FILTER_SELECT_CLASS}
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value as EmailFilter)}
          aria-label="계정 연결 필터"
        >
          <option value="">계정</option>
          <option value="connected">연결됨</option>
          <option value="disconnected">미연결</option>
        </select>

        {/* 비재원 탭에서만 사유 필터 표시 */}
        {currentTab === "not_enrolled" && (
          <select
            className={FILTER_SELECT_CLASS}
            value={filters.withdrawnReason ?? ""}
            onChange={(e) => updateFilter("withdrawnReason", e.target.value)}
            aria-label="비재원 사유 필터"
          >
            <option value="">사유 전체</option>
            {WITHDRAWN_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* 활성 필터 chip — 적용 중인 필터 가시화 + 개별/일괄 해제 */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 text-2xs font-medium text-primary-700 dark:text-primary-300"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded-full hover:bg-primary-100 dark:hover:bg-primary-800/50 p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`${chip.label} 필터 해제`}
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-2xs text-text-tertiary hover:text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
          >
            모두 해제
          </button>
        </div>
      )}

      {/* 검색결과 카운트 + 정렬 */}
      <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Users className="h-3.5 w-3.5" />
        <span>검색결과 {displayedTotal}명</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}

        <select
          className={cn(FILTER_SELECT_CLASS, "ml-auto")}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          aria-label="정렬 기준"
        >
          <option value="created_at">최근 등록순</option>
          <option value="name">이름순</option>
          <option value="grade">학년순</option>
        </select>
      </div>

      {/* 학생 리스트 */}
      <ul
        className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100dvh-340px)]"
        role="listbox"
        aria-label="학생 목록"
      >
        {/* 첫 로딩 시 카드 모양 skeleton (P12) */}
        {isLoading && displayedStudents.length === 0 && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <li
                key={`skeleton-${i}`}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                aria-hidden="true"
              >
                <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-bg-tertiary animate-pulse" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="h-4 w-1/2 rounded bg-bg-tertiary animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-bg-tertiary animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-bg-tertiary animate-pulse" />
                </div>
              </li>
            ))}
          </>
        )}
        {displayedStudents.length === 0 && !isLoading && (
          <li className="py-8 text-center text-sm text-text-tertiary" role="status">
            {searchQuery ? "검색 결과가 없습니다" : "등록된 학생이 없습니다"}
          </li>
        )}
        {displayedStudents.map((student) => {
          const isNotEnrolled = student.status === "not_enrolled";
          const isSelected = selectedStudentId === student.id;
          return (
            <li key={student.id}>
            <button
              type="button"
              onClick={() => onSelectStudent(student.id)}
              role="option"
              aria-selected={isSelected}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isSelected
                  ? "bg-indigo-50 ring-1 ring-indigo-200"
                  : "hover:bg-bg-secondary",
                isNotEnrolled && "opacity-50"
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
                      isSelected
                        ? "text-indigo-700"
                        : "text-text-primary"
                    )}
                  >
                    {student.name ?? "이름 없음"}
                  </span>
                  {student.gender && (
                    <span className="text-2xs text-text-tertiary shrink-0">
                      {student.gender}
                    </span>
                  )}
                  {student.division && (
                    <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-2xs text-text-secondary shrink-0">
                      {student.division}
                    </span>
                  )}
                  {student.grade != null && (
                    <span className="text-2xs text-text-tertiary shrink-0">
                      {student.grade}학년
                    </span>
                  )}
                </div>

                {/* Row 2: 연락처 */}
                {student.phone && (
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {student.phone}
                  </div>
                )}

                {/* Row 3: 학교 */}
                {student.school_name && (
                  <div
                    className="text-xs text-text-tertiary mt-0.5 truncate"
                    title={student.school_name}
                  >
                    {student.school_name}
                  </div>
                )}

                {/* Row 4: 상태 배지 */}
                <div className="flex items-center gap-2 mt-1">
                  {isNotEnrolled ? (
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-3xs font-medium bg-red-50 text-red-600">
                      비재원{student.withdrawn_reason ? ` · ${student.withdrawn_reason}` : ""}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-3xs font-medium",
                        student.has_email
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-bg-secondary text-text-tertiary"
                      )}
                    >
                      <Mail className="h-2.5 w-2.5" />
                      {student.has_email ? "연결됨" : "미연결"}
                    </span>
                  )}
                </div>
              </div>
            </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
