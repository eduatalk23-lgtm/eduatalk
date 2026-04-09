"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnalysisBlock, resolveAnalysisContent } from "../shared/AnalysisBlocks";
import type { AnalysisBlockMode, TaggerProps, AnalysisRecordTab } from "../shared/AnalysisBlocks";
import { cn } from "@/lib/cn";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { AnalysisTagLike } from "../shared/AnalysisBlocks";
import type { MergedSetekRow } from "../stages/record/SetekEditor";
import type { SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";

type ActivityTagLike = AnalysisTagLike;

export function AnalysisExpandableCell({
  subjectTags,
  subjectReflection,
  row,
  studentId,
  tenantId,
  schoolYear,
  perspective,
  recordTab = "analysis",
}: {
  subjectTags: ActivityTagLike[];
  subjectReflection?: SubjectReflectionRate;
  row: MergedSetekRow;
  studentId: string;
  tenantId: string;
  schoolYear: number;
  /** 관점별 단일 슬라이스. AI=AI 블록만, consultant=컨설턴트 블록만, null=레거시 3블록. */
  perspective?: LayerPerspective | null;
  /**
   * 분석/가안 분석 탭 구분. 원문 하이라이트용 콘텐츠 소스를 결정한다.
   * - "analysis": imported_content(NEIS)
   * - "draft_analysis": confirmed_content → content → ai_draft_content
   */
  recordTab?: AnalysisRecordTab;
}) {
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => subjectTags.filter((t) => t.source === "ai"), [subjectTags]);
  const manualTags = useMemo(() => subjectTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [subjectTags]);
  const confirmedTags = useMemo(() => subjectTags.filter((t) => t.status === "confirmed"), [subjectTags]);

  // 분석 탭은 NEIS(imported_content)만, 가안 분석 탭은 confirmed→content→ai_draft 우선순위로 해소.
  // 파이프라인(P1 analysis / P8 draft_analysis)이 분석한 원본과 정확히 일치시켜야
  // 태그 highlight 텍스트가 원문에서 매칭되어 하이라이트가 그려진다.
  const combinedContent = useMemo(
    () =>
      row.records
        .map((r) => resolveAnalysisContent(r, recordTab))
        .filter(Boolean)
        .join("\n\n"),
    [row.records, recordTab],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    // TaggerRecord의 4-layer 필드를 모두 넘겨야 AnalysisBlock 태깅 모드의 리졸버가 가안 분석 탭에서도 동작한다.
    records: row.records.map((r) => ({
      id: r.id,
      content: r.content,
      imported_content: r.imported_content,
      confirmed_content: r.confirmed_content,
      ai_draft_content: r.ai_draft_content,
      semester: r.semester,
    })),
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
      {subjectReflection && (
        <div>
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium",
            subjectReflection.rate >= 70 ? "bg-emerald-50 text-emerald-600" : subjectReflection.rate >= 40 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600",
          )}>
            반영 {subjectReflection.rate}%
          </span>
        </div>
      )}

      {perspective === "ai" && (
        <div className="flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={subjectTags}
            content={combinedContent}
            mode={aiMode}
            setMode={setAiMode}
            recordTab={recordTab}
          />
        </div>
      )}
      {perspective === "consultant" && (
        <div className="flex flex-col gap-3">
          <AnalysisBlock
            label="컨설턴트"
            tags={subjectTags}
            content={combinedContent}
            mode={consultantMode}
            setMode={setConsultantMode}
            recordTab={recordTab}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${subjectTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(subjectTags); }}
          />
        </div>
      )}
      {!perspective && (
        <div className="flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content={combinedContent}
            mode={aiMode}
            setMode={setAiMode}
            recordTab={recordTab}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content={combinedContent}
            mode={consultantMode}
            setMode={setConsultantMode}
            recordTab={recordTab}
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
            recordTab={recordTab}
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
