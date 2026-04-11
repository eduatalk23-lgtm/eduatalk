"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  topicListQueryOptions,
  guideCareerFieldsQueryOptions,
  groupedSubjectsQueryOptions,
  curriculumUnitsQueryOptions,
} from "@/lib/query-options/explorationGuide";
import type { TopicListFilter, SuggestedTopic, DifficultyLevel } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_TYPES,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
} from "@/lib/domains/guide/types";
import { deleteTopicAction } from "@/lib/domains/guide/actions/crud";
import { TopicListTable } from "./TopicListTable";
import { useToast } from "@/components/ui/ToastProvider";
import CurriculumCascadeSelect from "@/components/filters/CurriculumCascadeSelect";

const PAGE_SIZE = 20;

const selectClass = cn(
  "px-3 py-2 rounded-lg border text-sm",
  "border-secondary-200 dark:border-secondary-700",
  "bg-white dark:bg-secondary-900 text-[var(--text-primary)]",
);

interface TopicListClientProps {
  curriculumRevisions: Array<{ id: string; year: number | null }>;
}

export function TopicListClient({ curriculumRevisions }: TopicListClientProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();

  // ── 필터 상태 ──
  const [filters, setFilters] = useState<TopicListFilter>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");
  const [showCurriculumFilters, setShowCurriculumFilters] = useState(false);
  const [selectedCurriculumYear, setSelectedCurriculumYear] = useState("");
  const [selectedSubjectArea, setSelectedSubjectArea] = useState("");

  // ── 데이터 조회 ──
  const { data, isLoading } = useQuery(topicListQueryOptions(filters));
  const topics = data?.success ? data.data?.data ?? [] : [];
  const totalCount = data?.success ? data.data?.count ?? 0 : 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── 참조 데이터 ──
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];

  const yearOptions = useMemo(
    () => curriculumRevisions.map((r) => String(r.year)),
    [curriculumRevisions],
  );
  const curriculumRevisionId = selectedCurriculumYear
    ? curriculumRevisions.find((r) => String(r.year) === selectedCurriculumYear)?.id
    : undefined;
  const { data: groupedSubjectsRes } = useQuery(
    groupedSubjectsQueryOptions(curriculumRevisionId ?? ""),
  );
  const groupedSubjects = groupedSubjectsRes?.success
    ? groupedSubjectsRes.data ?? []
    : [];

  const filteredSubjects = selectedSubjectArea
    ? groupedSubjects.find((g) => g.groupName === selectedSubjectArea)?.subjects ?? []
    : [];

  const { data: unitsRes } = useQuery(
    curriculumUnitsQueryOptions(filters.subjectName ?? ""),
  );
  const curriculumUnits = unitsRes?.success ? unitsRes.data ?? [] : [];
  const majorUnits = curriculumUnits.filter((u) => u.unit_type === "major");
  const selectedMajor = majorUnits.find(
    (u) => u.unit_name === filters.majorUnit,
  );
  const minorUnits = selectedMajor
    ? curriculumUnits.filter(
        (u) => u.unit_type === "minor" && u.parent_unit_id === selectedMajor.id,
      )
    : [];

  // ── 필터 핸들러 ──
  const handleFilterChange = useCallback(
    (key: keyof TopicListFilter, value: string | undefined) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value || undefined, page: 1 };
        if (key === "subjectName") {
          next.majorUnit = undefined;
          next.minorUnit = undefined;
        } else if (key === "majorUnit") {
          next.minorUnit = undefined;
        }
        return next;
      });
    },
    [],
  );

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: searchInput || undefined,
      page: 1,
    }));
  }, [searchInput]);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ page: 1, pageSize: PAGE_SIZE });
    setSearchInput("");
    setSelectedCurriculumYear("");
    setSelectedSubjectArea("");
  }, []);

  const handleDelete = useCallback(
    async (topicId: string) => {
      const result = await deleteTopicAction(topicId);
      if (result.success) {
        toast.showSuccess("주제가 삭제되었습니다.");
        queryClient.invalidateQueries({
          queryKey: ["explorationGuide", "topicList"],
        });
      } else {
        toast.showError(result.error ?? "삭제 실패");
      }
    },
    [queryClient, toast],
  );

  // ── 가이드 생성 (주제 → 생성 페이지 이동) ──
  const handleGenerateGuide = useCallback(
    (topic: SuggestedTopic) => {
      // used_count는 generateGuideAction 서버에서 일괄 증가 (중복 방지)

      // 쿼리 파라미터로 메타데이터 전달
      const params = new URLSearchParams();
      params.set("keyword", topic.title);
      params.set("guideType", topic.guide_type);
      if (topic.subject_name) params.set("subject", topic.subject_name);
      if (topic.career_field) params.set("careerField", topic.career_field);
      if (topic.curriculum_year) params.set("curriculumYear", String(topic.curriculum_year));
      if (topic.subject_group) params.set("subjectGroup", topic.subject_group);
      if (topic.major_unit) params.set("majorUnit", topic.major_unit);
      if (topic.minor_unit) params.set("minorUnit", topic.minor_unit);
      params.set("topicId", topic.id);

      router.push(`/admin/guides/generate?${params.toString()}`);
    },
    [router],
  );

  // ── 활성 필터 카운트 ──
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.guideType) count++;
    if (filters.careerField) count++;
    if (filters.subjectName) count++;
    if (filters.subjectGroup) count++;
    if (filters.majorUnit) count++;
    if (filters.minorUnit) count++;
    if (filters.searchQuery) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* 상단 네비 + 검색 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/guides"
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          가이드 목록
        </Link>
        <div className="flex gap-2 flex-1 max-w-md ml-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="제목 또는 추천 이유 검색..."
              className={cn(
                "w-full pl-9 pr-3 py-2 rounded-lg border text-sm",
                "border-secondary-200 dark:border-secondary-700",
                "bg-white dark:bg-secondary-900",
                "text-[var(--text-primary)] placeholder:text-secondary-400",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
              )}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            검색
          </button>
        </div>
      </div>

      {/* 기본 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.guideType ?? ""}
          onChange={(e) => handleFilterChange("guideType", e.target.value)}
          className={selectClass}
        >
          <option value="">전체 유형</option>
          {GUIDE_TYPES.map((t) => (
            <option key={t} value={t}>
              {GUIDE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={filters.careerField ?? ""}
          onChange={(e) => handleFilterChange("careerField", e.target.value)}
          className={selectClass}
        >
          <option value="">전체 계열</option>
          {careerFields.map((cf) => (
            <option key={cf.id} value={cf.name_kor}>
              {cf.name_kor}
            </option>
          ))}
        </select>

        <select
          value={filters.difficultyLevel ?? ""}
          onChange={(e) => handleFilterChange("difficultyLevel", e.target.value as DifficultyLevel)}
          className={selectClass}
        >
          <option value="">전체 난이도</option>
          {DIFFICULTY_LEVELS.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>

        {/* 교육과정 토글 */}
        <button
          onClick={() => setShowCurriculumFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1 px-3 py-2 rounded-lg border text-sm transition-colors",
            showCurriculumFilters || selectedCurriculumYear
              ? "border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/20 dark:text-primary-300"
              : "border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
          )}
        >
          교육과정
          {showCurriculumFilters ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 교육과정 고급 필터 */}
      {showCurriculumFilters && (
        <CurriculumCascadeSelect
          placeholderStyle="filter"
          className="pl-1 border-l-2 border-primary-300 dark:border-primary-700"
          yearOptions={yearOptions}
          groupedSubjects={groupedSubjects}
          majorUnits={majorUnits}
          minorUnits={minorUnits}
          curriculumYear={selectedCurriculumYear}
          onCurriculumYearChange={(v) => {
            setSelectedCurriculumYear(v);
            setSelectedSubjectArea("");
            handleFilterChange("subjectName", undefined);
            handleFilterChange("subjectGroup", undefined);
            handleFilterChange("majorUnit", undefined);
            handleFilterChange("minorUnit", undefined);
          }}
          subjectArea={selectedSubjectArea}
          onSubjectAreaChange={(v) => {
            setSelectedSubjectArea(v);
            setFilters((prev) => ({
              ...prev,
              subjectGroup: v || undefined,
              subjectName: undefined,
              majorUnit: undefined,
              minorUnit: undefined,
              page: 1,
            }));
          }}
          subjectSelect={filters.subjectName ?? ""}
          onSubjectSelectChange={(v) => handleFilterChange("subjectName", v)}
          unitMajor={filters.majorUnit ?? ""}
          onUnitMajorChange={(v) => handleFilterChange("majorUnit", v)}
          unitMinor={filters.minorUnit ?? ""}
          onUnitMinorChange={(v) => handleFilterChange("minorUnit", v)}
        />
      )}

      {/* 결과 수 + 필터 초기화 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          총{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            {totalCount.toLocaleString()}
          </span>{" "}
          건
          {filters.searchQuery && (
            <span className="ml-1">
              · &quot;{filters.searchQuery}&quot; 검색 결과
            </span>
          )}
          {activeFilterCount > 0 && (
            <span className="ml-1">· 필터 {activeFilterCount}개 적용 중</span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            필터 초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <TopicListTable
        topics={topics}
        isLoading={isLoading}
        onDelete={handleDelete}
        onGenerateGuide={handleGenerateGuide}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange((filters.page ?? 1) - 1)}
            disabled={(filters.page ?? 1) <= 1}
            className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {filters.page ?? 1} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange((filters.page ?? 1) + 1)}
            disabled={(filters.page ?? 1) >= totalPages}
            className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
