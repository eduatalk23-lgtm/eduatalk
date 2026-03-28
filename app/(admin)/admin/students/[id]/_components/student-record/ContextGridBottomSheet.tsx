"use client";

// ============================================
// 컨텍스트 그리드 바텀시트
// z-index 오버레이, 가로 100%, 하단에서 위로 슬라이드
// ContextGrid 컴포넌트를 래핑하여 전체폭 그리드 제공
// ============================================

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Check, ChevronUp, X } from "lucide-react";
import { ContextGrid } from "./ContextGrid";
import { useStudentRecordContext } from "./StudentRecordContext";
import { recordTabQueryOptions, diagnosisTabQueryOptions } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import type { SetekLayerTab, MergedSetekRow } from "./SetekEditor";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";

const DEFAULT_COLUMNS: SetekLayerTab[] = ["draft", "neis", "analysis"];
const MAX_COLUMNS = 3;
const SELECTABLE_COLS: SetekLayerTab[] = ["guide", "direction", "draft", "neis", "analysis", "memo"];
const COL_LABELS: Record<SetekLayerTab, string> = {
  chat: "논의", guide: "가이드", direction: "방향", draft: "가안", neis: "NEIS", analysis: "분석", memo: "메모",
};

export function ContextGridBottomSheet({ onOpenTopSheet }: { onOpenTopSheet?: () => void }) {
  const ctx = useStudentRecordContext();
  const { activeSubjectId, activeSchoolYear, activeSubjectName, studentId, tenantId } = ctx;

  // 시트 표시 여부 (DOM 유지) vs 열림 상태 (애니메이션)
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<SetekLayerTab[]>(DEFAULT_COLUMNS);

  // 데이터가 준비되면 시트를 보여주고, 다음 프레임에 열기 애니메이션 시작
  useEffect(() => {
    if (activeSubjectId && activeSchoolYear) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
    }
  }, [activeSubjectId, activeSchoolYear]);

  const close = useCallback(() => {
    setIsOpen(false);
    // 애니메이션 완료 후 DOM 제거 + context 초기화
    setTimeout(() => {
      setVisible(false);
      ctx.setActiveSubjectId?.(null);
      ctx.setActiveSchoolYear?.(null);
      ctx.setActiveSubjectName?.(null);
    }, 300);
  }, [ctx]);

  // Escape로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // 열 제한 (최대 3개)
  const handleColumnsChange = useCallback((cols: SetekLayerTab[]) => {
    if (cols.length > MAX_COLUMNS) return;
    setSelectedColumns(cols);
  }, []);

  const handleColumnToggle = useCallback((col: SetekLayerTab) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== col);
      }
      if (prev.length >= MAX_COLUMNS) return prev;
      return [...prev, col].sort(
        (a, b) => SELECTABLE_COLS.indexOf(a) - SELECTABLE_COLS.indexOf(b),
      );
    });
  }, []);

  // React Query — 캐시 재사용
  const { data: recordData } = useQuery(
    recordTabQueryOptions(studentId, activeSchoolYear ?? 0),
  );
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, activeSchoolYear ?? 0, tenantId),
  );

  // 선택된 과목의 세특 레코드
  const subjectRecords = useMemo(() => {
    if (!recordData?.seteks || !activeSubjectId) return [];
    return (recordData.seteks as RecordSetek[])
      .filter((s) => s.subject_id === activeSubjectId)
      .sort((a, b) => a.semester - b.semester);
  }, [recordData?.seteks, activeSubjectId]);

  // MergedSetekRow 구성
  const mergedRow: MergedSetekRow | null = useMemo(() => {
    if (subjectRecords.length === 0) return null;
    return {
      displayName: activeSubjectName ?? "과목",
      records: subjectRecords,
      subjectId: activeSubjectId!,
    };
  }, [subjectRecords, activeSubjectName, activeSubjectId]);

  // 분석 태그 필터
  const subjectTags = useMemo(() => {
    if (!diagnosisData?.activityTags || subjectRecords.length === 0) return [];
    const recordIds = new Set(subjectRecords.map((r) => r.id));
    return (diagnosisData.activityTags as AnalysisTagLike[]).filter(
      (t) => t.record_type === "setek" && recordIds.has(t.record_id),
    );
  }, [diagnosisData?.activityTags, subjectRecords]);

  const charLimit = getCharLimit("setek", activeSchoolYear ?? 0);
  const grade = subjectRecords[0]?.grade ?? 1;

  // DOM에 없으면 아무것도 렌더하지 않음
  if (!visible) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={close}
      />

      {/* 바텀시트 */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ height: "80vh" }}
      >
        {/* 헤더: 과목명(좌) | 열 선택(가운데) | 학생컨텍스트+닫기(우) — 1행 */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-2 pb-2 dark:border-gray-800">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2">
            {/* 좌: 과목명 */}
            <h3 className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">
              {mergedRow?.displayName ?? "과목"}
            </h3>

            {/* 가운데: 열 선택 */}
            <div className="flex flex-1 items-center justify-center gap-1.5">
              {SELECTABLE_COLS.map((col) => {
                const active = selectedColumns.includes(col);
                const disabled = !active && selectedColumns.length >= MAX_COLUMNS;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleColumnToggle(col)}
                    disabled={disabled}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2.5 py-1 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : disabled
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {COL_LABELS[col]}
                  </button>
                );
              })}
            </div>

            {/* 우: 학생 컨텍스트 + 닫기 */}
            <div className="flex shrink-0 items-center gap-1.5">
              {onOpenTopSheet && (
                <button
                  type="button"
                  onClick={onOpenTopSheet}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  학생 컨텍스트
                </button>
              )}
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 그리드 콘텐츠 — 남은 높이를 그리드에 전달 (시트 스크롤 없음) */}
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          {mergedRow ? (
            <ContextGrid
              row={mergedRow}
              selectedColumns={selectedColumns}
              onColumnsChange={handleColumnsChange}
              charLimit={charLimit}
              studentId={studentId}
              schoolYear={activeSchoolYear ?? 0}
              tenantId={tenantId}
              grade={grade}
              subjectTags={subjectTags}
              subjectGuides={[]}
              subjectDirection={[]}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">데이터를 불러오는 중...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
