"use client";

// ============================================
// 컨텍스트 그리드 — 특정 과목의 모든 레이어를 열로 펼쳐 비교
// 행(관점): AI / 컨설턴트 / 확정
// 열(레이어): 선택 가능 (가이드/가안/NEIS/분석/메모/논의/방향)
// Phase 3: NEIS, 메모 열 (rowSpan=3) 우선 구현
// ============================================

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { MergedSetekRow, SetekGuideItemLike } from "./stages/record/SetekEditor";
import type { GridColumnKey } from "./ContextGridBottomSheet";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";
import type { SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import {
  PERSPECTIVES,
  COL_ROW_SPAN,
  COL_LABELS,
  COL_PERSPECTIVE_LABELS,
  type Perspective,
} from "./context-grid/grid-constants";
import { GridCell } from "./context-grid/ContextGridCells";

// ─── 타입 ──

type GuideAssignmentLike = {
  id: string;
  status: string;
  target_subject_id?: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
};

export interface ContextGridProps {
  row: MergedSetekRow;
  selectedColumns: GridColumnKey[];
  onColumnsChange: (cols: GridColumnKey[]) => void;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  subjectTags: AnalysisTagLike[];
  subjectReflection?: SubjectReflectionRate;
  subjectGuides: GuideAssignmentLike[];
  subjectDirection: SetekGuideItemLike[];
  /** 설계 모드(NEIS 없음) 학년 — AI 초안/분석 미생성 안내 */
  isDesignMode?: boolean;
}

const SELECTABLE_COLUMNS: GridColumnKey[] = [
  "chat", "guide", "design_direction", "draft", "draft_analysis",
  "neis", "analysis", "improve_direction", "memo",
];

// ─── 메인 컴포넌트 ──

export function ContextGrid({
  row,
  selectedColumns,
  onColumnsChange,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  subjectTags,
  subjectReflection,
  subjectGuides,
  subjectDirection,
  isDesignMode,
}: ContextGridProps) {
  const [columnPerspectives, setColumnPerspectives] = useState<Record<string, Set<Perspective>>>(() => {
    const init: Record<string, Set<Perspective>> = {};
    for (const col of SELECTABLE_COLUMNS) {
      if (COL_ROW_SPAN[col] === 1) {
        init[col] = new Set(PERSPECTIVES);
      }
    }
    return init;
  });

  const togglePerspective = useCallback((col: GridColumnKey, p: Perspective) => {
    setColumnPerspectives((prev) => {
      const current = prev[col] ?? new Set(PERSPECTIVES);
      const next = new Set(current);
      if (next.has(p)) {
        if (next.size <= 1) return prev;
        next.delete(p);
      } else {
        next.add(p);
      }
      return { ...prev, [col]: next };
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 flex gap-px rounded-lg overflow-hidden bg-bg-tertiary dark:bg-bg-tertiary">
        {selectedColumns.map((col) => {
          const isSplit = COL_ROW_SPAN[col] === 1;
          const perspLabels = COL_PERSPECTIVE_LABELS[col];
          const checkedPersp = isSplit
            ? PERSPECTIVES.filter((p) => columnPerspectives[col]?.has(p) ?? true)
            : null;

          return (
            <div key={col} className="flex min-h-0 flex-1 flex-col gap-px">
              {/* 헤더 1행: 타이틀(좌) + 체크박스(우) */}
              <div className="flex-shrink-0 flex items-center gap-2 bg-bg-secondary px-3 py-2 dark:bg-bg-secondary">
                <span className="text-sm font-semibold text-text-primary dark:text-gray-200">
                  {COL_LABELS[col]}
                </span>
                {isSplit && perspLabels && (
                  <div className="ml-auto flex items-center gap-2">
                    {PERSPECTIVES.map((p) => {
                      const checked = columnPerspectives[col]?.has(p) ?? true;
                      return (
                        <label key={p} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerspective(col, p)}
                            className="h-3.5 w-3.5 rounded border-border text-indigo-600 focus:ring-indigo-500 dark:border-border"
                          />
                          <span className={cn("text-xs", checked ? "text-text-secondary dark:text-text-disabled" : "text-text-tertiary dark:text-text-secondary")}>
                            {perspLabels[p]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 셀: 분리 열은 체크된 관점만, rowSpan 열은 단일 셀 */}
              {isSplit && checkedPersp ? (
                checkedPersp.map((perspective) => (
                  <div key={perspective} className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-bg-primary">
                    <GridCell
                      column={col}
                      perspective={perspective}
                      row={row}
                      charLimit={charLimit}
                      studentId={studentId}
                      schoolYear={schoolYear}
                      tenantId={tenantId}
                      grade={grade}
                      subjectTags={subjectTags}
                      subjectReflection={subjectReflection}
                      subjectGuides={subjectGuides}
                      subjectDirection={subjectDirection}
                      isDesignMode={isDesignMode}
                    />
                  </div>
                ))
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-bg-primary">
                  <GridCell
                    column={col}
                    perspective="ai"
                    row={row}
                    charLimit={charLimit}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    subjectTags={subjectTags}
                    subjectReflection={subjectReflection}
                    subjectGuides={subjectGuides}
                    subjectDirection={subjectDirection}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
