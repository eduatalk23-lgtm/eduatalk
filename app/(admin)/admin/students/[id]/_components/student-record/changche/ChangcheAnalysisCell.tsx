"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "../shared/AnalysisBlocks";
import { AnalysisBlock, COMPETENCY_LABELS, EVAL_COLORS } from "../shared/AnalysisBlocks";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";

export function ChangcheAnalysisCell({
  typeTags,
  record,
  activityType,
  studentId,
  tenantId,
  schoolYear,
  perspective,
}: {
  typeTags: AnalysisTagLike[];
  record: RecordChangche;
  activityType: ChangcheActivityType;
  studentId: string;
  tenantId: string;
  schoolYear: number;
  /** 관점별 단일 슬라이스. AI=AI 블록만, consultant=컨설턴트 블록만, null=레거시 3블록. */
  perspective?: LayerPerspective | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => typeTags.filter((t) => t.source === "ai"), [typeTags]);
  const manualTags = useMemo(() => typeTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [typeTags]);
  const confirmedTags = useMemo(() => typeTags.filter((t) => t.status === "confirmed"), [typeTags]);

  const content = useMemo(
    () => record.content?.trim() || record.imported_content || "",
    [record],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records: [{ id: record.id, content: record.content, imported_content: record.imported_content }],
    displayName: CHANGCHE_TYPE_LABELS[activityType],
    recordType: "changche" as const,
  }), [studentId, tenantId, schoolYear, record, activityType]);

  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId, student_id: studentId,
          record_type: t.record_type as "changche",
          record_id: t.record_id, competency_item: t.competency_item,
          evaluation: t.evaluation as "positive" | "negative" | "needs_review",
          evidence_summary: t.evidence_summary ?? null,
          source: "manual" as const, status: "suggested" as const,
        }));
      if (inputs.length > 0) {
        const res = await addActivityTagsBatchAction(inputs);
        if (!res.success) throw new Error("error" in res ? res.error : "복사 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const importConsultantMutation = useMutation({
    mutationFn: async () => {
      const { confirmActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of manualTags) {
        const res = await confirmActivityTagAction(t.id);
        if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tag: AnalysisTagLike) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const res = await deleteActivityTagAction(tag.id);
      if (!res.success) throw new Error("error" in res ? res.error : "삭제 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (tagsToDelete: AnalysisTagLike[]) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of tagsToDelete) { await deleteActivityTagAction(t.id); }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  return (
    <div className="flex flex-col gap-1.5">
      {/* 접힌 상태: 요약 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {typeTags.length > 0 ? typeTags.slice(0, 4).map((t, i) => (
            <Badge key={i} className={EVAL_COLORS[t.evaluation || "needs_review"]} size="xs">
              {COMPETENCY_LABELS[t.competency_item || ""] || t.competency_item}
            </Badge>
          )) : (
            <Empty label="태그 없음" />
          )}
          {typeTags.length > 4 && (
            <span className="text-xs text-[var(--text-tertiary)]">+{typeTags.length - 4}</span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {/* 펼친 상태: 관점 단일 슬라이스 (null일 때만 레거시 3블록) */}
      {expanded && perspective === "ai" && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={typeTags}
            content={content}
            mode={aiMode}
            setMode={setAiMode}
          />
        </div>
      )}
      {expanded && perspective === "consultant" && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="컨설턴트"
            tags={typeTags}
            content={content}
            mode={consultantMode}
            setMode={setConsultantMode}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${typeTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(typeTags); }}
          />
        </div>
      )}
      {expanded && !perspective && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content={content}
            mode={aiMode}
            setMode={setAiMode}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content={content}
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
            content={content}
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
