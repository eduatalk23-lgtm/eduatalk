"use client";

// ============================================
// Phase 6.5 — AI 면접 예상 질문 패널
// ============================================

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { generateInterviewQuestions } from "@/lib/domains/student-record/llm/actions/generateInterviewQuestions";
import type { GeneratedInterviewQuestion, InterviewQuestionType } from "@/lib/domains/student-record/llm/actions/generateInterviewQuestions";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

type RecordOption = {
  id: string;
  label: string;
  content: string;
  type: string;
  subjectName?: string;
  grade?: number;
};

type Props = {
  records: RecordOption[];
};

const TYPE_STYLE: Record<InterviewQuestionType, { label: string; color: string }> = {
  factual: { label: "사실형", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  reasoning: { label: "추론형", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  application: { label: "적용형", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  value: { label: "가치관형", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  controversial: { label: "심층형", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const DIFF_STYLE: Record<string, string> = {
  easy: "text-green-600",
  medium: "text-amber-600",
  hard: "text-red-600",
};

export function InterviewQuestionPanel({ records }: Props) {
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [questions, setQuestions] = useState<GeneratedInterviewQuestion[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const rec = records.find((r) => r.id === selectedRecordId);
      if (!rec) throw new Error("레코드를 선택해주세요.");
      const result = await generateInterviewQuestions({
        content: rec.content,
        recordType: rec.type,
        subjectName: rec.subjectName,
        grade: rec.grade,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      setQuestions(data.questions);
      setExpandedIdx(null);
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 생성 폼 */}
      <div className="flex items-center gap-3">
        <select
          value={selectedRecordId}
          onChange={(e) => setSelectedRecordId(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 bg-[var(--background)] px-3 py-1.5 text-xs dark:border-gray-600"
        >
          <option value="">기록 선택...</option>
          {records.filter((r) => r.content.trim().length >= 30).map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={() => mutation.mutate()}
          disabled={!selectedRecordId || mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {mutation.isPending ? "생성 중..." : "면접 질문 생성"}
        </button>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}

      {/* 질문 목록 */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              예상 질문 {questions.length}개
            </span>
            <div className="flex gap-1">
              {(Object.entries(TYPE_STYLE) as [InterviewQuestionType, { label: string; color: string }][]).map(([type, style]) => {
                const count = questions.filter((q) => q.questionType === type).length;
                if (count === 0) return null;
                return (
                  <span key={type} className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", style.color)}>
                    {style.label} {count}
                  </span>
                );
              })}
            </div>
          </div>

          {questions.map((q, i) => {
            const typeStyle = TYPE_STYLE[q.questionType];
            const isExpanded = expandedIdx === i;

            return (
              <div key={i} className="rounded-md border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--surface-hover)]"
                >
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium", typeStyle.color)}>
                    {typeStyle.label}
                  </span>
                  <span className="flex-1 text-xs text-[var(--text-primary)]">{q.question}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("text-[9px]", DIFF_STYLE[q.difficulty] ?? "text-gray-500")}>
                      {q.difficulty === "easy" ? "기본" : q.difficulty === "hard" ? "심화" : "보통"}
                    </span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
                </button>

                {isExpanded && q.suggestedAnswer && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/30">
                    <span className="text-[9px] font-medium text-[var(--text-tertiary)]">예시 답변</span>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{q.suggestedAnswer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
