"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import CurriculumCascadeSelect from "@/components/filters/CurriculumCascadeSelect";
import {
  cmsGuideListQueryOptions,
  groupedSubjectsQueryOptions,
  guideCareerFieldsQueryOptions,
  curriculumUnitsQueryOptions,
} from "@/lib/query-options/explorationGuide";
import type {
  GuideListFilter,
  GuideType,
  GuideStatus,
  GuideSourceType,
  QualityTier,
  DifficultyLevel,
} from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
  GUIDE_SOURCE_TYPE_LABELS,
  QUALITY_TIER_LABELS,
  GUIDE_TYPES,
  GUIDE_STATUSES,
  GUIDE_SOURCE_TYPES,
  QUALITY_TIERS,
  CURRICULUM_REVISION_IDS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
} from "@/lib/domains/guide/types";
import { GuideListTable } from "./GuideListTable";

const PAGE_SIZE = 20;

const selectClass = cn(
  "px-3 py-2 rounded-lg border text-sm",
  "border-secondary-200 dark:border-secondary-700",
  "bg-white dark:bg-secondary-900 text-[var(--text-primary)]",
);

export function GuideListClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<GuideListFilter>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");
  const [showCurriculumFilters, setShowCurriculumFilters] = useState(false);
  // 교과는 UI 전용 상태 (과목 드롭다운 좁히기용, 직접 필터 아님)
  const [selectedSubjectArea, setSelectedSubjectArea] = useState("");

  // ── 데이터 로딩 ──
  const { data, isLoading } = useQuery(cmsGuideListQueryOptions(filters));
  const guides = data?.success ? data.data?.data ?? [] : [];
  const totalCount = data?.success ? data.data?.count ?? 0 : 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 계열 목록 (참조 데이터)
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];

  // 교육과정별 과목 그룹
  const curriculumRevisionId = filters.curriculumYear
    ? CURRICULUM_REVISION_IDS[filters.curriculumYear]
    : undefined;
  const { data: groupedSubjectsRes } = useQuery(
    groupedSubjectsQueryOptions(curriculumRevisionId ?? ""),
  );
  const groupedSubjects = groupedSubjectsRes?.success
    ? groupedSubjectsRes.data ?? []
    : [];

  // 캐스캐이딩: 교과 → 과목 목록 (UI 전용 상태 기반)
  const selectedGroup = selectedSubjectArea
    ? groupedSubjects.find((g) => g.groupName === selectedSubjectArea)
    : undefined;
  const filteredSubjects = selectedGroup?.subjects ?? [];

  // 캐스캐이딩: 과목 → 대/소단원
  const { data: curriculumRes } = useQuery(
    curriculumUnitsQueryOptions(filters.subjectSelect ?? ""),
  );
  const curriculumUnits = curriculumRes?.success ? curriculumRes.data ?? [] : [];
  const majorUnits = curriculumUnits.filter((u) => u.unit_type === "major");
  const selectedMajor = majorUnits.find((u) => u.unit_name === filters.unitMajor);
  const minorUnits = selectedMajor
    ? curriculumUnits.filter(
        (u) => u.unit_type === "minor" && u.parent_unit_id === selectedMajor.id,
      )
    : [];

  // ── 활성 필터 카운트 ──
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.guideType) count++;
    if (filters.status) count++;
    if (filters.careerFieldId) count++;
    if (filters.sourceType) count++;
    if (filters.qualityTier) count++;
    if (filters.curriculumYear) count++;
    if (filters.subjectSelectIn?.length) count++;
    if (filters.subjectSelect) count++;
    if (filters.unitMajor) count++;
    if (filters.unitMinor) count++;
    if (filters.searchQuery) count++;
    return count;
  }, [filters]);

  // ── 핸들러 ──
  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: searchInput || undefined,
      page: 1,
    }));
  }, [searchInput]);

  const handleFilterChange = useCallback(
    (key: keyof GuideListFilter, value: string | number | undefined) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value || undefined, page: 1 };

        // 캐스캐이딩 초기화
        if (key === "curriculumYear") {
          next.subjectSelectIn = undefined;
          next.subjectSelect = undefined;
          next.unitMajor = undefined;
          next.unitMinor = undefined;
        } else if (key === "subjectSelect") {
          next.unitMajor = undefined;
          next.unitMinor = undefined;
        } else if (key === "unitMajor") {
          next.unitMinor = undefined;
        }

        return next;
      });
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ page: 1, pageSize: PAGE_SIZE });
    setSearchInput("");
    setSelectedSubjectArea("");
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return (
    <div className="space-y-4">
      {/* 검색 + 액션 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="제목 또는 도서명 검색..."
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

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/admin/guides/topics"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-secondary-300 text-[var(--text-secondary)] text-sm font-medium hover:bg-secondary-50 dark:border-secondary-600 dark:hover:bg-secondary-800 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            주제 관리
          </Link>
          <Link
            href="/admin/guides/generate"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-300 text-primary-600 text-sm font-medium hover:bg-primary-50 dark:border-primary-600 dark:text-primary-400 dark:hover:bg-primary-900/20 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI 생성
          </Link>
          <Link
            href="/admin/guides/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 가이드
          </Link>
        </div>
      </div>

      {/* 기본 필터 행 — 그리드 반응형 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2">
        <select
          value={filters.guideType ?? ""}
          onChange={(e) => handleFilterChange("guideType", e.target.value as GuideType)}
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
          value={filters.status ?? ""}
          onChange={(e) => handleFilterChange("status", e.target.value as GuideStatus)}
          className={selectClass}
        >
          <option value="">전체 상태</option>
          {GUIDE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GUIDE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={filters.careerFieldId ?? ""}
          onChange={(e) =>
            handleFilterChange("careerFieldId", e.target.value ? Number(e.target.value) : undefined)
          }
          className={selectClass}
        >
          <option value="">전체 계열</option>
          {careerFields.map((cf) => (
            <option key={cf.id} value={cf.id}>
              {cf.name_kor}
            </option>
          ))}
        </select>

        <select
          value={filters.sourceType ?? ""}
          onChange={(e) => handleFilterChange("sourceType", e.target.value as GuideSourceType)}
          className={selectClass}
        >
          <option value="">전체 소스</option>
          {GUIDE_SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {GUIDE_SOURCE_TYPE_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={filters.qualityTier ?? ""}
          onChange={(e) => handleFilterChange("qualityTier", e.target.value as QualityTier)}
          className={selectClass}
        >
          <option value="">전체 품질</option>
          {QUALITY_TIERS.map((q) => (
            <option key={q} value={q}>
              {QUALITY_TIER_LABELS[q]}
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

        {/* 교육과정 필터 토글 */}
        <button
          onClick={() => setShowCurriculumFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1 px-3 py-2 rounded-lg border text-sm transition-colors",
            showCurriculumFilters || filters.curriculumYear
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

        {/* 모든 버전 표시 토글 */}
        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors select-none">
          <input
            type="checkbox"
            checked={filters.latestOnly === false}
            onChange={(e) => {
              setFilters((prev) => ({
                ...prev,
                latestOnly: e.target.checked ? false : undefined,
                page: 1,
              }));
            }}
            className="rounded border-secondary-300 text-primary-500 focus:ring-primary-500/30"
          />
          모든 버전
        </label>
      </div>

      {/* 교육과정 캐스캐이딩 필터 (토글) */}
      {showCurriculumFilters && (
        <CurriculumCascadeSelect
          placeholderStyle="filter"
          className="pl-1 border-l-2 border-primary-300 dark:border-primary-700"
          yearOptions={["2022", "2015"]}
          groupedSubjects={groupedSubjects}
          majorUnits={majorUnits}
          minorUnits={minorUnits}
          curriculumYear={filters.curriculumYear ?? ""}
          onCurriculumYearChange={(v) => {
            setSelectedSubjectArea("");
            handleFilterChange("curriculumYear", v);
          }}
          subjectArea={selectedSubjectArea}
          onSubjectAreaChange={(v) => {
            setSelectedSubjectArea(v);
            const group = groupedSubjects.find((g) => g.groupName === v);
            const subjectNames = group?.subjects.map((s) => s.name) ?? [];
            setFilters((prev) => ({
              ...prev,
              subjectSelectIn: subjectNames.length > 0 ? subjectNames : undefined,
              subjectSelect: undefined,
              unitMajor: undefined,
              unitMinor: undefined,
              page: 1,
            }));
          }}
          subjectSelect={filters.subjectSelect ?? ""}
          onSubjectSelectChange={(v) => {
            setFilters((prev) => ({
              ...prev,
              subjectSelect: v || undefined,
              subjectSelectIn: v ? undefined : prev.subjectSelectIn,
              unitMajor: undefined,
              unitMinor: undefined,
              page: 1,
            }));
          }}
          unitMajor={filters.unitMajor ?? ""}
          onUnitMajorChange={(v) => handleFilterChange("unitMajor", v)}
          unitMinor={filters.unitMinor ?? ""}
          onUnitMinorChange={(v) => handleFilterChange("unitMinor", v)}
        />
      )}

      {/* 결과 수 + 필터 초기화 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          총{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            {totalCount.toLocaleString()}
          </span>
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
      <GuideListTable
        guides={guides}
        isLoading={isLoading}
        onRowClick={(id) => router.push(`/admin/guides/${id}`)}
        showAllVersions={filters.latestOnly === false}
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
