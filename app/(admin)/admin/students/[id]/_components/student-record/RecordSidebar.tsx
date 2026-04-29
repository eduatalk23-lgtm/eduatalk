"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { ClipboardList, Search, Compass, Target, ChevronDown } from "lucide-react";
import { RecordYearSelector } from "./RecordYearSelector";
import type { StageId, StageConfig } from "./recordStages";

import type { ProgressCounts } from "@/lib/domains/student-record/types";
export type { ProgressCounts };

type RecordSidebarProps = {
  stages: StageConfig[];
  activeSection: string;
  viewMode: "all" | number;
  onViewModeChange: (v: "all" | number) => void;
  studentGrade: number;
  studentId: string;
  progressCounts: ProgressCounts;
  scrollToSection: (id: string) => void;
  onImportOpen: () => void;
};

export function RecordSidebar({
  stages,
  activeSection,
  viewMode,
  onViewModeChange,
  studentGrade,
  studentId,
  progressCounts,
  scrollToSection,
  onImportOpen,
}: RecordSidebarProps) {
  const [expandedStages, setExpandedStages] = useState<Set<StageId>>(
    () => new Set<StageId>(["record", "diagnosis", "design", "strategy"]),
  );

  const toggleStage = useCallback((stageId: StageId) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const { recordFilled, recordTotal, diagnosisFilled, designFilled, strategyFilled } = progressCounts;
  const totalFilled = recordFilled + diagnosisFilled + designFilled + strategyFilled;
  const totalAll = recordTotal + 1 + 7 + 6;
  const totalPct = Math.round((totalFilled / totalAll) * 100);

  return (
    <div className="flex flex-col gap-0.5 p-3">
      {/* 진행률 대시보드 */}
      <div className="mb-3 rounded-lg bg-[var(--surface-secondary)] px-3 py-2.5">
        {/* 전체 진행률 */}
        <div className="mb-2 flex items-center justify-between pb-1.5 border-b border-[var(--border-secondary)]">
          <span className="text-xs font-semibold text-[var(--text-primary)]">전체 진행</span>
          <span className={`text-xs font-bold ${totalPct >= 80 ? "text-emerald-600" : totalPct >= 50 ? "text-amber-600" : "text-text-tertiary"}`}>
            {totalPct}% ({totalFilled}/{totalAll})
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {([
            { label: "기록", icon: ClipboardList, filled: recordFilled, total: recordTotal, color: "bg-blue-500" },
            { label: "진단", icon: Search, filled: diagnosisFilled, total: 1, color: "bg-purple-500" },
            { label: "설계", icon: Compass, filled: designFilled, total: 7, color: "bg-indigo-500" },
            { label: "전략", icon: Target, filled: strategyFilled, total: 6, color: "bg-emerald-500" },
          ] as const).map(({ label, icon: Icon, filled, total, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="flex w-14 shrink-0 items-center gap-1 text-xs text-[var(--text-secondary)]">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <div className="flex-1 h-2 overflow-hidden rounded-full bg-bg-tertiary dark:bg-bg-tertiary">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${total > 0 ? Math.round((filled / total) * 100) : 0}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-[var(--text-primary)]">{filled}/{total}</span>
            </div>
          ))}
        </div>
        {/* G4-5: 불완전함 보존 알림 */}
        {(totalFilled / totalAll) >= 0.95 && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            완벽한 일관성보다 자연스러운 다양성이 설득력 있습니다
          </p>
        )}
      </div>

      {/* 스테이지 TOC */}
      {stages.map((stage) => {
        const isExpanded = expandedStages.has(stage.id);
        const hasActive = stage.sections.some((s) => s.id === activeSection);

        return (
          <div key={stage.id}>
            <button
              onClick={() => toggleStage(stage.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors",
                hasActive && !isExpanded
                  ? "text-indigo-700 dark:text-indigo-300"
                  : "text-[var(--text-primary)]",
                "hover:bg-[var(--surface-hover)]",
              )}
            >
              <span>{stage.emoji} {stage.label}</span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-[var(--text-tertiary)] transition-transform duration-150",
                  isExpanded && "rotate-180",
                )}
              />
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-0.5 pb-1">
                {stage.hasYearSelector && (
                  <div className="px-2 py-1">
                    <RecordYearSelector compact value={viewMode} onChange={onViewModeChange} studentGrade={studentGrade} />
                  </div>
                )}
                {stage.sections.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
                      item.indent ? "pl-9" : "pl-7",
                      activeSection === item.id
                        ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    {item.number && (
                      <span className="inline-flex size-5 flex-shrink-0 items-center justify-center rounded bg-bg-tertiary text-xs font-semibold text-text-secondary dark:bg-bg-tertiary dark:text-text-disabled">
                        {item.number}
                      </span>
                    )}
                    {item.indent && <span className="text-[var(--text-tertiary)]">├</span>}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* PDF 가져오기 */}
      <div className="mt-3 border-t border-[var(--border-secondary)] pt-3">
        <button
          type="button"
          onClick={onImportOpen}
          className="w-full rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          PDF 가져오기
        </button>
      </div>

      {/* Report 생성 */}
      <div className="mt-2">
        <Link
          href={`/admin/students/${studentId}/report`}
          target="_blank"
          className="block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
        >
          Report 생성
        </Link>
      </div>
    </div>
  );
}
