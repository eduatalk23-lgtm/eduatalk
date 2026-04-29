"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Search } from "lucide-react";
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from "@/lib/domains/admission";
import type { PlacementLevel, PlacementAnalysisResult } from "@/lib/domains/admission";
import { filterVerdicts } from "@/lib/domains/admission/placement/engine";
import { PlacementCard } from "./PlacementCard";

const ALL_LEVELS: PlacementLevel[] = ["safe", "possible", "bold", "unstable", "danger"];

// ─── 요약 바 ────────────────────────────────────

function PlacementSummaryBar({
  summary,
  total,
}: {
  summary: PlacementAnalysisResult["summary"];
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
        <span>총 {summary.total}개 학과</span>
        {summary.disqualified > 0 && (
          <span className="text-red-500">(결격 {summary.disqualified})</span>
        )}
      </div>

      {/* 컬러 바 */}
      <div className="flex h-3 overflow-hidden rounded-full">
        {ALL_LEVELS.map((level) => {
          const count = summary.byLevel[level];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const colorMap: Record<PlacementLevel, string> = {
            safe: "bg-emerald-500",
            possible: "bg-blue-500",
            bold: "bg-amber-500",
            unstable: "bg-orange-500",
            danger: "bg-red-500",
          };
          return (
            <div
              key={level}
              className={cn(colorMap[level], "transition-all")}
              style={{ width: `${pct}%` }}
              title={`${PLACEMENT_LABELS[level]}: ${count}개 (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs">
        {ALL_LEVELS.map((level) => {
          const count = summary.byLevel[level];
          if (count === 0) return null;
          const colors = PLACEMENT_COLORS[level];
          return (
            <span key={level} className="flex items-center gap-1">
              <span className={cn("inline-block size-2.5 rounded-full", colors.bg)} />
              <span className="text-[var(--text-secondary)]">
                {PLACEMENT_LABELS[level]} {count}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── 분석 결과 영역 ────────────────────────────────

export function PlacementResults({ data }: { data: PlacementAnalysisResult }) {
  const [filterLevels, setFilterLevels] = useState<PlacementLevel[]>([]);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDeptType, setFilterDeptType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 고유 지역/계열 추출
  const regions = useMemo(
    () => [...new Set(data.verdicts.map((v) => v.region).filter(Boolean))] as string[],
    [data.verdicts],
  );
  const deptTypes = useMemo(
    () => [...new Set(data.verdicts.map((v) => v.departmentType).filter(Boolean))] as string[],
    [data.verdicts],
  );

  const filtered = useMemo(
    () =>
      filterVerdicts(data.verdicts, {
        levels: filterLevels.length > 0 ? filterLevels : undefined,
        region: filterRegion || undefined,
        departmentType: filterDeptType || undefined,
        search: searchQuery || undefined,
      }),
    [data.verdicts, filterLevels, filterRegion, filterDeptType, searchQuery],
  );

  const toggleLevel = (level: PlacementLevel) => {
    setFilterLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 바 */}
      <PlacementSummaryBar summary={data.summary} total={data.verdicts.length} />

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 레벨 필터 토글 */}
        {ALL_LEVELS.map((level) => {
          const colors = PLACEMENT_COLORS[level];
          const active = filterLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                active
                  ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} ring-1 ring-current`
                  : "bg-bg-tertiary text-text-tertiary dark:bg-bg-secondary dark:text-text-tertiary",
              )}
            >
              {PLACEMENT_LABELS[level]} ({data.summary.byLevel[level]})
            </button>
          );
        })}

        {/* 지역 */}
        {regions.length > 0 && (
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1 text-xs"
          >
            <option value="">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        {/* 계열 */}
        {deptTypes.length > 0 && (
          <select
            value={filterDeptType}
            onChange={(e) => setFilterDeptType(e.target.value)}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1 text-xs"
          >
            <option value="">전체 계열</option>
            {deptTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* 검색 */}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대학/학과 검색"
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] py-1 pl-7 pr-2 text-xs"
          />
        </div>
      </div>

      {/* 결과 카드 목록 */}
      <div className="text-xs text-[var(--text-tertiary)]">
        {filtered.length}개 / {data.verdicts.length}개
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((verdict, idx) => (
          <PlacementCard key={`${verdict.universityName}-${verdict.departmentName}-${idx}`} verdict={verdict} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
          조건에 맞는 결과가 없습니다
        </div>
      )}
    </div>
  );
}
