"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Search, ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  ADMISSION_REGIONS,
  ADMISSION_DEPARTMENT_TYPES,
  ADMISSION_TYPES,
} from "@/lib/domains/admission/search/constants";
import type {
  AdmissionSearchFilter,
  AdmissionSearchRow,
  AdmissionSearchResult,
  PaginationParams,
  CompetitionRates,
  AdmissionResults,
  Replacements,
  UniversityInfo,
} from "@/lib/domains/admission/types";
import {
  admissionSearchKeys,
  admissionSearchQueryOptions,
} from "@/lib/query-options/admissionSearch";

const PAGE_SIZE = 20;

// ─── 메인 컴포넌트 ─────────────────────────────────

export function AlumniSearch() {
  const [filter, setFilter] = useState<AdmissionSearchFilter>({});
  const [pagination, setPagination] = useState<PaginationParams>({ page: 1, pageSize: PAGE_SIZE });
  const [hasSearched, setHasSearched] = useState(false);
  const queryClient = useQueryClient();

  const { data, isFetching, error, refetch } = useQuery(
    admissionSearchQueryOptions(filter, pagination),
  );

  const handleSearch = useCallback(() => {
    const hasUniv = filter.universityName && filter.universityName.trim().length > 0;
    const hasDept = filter.departmentName && filter.departmentName.trim().length > 0;
    if (!hasUniv && !hasDept) return;

    setPagination((p) => ({ ...p, page: 1 }));
    setHasSearched(true);
    // 기존 쿼리 무효화 후 refetch
    queryClient.removeQueries({ queryKey: admissionSearchKeys.all });
    setTimeout(() => refetch(), 0);
  }, [filter, refetch, queryClient]);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((p) => ({ ...p, page: newPage }));
    // 페이지 변경 시 새 쿼리가 자동으로 실행되지 않으므로 refetch
    queryClient.removeQueries({ queryKey: admissionSearchKeys.all });
    setTimeout(() => refetch(), 0);
  }, [refetch, queryClient]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  return (
    <div className="flex flex-col gap-6">
      {/* 검색 폼 */}
      <SearchForm
        filter={filter}
        onChange={setFilter}
        onSearch={handleSearch}
        onKeyDown={handleKeyDown}
        isFetching={isFetching}
      />

      {/* 결과 */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
      )}

      {hasSearched && data && (
        <SearchResults
          result={data}
          onPageChange={handlePageChange}
          isFetching={isFetching}
        />
      )}

      {hasSearched && !isFetching && data && data.total === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}

// ─── 검색 폼 ─────────────────────────────────────

function SearchForm({
  filter,
  onChange,
  onSearch,
  onKeyDown,
  isFetching,
}: {
  filter: AdmissionSearchFilter;
  onChange: (f: AdmissionSearchFilter) => void;
  onSearch: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isFetching: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] p-4">
      {/* 텍스트 입력 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--text-secondary)]">대학명</span>
          <input
            type="text"
            placeholder="예: 서울대"
            value={filter.universityName ?? ""}
            onChange={(e) => onChange({ ...filter, universityName: e.target.value })}
            onKeyDown={onKeyDown}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--text-secondary)]">학과명</span>
          <input
            type="text"
            placeholder="예: 컴퓨터"
            value={filter.departmentName ?? ""}
            onChange={(e) => onChange({ ...filter, departmentName: e.target.value })}
            onKeyDown={onKeyDown}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      {/* 드롭다운 필터 */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FilterSelect
          label="지역"
          value={filter.region ?? ""}
          options={ADMISSION_REGIONS as unknown as string[]}
          onChange={(v) => onChange({ ...filter, region: v || undefined })}
        />
        <FilterSelect
          label="계열"
          value={filter.departmentType ?? ""}
          options={ADMISSION_DEPARTMENT_TYPES as unknown as string[]}
          onChange={(v) => onChange({ ...filter, departmentType: v || undefined })}
        />
        <FilterSelect
          label="전형"
          value={filter.admissionType ?? ""}
          options={ADMISSION_TYPES as unknown as string[]}
          onChange={(v) => onChange({ ...filter, admissionType: v || undefined })}
        />
      </div>

      {/* 검색 버튼 */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSearch}
          disabled={isFetching || (!filter.universityName?.trim() && !filter.departmentName?.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {isFetching ? "검색 중..." : "검색"}
        </button>
      </div>
    </div>
  );
}

// ─── 필터 셀렉트 ─────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">전체</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

// ─── 검색 결과 ─────────────────────────────────────

function SearchResults({
  result,
  onPageChange,
  isFetching,
}: {
  result: AdmissionSearchResult;
  onPageChange: (page: number) => void;
  isFetching: boolean;
}) {
  if (result.total === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4", isFetching && "pointer-events-none opacity-50")}>
      <p className="text-sm text-[var(--text-secondary)]">
        총 <span className="font-semibold text-[var(--text-primary)]">{result.total.toLocaleString()}</span>건
      </p>

      <div className="flex flex-col gap-3">
        {result.rows.map((row) => (
          <AdmissionCard
            key={row.id}
            row={row}
            universityInfo={result.universityInfoMap?.[row.universityName]}
          />
        ))}
      </div>

      {result.totalPages > 1 && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

// ─── 입시 카드 (펼침식) ────────────────────────────

const TYPE_BADGE_COLORS: Record<string, string> = {
  "학생부종합": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "학생부교과": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "논술": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "실기/실적": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "특기자": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function AdmissionCard({
  row,
  universityInfo,
}: {
  row: AdmissionSearchRow;
  universityInfo?: UniversityInfo | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const badgeColor = row.admissionType
    ? TYPE_BADGE_COLORS[row.admissionType] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  // 공식 이름이 다르면 표시 (별칭 해석 결과)
  const hasAlias = universityInfo && universityInfo.nameKor !== row.universityName;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] transition-shadow hover:shadow-sm">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {row.universityName}
            </span>
            {hasAlias && (
              <span className="text-xs text-[var(--text-tertiary)]">
                ({universityInfo.nameKor})
              </span>
            )}
            {row.admissionType && (
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", badgeColor)}>
                {row.admissionType}
              </span>
            )}
            {universityInfo?.establishmentType && (
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {universityInfo.establishmentType}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{row.departmentName}</span>
            {row.admissionName && (
              <>
                <span className="text-[var(--text-tertiary)]">/</span>
                <span>{row.admissionName}</span>
              </>
            )}
            {row.recruitmentCount && (
              <>
                <span className="text-[var(--text-tertiary)]">|</span>
                <span>모집 {row.recruitmentCount}명</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {universityInfo?.homepageUrl && (
            <a
              href={universityInfo.homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-indigo-600"
              title="홈페이지"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--text-tertiary)] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* 상세 */}
      {expanded && (
        <div className="border-t border-[var(--border-secondary)] px-4 py-3">
          <div className="flex flex-col gap-4">
            {/* 메타 정보 */}
            <MetaGrid row={row} />

            {/* 경쟁률 테이블 */}
            <JsonTable title="경쟁률" data={row.competitionRates} />

            {/* 입결 테이블 */}
            <AdmissionResultsTable data={row.admissionResults} />

            {/* 충원 테이블 */}
            <JsonTable title="충원" data={row.replacements} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 메타 그리드 ─────────────────────────────────

function MetaGrid({ row }: { row: AdmissionSearchRow }) {
  const items: { label: string; value: string | null }[] = [
    { label: "지역", value: row.region },
    { label: "계열", value: row.departmentType },
    { label: "지원자격", value: row.eligibility },
    { label: "선발방법", value: row.selectionMethod },
    { label: "최저등급", value: row.minScoreCriteria },
    { label: "학생부 반영", value: row.gradeWeight },
    { label: "반영과목", value: row.subjectsReflected },
    { label: "진로선택", value: row.careerSubjects },
    { label: "복수지원", value: row.dualApplication },
    { label: "제출서류", value: row.requiredDocs },
    { label: "고사일", value: row.examDate },
    { label: "전년증감", value: row.yearChange },
    { label: "변경내역", value: row.changeDetails },
    { label: "비고", value: row.notes },
  ];

  const filtered = items.filter((i) => i.value);
  if (filtered.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
      {filtered.map((item) => (
        <div key={item.label} className="flex gap-2 text-xs">
          <span className="shrink-0 font-medium text-[var(--text-secondary)]">{item.label}</span>
          <span className="text-[var(--text-primary)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── JSONB 단순 테이블 (경쟁률/충원) ──────────────

function JsonTable({ title, data }: { title: string; data: CompetitionRates | Replacements }) {
  const entries = Object.entries(data).sort(([a], [b]) => b.localeCompare(a));
  if (entries.length === 0) return null;

  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{title}</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-secondary)]">
              {entries.map(([year]) => (
                <th key={year} className="px-3 py-1.5 text-center font-medium text-[var(--text-secondary)]">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map(([year, value]) => (
                <td key={year} className="px-3 py-1.5 text-center text-[var(--text-primary)]">
                  {value || "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 입결 테이블 ─────────────────────────────────

function AdmissionResultsTable({ data }: { data: AdmissionResults }) {
  const years = Object.keys(data).sort((a, b) => b.localeCompare(a));
  if (years.length === 0) return null;

  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">입결</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-secondary)]">
              <th className="px-3 py-1.5 text-left font-medium text-[var(--text-secondary)]">항목</th>
              {years.map((year) => (
                <th key={year} className="px-3 py-1.5 text-center font-medium text-[var(--text-secondary)]">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["basis", "grade", "score"] as const).map((field) => {
              const label = field === "basis" ? "기준" : field === "grade" ? "등급" : "점수";
              const hasAny = years.some((y) => data[y]?.[field]);
              if (!hasAny) return null;
              return (
                <tr key={field} className="border-b border-[var(--border-secondary)] last:border-0">
                  <td className="px-3 py-1.5 font-medium text-[var(--text-secondary)]">{label}</td>
                  {years.map((year) => (
                    <td key={year} className="px-3 py-1.5 text-center text-[var(--text-primary)]">
                      {data[year]?.[field] || "-"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 페이지네이션 ─────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // 최대 5개 페이지 번호 표시
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={cn(
            "min-w-[32px] rounded-md px-2 py-1 text-sm transition-colors",
            p === page
              ? "bg-indigo-600 font-medium text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]",
          )}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-secondary)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
