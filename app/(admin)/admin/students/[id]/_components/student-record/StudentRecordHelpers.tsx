"use client";

// ============================================
// StudentRecord 공통 UI 헬퍼 컴포넌트
// GradeLabel, DocSection, StrategySection, SubHeader,
// InfoRow, EmptyTable, SectionSkeleton, StageDivider
// ============================================

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── 학년 라벨 ──────────────────────────────────────

export function GradeLabel({ grade, schoolYear }: { grade: number; schoolYear: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
        {grade}학년
      </span>
      <span className="text-xs text-[var(--text-tertiary)]">{schoolYear}학년도</span>
    </div>
  );
}

// ─── 문서 섹션 래퍼 (공식 기록 1~9) ─────────────────

export function DocSection({ id, number, title, children, isEmpty, emptyLabel }: {
  id: string; number: string; title: string; children: React.ReactNode;
  isEmpty?: boolean; emptyLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(!!isEmpty);

  // 데이터 상태 변경 시 접기 동기화 (렌더 중 상태 조정 — useEffect 대신)
  const [prevIsEmpty, setPrevIsEmpty] = useState(isEmpty);
  if (isEmpty !== prevIsEmpty) {
    setPrevIsEmpty(isEmpty);
    if (isEmpty) setCollapsed(true);
  }

  return (
    <section data-section-id={id} className="mb-6 scroll-mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {number}. {title}
        </h3>
        {isEmpty && !collapsed ? null : isEmpty ? (
          <span className="text-xs text-[var(--text-tertiary)]">
            {emptyLabel ?? "해당 없음"}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

// ─── 전략 섹션 래퍼 ─────────────────────────────────

export function StrategySection({ id, title, children, isEmpty, emptyLabel }: {
  id: string; title: string; children: React.ReactNode;
  isEmpty?: boolean; emptyLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(!!isEmpty);

  // 데이터 상태 변경 시 접기 동기화 (렌더 중 상태 조정)
  const [prevIsEmpty, setPrevIsEmpty] = useState(isEmpty);
  if (isEmpty !== prevIsEmpty) {
    setPrevIsEmpty(isEmpty);
    if (isEmpty) setCollapsed(true);
  }

  return (
    <section data-section-id={id} className="mb-8 scroll-mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-4 flex w-full items-center gap-2 border-b border-[var(--border-secondary)] pb-2 text-left"
      >
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h3>
        {isEmpty && collapsed && (
          <span className="text-xs text-[var(--text-tertiary)]">
            {emptyLabel ?? "데이터 없음"}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

// ─── 서브 헤더 ──────────────────────────────────────

export function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">
      &lt; {children} &gt;
    </h4>
  );
}

// ─── 인적사항 테이블 행 ─────────────────────────────

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-24 border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
        {label}
      </td>
      <td className="border border-gray-400 px-3 py-1.5 text-sm text-[var(--text-primary)] dark:border-gray-500">{value}</td>
    </tr>
  );
}

// ─── 빈 테이블 모형 (4,5번) ─────────────────────────

export function EmptyTable({ title, headers }: { title?: string; headers: string[] }) {
  return (
    <div>
      {title && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">&lt; {title} &gt;</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={headers.length} className="border border-gray-400 px-4 py-2 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500">
                해당 사항 없음
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 로딩 스켈레톤 ──────────────────────────────────

export function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 animate-pulse rounded bg-bg-tertiary dark:bg-bg-tertiary" />
      <div className="h-20 w-full animate-pulse rounded bg-bg-tertiary dark:bg-bg-tertiary" />
    </div>
  );
}

// ─── 스테이지 구분선 ──────────────────────────────────

export function StageDivider({ emoji, label, hint }: { emoji: string; label: string; hint?: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 my-8 border-y border-border bg-bg-secondary/90 px-4 py-2.5 backdrop-blur-sm dark:border-border dark:bg-bg-primary/90 sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
          {emoji} {label}
        </span>
        {hint && (
          <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>
        )}
      </div>
    </div>
  );
}
