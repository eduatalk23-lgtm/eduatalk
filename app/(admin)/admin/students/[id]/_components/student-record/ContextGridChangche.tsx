"use client";

// ============================================
// 창체 컨텍스트 그리드
// 세특 ContextGrid와 동일한 7열 × 3관점 구조
// 행(관점): AI / 컨설턴트 / 확정
// 열(레이어): chat / guide / direction / draft / neis / analysis / memo
// 창체는 activity_type(자율/동아리/진로) 기준 — 3개 레코드
// ============================================

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche } from "@/lib/domains/student-record";
import type { GridColumnKey } from "./ContextGridBottomSheet";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";
import {
  PERSPECTIVES,
  COL_ROW_SPAN,
  COL_LABELS,
  COL_PERSPECTIVE_LABELS,
  type Perspective,
} from "./context-grid/grid-constants";
import { ChangcheGridCell } from "./context-grid/ChangcheGridCells";
import type { ChangcheGuideItemLike } from "./context-grid/ChangcheGridCells";
export type { ChangcheGuideItemLike };

// ─── 타입 ──

type GuideAssignmentLike = {
  id: string;
  status: string;
  target_subject_id?: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
};

export interface ContextGridChangcheProps {
  /** 단일 activity_type에 해당하는 창체 레코드 (바텀시트는 1개씩 표시) */
  record: RecordChangche | null;
  activityType: string;
  selectedColumns: GridColumnKey[];
  onColumnsChange: (cols: GridColumnKey[]) => void;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  tags: AnalysisTagLike[];
  guideAssignments: GuideAssignmentLike[];
  designGuideItem?: ChangcheGuideItemLike;
  improveGuideItem?: ChangcheGuideItemLike;
  isDesignMode?: boolean;
}

// ─── 메인 컴포넌트 ──

export function ContextGridChangche({
  record,
  activityType,
  selectedColumns,
  onColumnsChange,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  tags,
  guideAssignments,
  designGuideItem,
  improveGuideItem,
  isDesignMode,
}: ContextGridChangcheProps) {
  const [columnPerspectives, setColumnPerspectives] = useState<Record<string, Set<Perspective>>>(() => {
    const init: Record<string, Set<Perspective>> = {};
    for (const col of selectedColumns) {
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

  const activityLabel = (CHANGCHE_TYPE_LABELS as Record<string, string>)[activityType] ?? activityType;

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
              {/* 헤더 */}
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

              {/* 셀 */}
              {isSplit && checkedPersp ? (
                checkedPersp.map((perspective) => (
                  <div key={perspective} className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-bg-primary">
                    <ChangcheGridCell
                      column={col}
                      perspective={perspective}
                      record={record}
                      activityType={activityType}
                      activityLabel={activityLabel}
                      charLimit={charLimit}
                      studentId={studentId}
                      schoolYear={schoolYear}
                      tenantId={tenantId}
                      grade={grade}
                      tags={tags}
                      guideAssignments={guideAssignments}
                      designGuideItem={designGuideItem}
                      improveGuideItem={improveGuideItem}
                      isDesignMode={isDesignMode}
                    />
                  </div>
                ))
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-bg-primary">
                  <ChangcheGridCell
                    column={col}
                    perspective="ai"
                    record={record}
                    activityType={activityType}
                    activityLabel={activityLabel}
                    charLimit={charLimit}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    tags={tags}
                    guideAssignments={guideAssignments}
                    designGuideItem={designGuideItem}
                    improveGuideItem={improveGuideItem}
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
