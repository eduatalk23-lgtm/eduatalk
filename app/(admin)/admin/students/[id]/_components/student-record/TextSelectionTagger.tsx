"use client";

// ============================================
// 컨설턴트 드래그-태깅 UI
// 텍스트 선택 → 역량 태그 지정 팝오버
// ============================================

import { useState, useRef, useCallback, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { addActivityTagsBatchAction } from "@/lib/domains/student-record/actions/diagnosis";
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

const AREA_COLORS: Record<CompetencyArea, { selected: string; idle: string }> = {
  academic: {
    selected: "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    idle: "border-transparent bg-gray-50 text-[var(--text-secondary)] hover:bg-blue-50/50 hover:text-blue-600 dark:bg-gray-800 dark:hover:bg-blue-900/20",
  },
  career: {
    selected: "border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
    idle: "border-transparent bg-gray-50 text-[var(--text-secondary)] hover:bg-purple-50/50 hover:text-purple-600 dark:bg-gray-800 dark:hover:bg-purple-900/20",
  },
  community: {
    selected: "border-green-400 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-300",
    idle: "border-transparent bg-gray-50 text-[var(--text-secondary)] hover:bg-green-50/50 hover:text-green-600 dark:bg-gray-800 dark:hover:bg-green-900/20",
  },
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

    setSelectedText(text);
    // fixed 포지셔닝용 뷰포트 좌표
    const popW = 320;
    const below = rect.bottom + 8;
    const above = rect.top - 8;
    const useBelow = below + 300 < window.innerHeight;
    setPopoverPos({
      top: useBelow ? below : above,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - popW - 8),
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
        status: "suggested",
      };

      const res = await addActivityTagsBatchAction([tagInput]);
      if (!res.success) throw new Error("error" in res ? res.error : "태그 저장 실패");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTabPrefix(studentId) });
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
        <>
        {/* 백드롭 */}
        <div className="fixed inset-0 z-[9998]" onClick={closePopover} />
        <div
          className="fixed z-[9999] w-[320px] rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-600 dark:bg-gray-800"
          style={{ top: popoverPos.top, left: popoverPos.left }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              <Tag className="h-4 w-4" />
              역량 태그 지정
            </div>
            <button onClick={closePopover} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-4 w-4 text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* 선택된 텍스트 미리보기 */}
          <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            &ldquo;{selectedText.slice(0, 100)}{selectedText.length > 100 ? "..." : ""}&rdquo;
          </div>

          {/* 평가 선택 */}
          <div className="mb-3 flex gap-1.5">
            {EVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedEval(opt.value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  selectedEval === opt.value ? opt.color : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 역량 항목 선택 */}
          <div className="max-h-[240px] overflow-y-auto">
            {(Object.entries(grouped) as [CompetencyArea, typeof COMPETENCY_ITEMS][]).map(([area, items]) => (
              <div key={area} className="mb-2.5">
                <div className="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">
                  {COMPETENCY_AREA_LABELS[area]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setSelectedItem(item.code)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                        selectedItem === item.code
                          ? AREA_COLORS[area].selected
                          : AREA_COLORS[area].idle,
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
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white",
              selectedItem && !saveMutation.isPending
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "cursor-not-allowed bg-gray-400",
            )}
          >
            {saveMutation.isPending ? "저장 중..." : <><Check className="h-4 w-4" /> 태그 저장</>}
          </button>
        </div>
        </>
      )}
    </div>
  );
}
