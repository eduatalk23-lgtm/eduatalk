"use client";

// ============================================
// 컨설턴트 드래그-태깅 UI
// 텍스트 선택 → 역량 태그 지정 팝오버
// ============================================

import { useState, useRef, useCallback, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { addActivityTagsBatchAction, saveAnalysisCacheAction } from "@/lib/domains/student-record/actions/diagnosis";
import type { ActivityTagInsert } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyArea } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { Tag, X, Check } from "lucide-react";

type Evaluation = "positive" | "negative" | "needs_review";

interface TextSelectionTaggerProps {
  content: string;
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  recordId: string;
  studentId: string;
  tenantId: string;
  schoolYear: number;
  subjectName?: string;
  children?: ReactNode;
}

const EVAL_OPTIONS: Array<{ value: Evaluation; label: string; color: string }> = [
  { value: "positive", label: "+강점", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "negative", label: "-약점", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "needs_review", label: "?확인", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
];

const AREA_COLORS: Record<CompetencyArea, string> = {
  academic: "border-blue-300 dark:border-blue-700",
  career: "border-purple-300 dark:border-purple-700",
  community: "border-green-300 dark:border-green-700",
};

export function TextSelectionTagger({
  content,
  recordType,
  recordId,
  studentId,
  tenantId,
  schoolYear,
  children,
}: TextSelectionTaggerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [selectedText, setSelectedText] = useState("");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedEval, setSelectedEval] = useState<Evaluation>("positive");

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) return; // 5자 미만 무시

    // 선택 영역이 컨테이너 내부인지 확인
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setSelectedText(text);
    setPopoverPos({
      top: rect.bottom - containerRect.top + 8,
      left: Math.min(rect.left - containerRect.left, containerRect.width - 280),
    });
    setSelectedItem(null);
    setSelectedEval("positive");
  }, []);

  const closePopover = useCallback(() => {
    setPopoverPos(null);
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;

      const tagInput: ActivityTagInsert = {
        tenant_id: tenantId,
        student_id: studentId,
        record_type: recordType,
        record_id: recordId,
        competency_item: selectedItem,
        evaluation: selectedEval,
        evidence_summary: `[컨설턴트] 근거: "${selectedText}"`,
        source: "manual",
        status: "confirmed",
      };

      await addActivityTagsBatchAction([tagInput]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) });
      closePopover();
    },
  });

  // 역량 항목을 영역별로 그룹핑
  const grouped = COMPETENCY_ITEMS.reduce<Record<CompetencyArea, typeof COMPETENCY_ITEMS>>((acc, item) => {
    (acc[item.area] ??= []).push(item);
    return acc;
  }, {} as Record<CompetencyArea, typeof COMPETENCY_ITEMS>);

  return (
    <div ref={containerRef} className="relative" onMouseUp={handleMouseUp}>
      {/* 원문 텍스트 */}
      {children ?? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
          {content}
        </p>
      )}

      {/* 선택 팝오버 */}
      {popoverPos && (
        <div
          className="absolute z-50 w-[280px] rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-lg"
          style={{ top: popoverPos.top, left: Math.max(0, popoverPos.left) }}
        >
          {/* 헤더 */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
              <Tag className="h-3 w-3" />
              역량 태그 지정
            </div>
            <button onClick={closePopover} className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-3 w-3 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* 선택된 텍스트 미리보기 */}
          <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? "..." : ""}&rdquo;
          </div>

          {/* 평가 선택 */}
          <div className="mb-2 flex gap-1">
            {EVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedEval(opt.value)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[10px] font-medium transition-all",
                  selectedEval === opt.value ? opt.color : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 역량 항목 선택 */}
          <div className="max-h-[200px] overflow-y-auto">
            {(Object.entries(grouped) as [CompetencyArea, typeof COMPETENCY_ITEMS][]).map(([area, items]) => (
              <div key={area} className="mb-1.5">
                <div className="mb-0.5 text-[9px] font-semibold uppercase text-[var(--text-tertiary)]">
                  {COMPETENCY_AREA_LABELS[area]}
                </div>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setSelectedItem(item.code)}
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] transition-all",
                        selectedItem === item.code
                          ? `${AREA_COLORS[area]} bg-[var(--surface-secondary)] font-medium text-[var(--text-primary)]`
                          : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedItem || saveMutation.isPending}
            className={cn(
              "mt-2 flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white",
              selectedItem && !saveMutation.isPending
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-400",
            )}
          >
            {saveMutation.isPending ? "저장 중..." : <><Check className="h-3 w-3" /> 태그 저장</>}
          </button>
        </div>
      )}
    </div>
  );
}
