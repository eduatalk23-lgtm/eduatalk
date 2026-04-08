"use client";

// ============================================
// Phase 6.3 — AI 학년간 후속탐구 연결 감지 + 제안
// 전 학년 세특에서 탐구 주제 연결을 자동 감지하고
// 스토리라인 생성/연결을 제안
// 분석 결과는 pipeline task_results에 영속화
// ============================================

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { detectInquiryLinks } from "@/lib/domains/student-record/llm/actions/detectInquiryLinks";
import type { RecordSummary, InquiryConnection, SuggestedStoryline, InquiryLinkResult } from "@/lib/domains/student-record/llm/prompts/inquiryLinking";
import {
  saveStorylineAction,
  addStorylineLinkAction,
} from "@/lib/domains/student-record/actions/storyline";
import { syncPipelineTaskStatus, saveTaskResult } from "@/lib/domains/student-record/actions/pipeline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { Storyline } from "@/lib/domains/student-record";
import { Sparkles, Check, Link2, RotateCcw } from "lucide-react";

type RecordForLink = {
  id: string;
  grade?: number;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
};

type Props = {
  records: RecordForLink[];
  storylines: Storyline[];
  studentId: string;
  tenantId: string;
  /** 파이프라인에 저장된 이전 분석 결과 (있으면 자동 복원) */
  cachedResult?: InquiryLinkResult | null;
};

const LINK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sequential: { label: "순차 심화", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
  parallel: { label: "병렬 확장", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
  retrospective: { label: "회고적", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" },
};

export function InquiryLinkSuggestions({ records, storylines, studentId, tenantId, cachedResult }: Props) {
  const queryClient = useQueryClient();

  // 캐시된 결과를 초기값으로 복원
  const initialState = useMemo(() => {
    if (!cachedResult) return null;
    const { connections: cached, suggestedStorylines: cachedSl } = cachedResult;
    if (cached.length === 0 && cachedSl.length === 0) return null;

    const summaries: RecordSummary[] = records
      .filter((r) => r.content.trim().length >= 30 && r.grade != null)
      .map((r, i) => ({
        index: i,
        id: r.id,
        grade: r.grade!,
        subject: r.subjectName ?? r.label,
        type: r.type,
        content: r.content,
      }));

    const existingTitles = new Set(storylines.map((s) => s.title.replace("[AI] ", "")));
    const alreadyAccepted = new Set<number>();
    cachedSl.forEach((sl, i) => {
      if (existingTitles.has(sl.title)) alreadyAccepted.add(i);
    });

    return { connections: cached, suggested: cachedSl, recordMap: summaries, accepted: alreadyAccepted };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [connections, setConnections] = useState<InquiryConnection[]>(initialState?.connections ?? []);
  const [suggested, setSuggested] = useState<SuggestedStoryline[]>(initialState?.suggested ?? []);
  const [recordMap, setRecordMap] = useState<RecordSummary[]>(initialState?.recordMap ?? []);
  const [accepted, setAccepted] = useState<Set<number>>(initialState?.accepted ?? new Set());
  const [error, setError] = useState("");

  const detectMutation = useMutation({
    mutationFn: async () => {
      const summaries: RecordSummary[] = records
        .filter((r) => r.content.trim().length >= 30 && r.grade != null)
        .map((r, i) => ({
          index: i,
          id: r.id,
          grade: r.grade!,
          subject: r.subjectName ?? r.label,
          type: r.type,
          content: r.content,
        }));

      const result = await detectInquiryLinks(summaries);
      if (!result.success) throw new Error(result.error);
      return { data: result.data, summaries };
    },
    onSuccess: ({ data, summaries }) => {
      setConnections(data.connections);
      setSuggested(data.suggestedStorylines);
      setRecordMap(summaries);
      setAccepted(new Set());
      setError("");

      // 분석 결과를 파이프라인 DB에 영속화
      saveTaskResult(studentId, tenantId, "storyline_generation", data).catch(() => {});

      syncPipelineTaskStatus(studentId, "storyline_generation").then(() => {
        queryClient.invalidateQueries({ queryKey: studentRecordKeys.pipeline(studentId) });
      }).catch(() => {});
    },
    onError: (err: Error) => setError(err.message),
  });

  // 스토리라인 제안 수락: 새 스토리라인 생성 + 연결된 레코드 모두 링크
  const acceptMutation = useMutation({
    mutationFn: async (suggestion: SuggestedStoryline) => {
      // 1. 스토리라인 생성 (확장 필드 포함)
      const saveResult = await saveStorylineAction({
        student_id: studentId,
        tenant_id: tenantId,
        title: suggestion.title,
        keywords: suggestion.keywords,
        narrative: suggestion.narrative || null,
        career_field: suggestion.careerField || null,
        grade_1_theme: suggestion.grade1Theme || null,
        grade_2_theme: suggestion.grade2Theme || null,
        grade_3_theme: suggestion.grade3Theme || null,
        sort_order: storylines.length,
      });
      if (!saveResult.success || !saveResult.data?.id) throw new Error("스토리라인 생성 실패");
      const storylineId = saveResult.data.id;

      // 2. 연결된 레코드들 링크
      const linkedRecordIds = new Set<string>();
      for (const connIdx of suggestion.connectionIndices) {
        const conn = connections[connIdx];
        if (!conn) continue;
        for (const idx of [conn.fromIndex, conn.toIndex]) {
          const rec = recordMap[idx];
          if (!rec || linkedRecordIds.has(rec.id)) continue;
          linkedRecordIds.add(rec.id);
          const originalRecord = records.find((r) => r.id === rec.id);
          if (!originalRecord) continue;
          await addStorylineLinkAction({
            storyline_id: storylineId,
            tenant_id: tenantId,
            record_type: originalRecord.type,
            record_id: rec.id,
            grade: rec.grade ?? 1,
            connection_note: `[AI] ${conn.theme} (${LINK_TYPE_LABELS[conn.linkType]?.label ?? conn.linkType})`,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
    },
  });

  const hasResults = connections.length > 0;

  if (records.length < 2) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* 감지 버튼 */}
      {!hasResults && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => detectMutation.mutate()}
            disabled={detectMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
          >
            <Link2 size={14} />
            {detectMutation.isPending ? "분석 중..." : "AI 탐구 연결 감지"}
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            전 학년 {records.length}건 기록에서 탐구 주제 연결을 감지합니다
          </span>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}

      {/* 감지 결과 */}
      {hasResults && (
        <div className="rounded-lg border border-blue-200 p-4 dark:border-blue-800">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              <Sparkles size={14} className="mr-1 inline" />
              탐구 연결 {connections.length}건 감지
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => detectMutation.mutate()}
                disabled={detectMutation.isPending}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                title="다시 분석"
              >
                <RotateCcw size={12} className={detectMutation.isPending ? "animate-spin" : ""} />
                재분석
              </button>
              <button
                onClick={() => { setConnections([]); setSuggested([]); }}
                className="text-xs text-[var(--text-tertiary)] underline"
              >
                닫기
              </button>
            </div>
          </div>

          {/* 연결 목록 */}
          <div className="flex flex-col gap-2">
            {connections.map((conn, i) => {
              const from = recordMap[conn.fromIndex];
              const to = recordMap[conn.toIndex];
              if (!from || !to) return null;
              const typeStyle = LINK_TYPE_LABELS[conn.linkType] ?? LINK_TYPE_LABELS.sequential;

              return (
                <div key={i} className="rounded-md border border-gray-100 bg-white/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", typeStyle.color)}>
                      {typeStyle.label}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{conn.theme}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                    <span>{from.grade}학년 {from.subject}</span>
                    <span className="text-[var(--text-tertiary)]">→</span>
                    <span>{to.grade}학년 {to.subject}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{conn.reasoning}</p>
                </div>
              );
            })}
          </div>

          {/* 스토리라인 제안 */}
          {suggested.length > 0 && (
            <div className="mt-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">스토리라인 제안</span>
              <div className="mt-2 flex flex-col gap-2">
                {suggested.map((s, i) => {
                  const isAccepted = accepted.has(i);
                  return (
                    <div key={i} className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{s.title}</span>
                          {s.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {s.keywords.map((kw) => (
                                <span key={kw} className="rounded bg-gray-100 px-1 py-0.5 text-[9px] text-[var(--text-tertiary)] dark:bg-gray-800">{kw}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            acceptMutation.mutate(s);
                            setAccepted((prev) => new Set(prev).add(i));
                          }}
                          disabled={isAccepted || acceptMutation.isPending}
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition",
                            isAccepted
                              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400",
                          )}
                        >
                          {isAccepted ? <><Check size={12} /> 생성됨</> : "스토리라인 생성"}
                        </button>
                      </div>
                      {/* 서사 미리보기 */}
                      {s.narrative && (
                        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                          {s.narrative}
                        </p>
                      )}
                      {/* 학년별 테마 미리보기 */}
                      {(s.grade1Theme || s.grade2Theme || s.grade3Theme) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-[var(--text-tertiary)]">
                          {s.grade1Theme && <span>1학년: {s.grade1Theme}</span>}
                          {s.grade2Theme && <span>2학년: {s.grade2Theme}</span>}
                          {s.grade3Theme && <span>3학년: {s.grade3Theme}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {acceptMutation.isError && (
                <p className="mt-1 text-xs text-red-500">{acceptMutation.error.message}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
