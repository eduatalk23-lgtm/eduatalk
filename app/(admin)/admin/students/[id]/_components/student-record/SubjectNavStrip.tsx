"use client";

// ============================================
// SubjectNavStrip — 바텀시트 과목 전환 + 필터 스트립
// 학년 필터 | 교과 분류 필터 | ◀ 과목명 (N/M) ▶
// ============================================

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SubjectNavItem } from "./StudentRecordClient";

// ─── 상수 ──

type CategoryFilter = "all" | "general" | "elective" | "pe_art";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "전체",
  general: "일반",
  elective: "선택",
  pe_art: "체예",
};

// ─── Props ──

interface SubjectNavStripProps {
  items: SubjectNavItem[];
  activeSubjectId: string | null;
  gradeFilter: number | "all";
  categoryFilter: CategoryFilter;
  grades: number[];
  onGradeChange: (grade: number | "all") => void;
  onCategoryChange: (cat: CategoryFilter) => void;
  onSubjectSelect: (item: SubjectNavItem) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** 필터된 리스트에서 현재 인덱스 (0-based) */
  currentIndex: number;
  /** 필터된 리스트 총 개수 */
  totalCount: number;
}

// ─── Pill 버튼 스타일 ──

const PILL_ACTIVE = "bg-white text-[var(--text-primary)] shadow-sm dark:bg-bg-tertiary";
const PILL_INACTIVE = "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]";
const PILL_BASE = "rounded-md px-2 py-0.5 text-xs font-medium transition-colors";

// ─── 컴포넌트 ──

export function SubjectNavStrip({
  items,
  activeSubjectId,
  gradeFilter,
  categoryFilter,
  grades,
  onGradeChange,
  onCategoryChange,
  onSubjectSelect,
  onPrev,
  onNext,
  canPrev,
  canNext,
  currentIndex,
  totalCount,
}: SubjectNavStripProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭으로 닫기
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const activeItem = useMemo(
    () => items.find((s) => s.subjectId === activeSubjectId),
    [items, activeSubjectId],
  );

  const handleSelect = useCallback((item: SubjectNavItem) => {
    onSubjectSelect(item);
    setDropdownOpen(false);
  }, [onSubjectSelect]);

  // 카테고리가 존재하는 것만 표시
  const availableCategories = useMemo(() => {
    const cats = new Set(items.map((s) => s.category));
    return (Object.keys(CATEGORY_LABELS) as CategoryFilter[]).filter(
      (c) => c === "all" || cats.has(c),
    );
  }, [items]);

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-border px-5 py-1.5 dark:border-border">
      {/* 학년 필터 */}
      <div className="flex gap-0.5 rounded-lg bg-bg-tertiary p-0.5 dark:bg-bg-secondary">
        <button
          type="button"
          onClick={() => onGradeChange("all")}
          className={cn(PILL_BASE, gradeFilter === "all" ? PILL_ACTIVE : PILL_INACTIVE)}
        >
          전체
        </button>
        {grades.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGradeChange(g)}
            className={cn(PILL_BASE, gradeFilter === g ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {g}학년
          </button>
        ))}
      </div>

      {/* 교과 분류 필터 */}
      <div className="flex gap-0.5 rounded-lg bg-bg-tertiary p-0.5 dark:bg-bg-secondary">
        {availableCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={cn(PILL_BASE, categoryFilter === cat ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 과목 전환: ◀ 과목명 (N/M) ▶ + 드롭다운 */}
      <div className="ml-auto flex items-center gap-1" ref={dropdownRef}>
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-colors",
            canPrev ? "text-text-tertiary hover:bg-bg-tertiary dark:hover:bg-gray-800" : "text-text-disabled cursor-not-allowed dark:text-text-secondary",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setDropdownOpen((p) => !p)}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary dark:text-gray-100 dark:hover:bg-gray-800"
        >
          <span className="max-w-[120px] truncate">{activeItem?.subjectName ?? "과목"}</span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {currentIndex >= 0 ? `${currentIndex + 1}/${totalCount}` : ""}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded transition-colors",
            canNext ? "text-text-tertiary hover:bg-bg-tertiary dark:hover:bg-gray-800" : "text-text-disabled cursor-not-allowed dark:text-text-secondary",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* 드롭다운 목록 */}
        {dropdownOpen && (
          <div className="absolute left-1/2 top-full z-10 mt-1 max-h-[300px] w-64 -translate-x-1/2 overflow-y-auto rounded-lg border border-border bg-white shadow-lg dark:border-border dark:bg-bg-primary">
            {items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--text-tertiary)]">해당 조건의 과목이 없습니다</p>
            ) : (
              items.map((item) => (
                <button
                  key={`${item.grade}-${item.subjectId}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-secondary dark:hover:bg-gray-800",
                    item.subjectId === activeSubjectId && "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
                  )}
                >
                  {gradeFilter === "all" && (
                    <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 text-3xs font-medium text-text-tertiary dark:bg-bg-secondary dark:text-text-tertiary">
                      {item.grade}학년
                    </span>
                  )}
                  <span className="truncate">{item.subjectName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
