"use client";

// ============================================
// AI 역량 태그 제안 패널
// Phase 5.5a — 세특/창체/행특에서 "AI 태그 제안" 버튼 클릭 시 표시
// ============================================

import { useState, useTransition } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { suggestCompetencyTags } from "@/lib/domains/record-analysis/llm/actions/suggestTags";
import { addActivityTagAction } from "@/lib/domains/student-record/actions/competency";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { TagSuggestion, SuggestTagsInput } from "@/lib/domains/record-analysis/llm/types";

type Props = {
  studentId: string;
  tenantId: string;
  schoolYear: number;
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  recordId: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

const EVAL_LABELS: Record<string, { label: string; className: string }> = {
  positive: { label: "긍정", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  negative: { label: "부정", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  needs_review: { label: "확인필요", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

function getItemLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

function getAreaLabel(code: string): string {
  const area = COMPETENCY_ITEMS.find((i) => i.code === code)?.area;
  return area ? COMPETENCY_AREA_LABELS[area] : "";
}

export function ActivityTagSuggestionPanel({
  studentId, tenantId, schoolYear,
  recordType, recordId, content,
  subjectName, grade,
}: Props) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[] | null>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // AI 제안 요청
  const suggestMutation = useMutation({
    mutationFn: async () => {
      const input: SuggestTagsInput = { content, recordType, subjectName, grade };
      const result = await suggestCompetencyTags(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setSummary(data.summary);
      setAccepted(new Set());
      setRejected(new Set());
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // 개별 태그 수락 → activity_tags에 저장
  function handleAccept(idx: number, tag: TagSuggestion) {
    startTransition(async () => {
      const evidence = `[AI] ${tag.reasoning}\n근거: ${tag.evidenceKeywords.join(", ")}\n루브릭: ${tag.matchedRubricQuestion}`;
      const result = await addActivityTagAction({
        tenant_id: tenantId,
        student_id: studentId,
        record_type: recordType,
        record_id: recordId,
        competency_item: tag.competencyItem,
        evaluation: tag.evaluation,
        evidence_summary: evidence,
        source: "ai",
        status: "suggested",
      });
      if (result.success) {
        setAccepted((prev) => new Set(prev).add(idx));
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear),
        });
      }
    });
  }

  function handleReject(idx: number) {
    setRejected((prev) => new Set(prev).add(idx));
  }

  // 분석 전 or 텍스트 짧은 경우
  if (!suggestions && !suggestMutation.isPending && !error) {
    return (
      <button
        onClick={() => suggestMutation.mutate()}
        disabled={!content || content.trim().length < 20}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 1Z" />
          <path fillRule="evenodd" d="M3 3a1 1 0 0 1 1-1h.5a.75.75 0 0 0 0-1.5H4a2.5 2.5 0 0 0-2.5 2.5v.5a.75.75 0 0 0 1.5 0V3Zm9-1a1 1 0 0 1 1 1v.5a.75.75 0 0 0 1.5 0V3A2.5 2.5 0 0 0 12 .5h-.5a.75.75 0 0 0 0 1.5H12ZM3 12a1 1 0 0 0 1 1h.5a.75.75 0 0 1 0 1.5H4A2.5 2.5 0 0 1 1.5 12v-.5a.75.75 0 0 1 1.5 0v.5Zm10 1a1 1 0 0 0-1-1h-.5a.75.75 0 0 1 0-1.5h.5A2.5 2.5 0 0 1 14.5 12v.5a.75.75 0 0 1-1.5 0V12Z" clipRule="evenodd" />
        </svg>
        AI 역량 태그 제안
      </button>
    );
  }

  // 로딩
  if (suggestMutation.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs text-blue-600 dark:border-blue-800 dark:bg-blue-900/10 dark:text-blue-400">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
        역량을 분석하고 있습니다...
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs dark:border-red-800 dark:bg-red-900/10">
        <span className="text-red-600 dark:text-red-400">{error}</span>
        <button
          onClick={() => { setError(""); suggestMutation.mutate(); }}
          className="text-red-700 underline hover:no-underline dark:text-red-400"
        >
          재시도
        </button>
      </div>
    );
  }

  // 결과
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/30">
        <span className="text-[var(--text-tertiary)]">{summary || "태그 제안 없음"}</span>
        <button
          onClick={() => setSuggestions(null)}
          className="text-[var(--text-tertiary)] underline hover:no-underline"
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50/30 p-3 dark:border-blue-800 dark:bg-blue-900/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
          AI 제안 ({suggestions.length}개)
        </span>
        <button
          onClick={() => setSuggestions(null)}
          className="text-xs text-[var(--text-tertiary)] underline hover:no-underline"
        >
          닫기
        </button>
      </div>

      {summary && (
        <p className="text-xs text-[var(--text-secondary)]">{summary}</p>
      )}

      <div className="flex flex-col gap-1.5">
        {suggestions.map((tag, idx) => {
          const isAccepted = accepted.has(idx);
          const isRejected = rejected.has(idx);
          const evalStyle = EVAL_LABELS[tag.evaluation];

          if (isAccepted) {
            return (
              <div key={idx} className="flex items-center gap-2 rounded border border-green-200 bg-green-50/50 px-2 py-1 text-xs dark:border-green-800 dark:bg-green-900/10">
                <span className="text-green-600 dark:text-green-400">수락됨</span>
                <span className="text-[var(--text-secondary)]">{getItemLabel(tag.competencyItem)}</span>
              </div>
            );
          }
          if (isRejected) return null;

          return (
            <div key={idx} className="flex flex-col gap-1 rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-tertiary)]">{getAreaLabel(tag.competencyItem)}</span>
                <span className="text-xs font-medium text-[var(--text-primary)]">{getItemLabel(tag.competencyItem)}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${evalStyle.className}`}>
                  {evalStyle.label}
                </span>
              </div>

              <p className="text-[11px] text-[var(--text-secondary)]">{tag.reasoning}</p>

              {tag.evidenceKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tag.evidenceKeywords.map((kw, ki) => (
                    <span key={ki} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] dark:bg-gray-700">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => handleAccept(idx, tag)}
                  disabled={isPending}
                  className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  수락
                </button>
                <button
                  onClick={() => handleReject(idx)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-[var(--text-tertiary)] transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  거절
                </button>
                <span className="text-[10px] text-[var(--text-tertiary)] italic">{tag.matchedRubricQuestion}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
