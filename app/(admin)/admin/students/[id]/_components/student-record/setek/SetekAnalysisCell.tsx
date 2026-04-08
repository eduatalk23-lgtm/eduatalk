"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnalysisBlock, EVAL_COLORS, COMPETENCY_LABELS } from "../shared/AnalysisBlocks";
import type { AnalysisBlockMode, TaggerProps } from "../shared/AnalysisBlocks";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { AnalysisTagLike } from "../shared/AnalysisBlocks";
import type { MergedSetekRow } from "../stages/record/SetekEditor";
import type { SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";

type ActivityTagLike = AnalysisTagLike;

export function AnalysisExpandableCell({
  subjectTags,
  subjectReflection,
  row,
  studentId,
  tenantId,
  schoolYear,
}: {
  subjectTags: ActivityTagLike[];
  subjectReflection?: SubjectReflectionRate;
  row: MergedSetekRow;
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => subjectTags.filter((t) => t.source === "ai"), [subjectTags]);
  const manualTags = useMemo(() => subjectTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [subjectTags]);
  const confirmedTags = useMemo(() => subjectTags.filter((t) => t.status === "confirmed"), [subjectTags]);

  const combinedContent = useMemo(
    () => row.records.map((r) => r.content?.trim() || r.imported_content || "").filter(Boolean).join("\n\n"),
    [row.records],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records: row.records,
    displayName: row.displayName,
    recordType: "setek" as const,
  }), [studentId, tenantId, schoolYear, row]);

  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  const [tagError, setTagError] = useState<string | null>(null);
  const onTagError = useCallback((err: Error) => setTagError(err.message), []);
  const clearTagError = useCallback(() => setTagError(null), []);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: t.record_type as "setek",
          record_id: t.record_id,
          competency_item: t.competency_item,
          evaluation: t.evaluation as "positive" | "negative" | "needs_review",
          evidence_summary: t.evidence_summary ?? null,
          source: "manual" as const,
          status: "suggested" as const,
        }));
      if (inputs.length > 0) {
        const res = await addActivityTagsBatchAction(inputs);
        if (!res.success) throw new Error("error" in res ? res.error : "복사 실패");
      }
    },
    onSuccess: async () => { clearTagError(); await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
    onError: onTagError,
  });

  const importConsultantMutation = useMutation({
    mutationFn: async () => {
      const { confirmActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of manualTags) {
        const res = await confirmActivityTagAction(t.id);
        if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
      }
    },
    onSuccess: async () => { clearTagError(); await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
    onError: onTagError,
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tag: ActivityTagLike) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const res = await deleteActivityTagAction(tag.id);
      if (!res.success) throw new Error("error" in res ? res.error : "삭제 실패");
    },
    onSuccess: async () => { clearTagError(); await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
    onError: onTagError,
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (tagsToDelete: ActivityTagLike[]) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of tagsToDelete) {
        await deleteActivityTagAction(t.id);
      }
    },
    onSuccess: async () => { clearTagError(); await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
    onError: onTagError,
  });

  return (
    <div className="flex flex-col gap-1.5">
      {tagError && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {tagError}
          <button type="button" className="ml-2 underline" onClick={clearTagError}>닫기</button>
        </p>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {subjectReflection && (
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
              subjectReflection.rate >= 70 ? "bg-emerald-50 text-emerald-600" : subjectReflection.rate >= 40 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600",
            )}>
              반영 {subjectReflection.rate}%
            </span>
          )}
          {subjectTags.length > 0 ? subjectTags.slice(0, 4).map((t, i) => (
            <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
              EVAL_COLORS[t.evaluation || "needs_review"],
            )}>
              {COMPETENCY_LABELS[t.competency_item || ""] || t.competency_item}
            </span>
          )) : (
            <span className="text-sm text-[var(--text-placeholder)]">태그 없음</span>
          )}
          {subjectTags.length > 4 && (
            <span className="text-xs text-[var(--text-tertiary)]">+{subjectTags.length - 4}</span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content={combinedContent}
            mode={aiMode}
            setMode={setAiMode}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content={combinedContent}
            mode={consultantMode}
            setMode={setConsultantMode}
            importAction={aiTags.length > 0 ? () => importAiMutation.mutate() : undefined}
            importLabel="AI 가져오기"
            isImporting={importAiMutation.isPending}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${manualTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(manualTags); }}
          />
          <AnalysisBlock
            label="확정"
            tags={confirmedTags}
            content={combinedContent}
            mode={confirmedMode}
            setMode={setConfirmedMode}
            importAction={manualTags.length > 0 ? () => importConsultantMutation.mutate() : undefined}
            importLabel="컨설턴트 가져오기"
            isImporting={importConsultantMutation.isPending}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`확정 태그 ${confirmedTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(confirmedTags); }}
          />
        </div>
      )}
    </div>
  );
}
