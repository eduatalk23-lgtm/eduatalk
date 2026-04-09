"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps, AnalysisRecordTab } from "../shared/AnalysisBlocks";
import { AnalysisBlock, resolveAnalysisContent } from "../shared/AnalysisBlocks";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";

export function ChangcheAnalysisCell({
  typeTags,
  record,
  activityType,
  studentId,
  tenantId,
  schoolYear,
  perspective,
  recordTab = "analysis",
}: {
  typeTags: AnalysisTagLike[];
  record: RecordChangche;
  activityType: ChangcheActivityType;
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

  const aiTags = useMemo(() => typeTags.filter((t) => t.source === "ai"), [typeTags]);
  const manualTags = useMemo(() => typeTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [typeTags]);
  const confirmedTags = useMemo(() => typeTags.filter((t) => t.status === "confirmed"), [typeTags]);

  // 분석/가안 분석 탭별로 콘텐츠 원본을 분리. 파이프라인이 분석한 원본과 일치시켜야 highlight 매칭이 성립.
  const content = useMemo(
    () => resolveAnalysisContent(record, recordTab),
    [record, recordTab],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records: [{
      id: record.id,
      content: record.content,
      imported_content: record.imported_content,
      confirmed_content: record.confirmed_content,
      ai_draft_content: record.ai_draft_content,
    }],
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
      {/* 관점 단일 슬라이스 (null일 때만 레거시 3블록) */}
      {perspective === "ai" && (
        <div className="flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={typeTags}
            content={content}
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
            tags={typeTags}
            content={content}
            mode={consultantMode}
            setMode={setConsultantMode}
            recordTab={recordTab}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${typeTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(typeTags); }}
          />
        </div>
      )}
      {!perspective && (
        <div className="flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content={content}
            mode={aiMode}
            setMode={setAiMode}
            recordTab={recordTab}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content={content}
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
            content={content}
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
