"use client";

// ============================================
// 창체 컨텍스트 그리드 — 셀 렌더러 모음
// ChangcheGridCell, ChangcheDraftGridCell, ChangcheAnalysisGridCell, ChangcheChatCell
// ============================================

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { cn } from "@/lib/cn";
import { BookOpen, Compass } from "lucide-react";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche } from "@/lib/domains/student-record";
import type { GridColumnKey } from "../ContextGridBottomSheet";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "../shared/AnalysisBlocks";
import { AnalysisBlock } from "../shared/AnalysisBlocks";
import { DraftBlock, DRAFT_BLOCK_STYLES } from "../shared/DraftBlocks";
import { InlineAreaMemos } from "../InlineAreaMemos";
import type { Perspective } from "./grid-constants";

const InlineTopicChat = dynamic(
  () =>
    import("@/app/(admin)/admin/students/[id]/plans/_components/side-panel/apps/chat/ChatPanelApp").then(
      (m) => ({ default: m.ChatPanelApp }),
    ),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-8 text-sm text-[var(--text-tertiary)]">채팅 로딩 중...</div> },
);
const GuideRecommendationPanel = dynamic(
  () =>
    import("../GuideRecommendationPanel").then((m) => ({ default: m.GuideRecommendationPanel })),
  { ssr: false },
);
const DirectionFromChatPanel = dynamic(
  () =>
    import("../DirectionFromChatPanel").then((m) => ({ default: m.DirectionFromChatPanel })),
  { ssr: false },
);

type GuideAssignmentLike = {
  id: string;
  status: string;
  target_subject_id?: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
};

export interface ChangcheGuideItemLike {
  activityType: string;
  activityLabel: string;
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
  guideMode?: "retrospective" | "prospective";
}

// ─── ChangcheGridCell ──

export function ChangcheGridCell({
  column,
  perspective,
  record,
  activityType,
  activityLabel,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  tags,
  guideAssignments,
  designGuideItem,
  improveGuideItem,
  isDesignMode,
}: {
  column: GridColumnKey;
  perspective: Perspective;
  record: RecordChangche | null;
  activityType: string;
  activityLabel: string;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  tags: AnalysisTagLike[];
  guideAssignments: GuideAssignmentLike[];
  designGuideItem?: ChangcheGuideItemLike;
  improveGuideItem?: ChangcheGuideItemLike;
  isDesignMode?: boolean;
}) {
  // ── 논의 (rowSpan=3) ──
  if (column === "chat") {
    return (
      <ChangcheChatCell
        activityType={activityType}
        activityLabel={activityLabel}
      />
    );
  }

  // ── NEIS (rowSpan=3) ──
  if (column === "neis") {
    const content = record?.content?.trim() || record?.imported_content || "";
    return (
      <div className="flex flex-col gap-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
          {content || <span className="text-[var(--text-placeholder)]">없음</span>}
        </p>
        {content && charLimit > 0 && (
          <p className="text-xs text-[var(--text-tertiary)]">{content.length}자 / {charLimit}자</p>
        )}
      </div>
    );
  }

  // ── 메모 (rowSpan=3) ──
  if (column === "memo") {
    return (
      <InlineAreaMemos
        studentId={studentId}
        areaType="changche"
        areaId={activityType}
        areaLabel={activityLabel}
      />
    );
  }

  // ── 설계방향 (3행 분리) ──
  if (column === "design_direction") {
    if (perspective === "ai") {
      if (!designGuideItem) {
        return <span className="text-sm text-[var(--text-placeholder)]">설계방향 없음</span>;
      }
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-[var(--text-primary)]">{designGuideItem.direction}</p>
          {designGuideItem.keywords.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {designGuideItem.keywords.slice(0, 5).map((kw) => (
                <span key={kw} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">{kw}</span>
              ))}
            </div>
          )}
          {designGuideItem.competencyFocus && designGuideItem.competencyFocus.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {designGuideItem.competencyFocus.map((c) => (
                <span key={c} className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">{c}</span>
              ))}
            </div>
          )}
          {designGuideItem.cautions && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{designGuideItem.cautions}</p>
          )}
        </div>
      );
    }
    return (
      <span className="text-sm text-[var(--text-placeholder)]">
        {perspective === "consultant" ? "컨설턴트 설계방향 — 준비 중" : "확정 설계방향 — 준비 중"}
      </span>
    );
  }

  // ── 보완방향 (3행 분리) ──
  if (column === "improve_direction") {
    if (perspective === "ai") {
      if (!improveGuideItem) {
        return <span className="text-sm text-[var(--text-placeholder)]">보완방향 없음</span>;
      }
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-[var(--text-primary)]">{improveGuideItem.direction}</p>
          {improveGuideItem.keywords.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {improveGuideItem.keywords.slice(0, 5).map((kw) => (
                <span key={kw} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{kw}</span>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <span className="text-sm text-[var(--text-placeholder)]">
        {perspective === "consultant" ? "컨설턴트 보완방향 — 준비 중" : "확정 보완방향 — 준비 중"}
      </span>
    );
  }

  // ── 가이드 (3행 분리) ──
  if (column === "guide") {
    if (perspective === "ai") {
      const aiRecommended = guideAssignments.filter((g) => g.ai_recommendation_reason);
      if (aiRecommended.length > 0) {
        return (
          <div className="flex flex-col gap-1">
            {aiRecommended.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <span className="h-3 w-3 shrink-0 text-violet-500">🤖</span>
                <span className="truncate text-sm text-[var(--text-primary)]">{g.exploration_guides?.title ?? "가이드"}</span>
              </div>
            ))}
          </div>
        );
      }
      return <span className="text-sm text-[var(--text-placeholder)]">AI 추천 가이드 없음</span>;
    }
    if (perspective === "consultant") {
      const assigned = guideAssignments.filter((g) => g.status !== "completed");
      if (assigned.length === 0) {
        return <span className="text-sm text-[var(--text-placeholder)]">배정된 가이드 없음</span>;
      }
      return (
        <div className="flex flex-col gap-1">
          {assigned.map((g) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", g.status === "in_progress" ? "bg-amber-500" : "bg-gray-300")} />
              <span className="truncate text-sm text-[var(--text-primary)]">{g.exploration_guides?.title ?? "가이드"}</span>
              <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{g.status === "in_progress" ? "진행" : "배정"}</span>
            </div>
          ))}
        </div>
      );
    }
    const completed = guideAssignments.filter((g) => g.status === "completed");
    if (completed.length === 0) {
      return <span className="text-sm text-[var(--text-placeholder)]">확정 없음</span>;
    }
    return (
      <div className="flex flex-col gap-1">
        {completed.map((g) => (
          <div key={g.id} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
            <span className="truncate text-sm text-[var(--text-primary)]">{g.exploration_guides?.title ?? "가이드"}</span>
            <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">완료</span>
          </div>
        ))}
      </div>
    );
  }

  // ── 가안 (3행 분리) ──
  if (column === "draft") {
    if (isDesignMode && perspective === "ai" && !record?.ai_draft_content?.trim()) {
      return (
        <div className="flex h-full items-center justify-center">
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            설계 모드 — P7 파이프라인 실행 또는 직접 작성
          </span>
        </div>
      );
    }
    return (
      <ChangcheDraftGridCell
        perspective={perspective}
        record={record}
        activityType={activityType}
        charLimit={charLimit}
        studentId={studentId}
        schoolYear={schoolYear}
        tenantId={tenantId}
        grade={grade}
      />
    );
  }

  // ── 가안분석 (설계 모드 전용 — 3행 분리) ──
  if (column === "draft_analysis") {
    const draftTags = tags.filter((t) => t.tag_context === "draft_analysis");
    const draftContent = record?.ai_draft_content?.trim() || "";

    if (perspective === "ai") {
      const aiDraftTags = draftTags.filter((t) => t.source === "ai");
      if (aiDraftTags.length === 0) {
        return (
          <div className="flex h-full items-center justify-center">
            <span className="rounded bg-gray-50 px-2 py-1 text-xs text-[var(--text-tertiary)] dark:bg-gray-800">
              가안분석 태그 없음
            </span>
          </div>
        );
      }
      return <AnalysisBlock label="AI 가안분석" tags={aiDraftTags} content={draftContent} mode="competency" setMode={() => {}} />;
    }
    if (perspective === "consultant") {
      const manualDraftTags = draftTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed");
      return <AnalysisBlock label="컨설턴트" tags={manualDraftTags} content={draftContent} mode="tagging" setMode={() => {}} />;
    }
    const confirmedDraftTags = draftTags.filter((t) => t.status === "confirmed");
    return <AnalysisBlock label="확정" tags={confirmedDraftTags} content={draftContent} mode="tagging" setMode={() => {}} />;
  }

  // ── 분석 (3행 분리) ──
  if (column === "analysis") {
    if (isDesignMode && perspective === "ai") {
      return (
        <div className="flex h-full items-center justify-center">
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            설계 모드 — 컨설턴트가 수동으로 태그를 추가하세요
          </span>
        </div>
      );
    }
    return (
      <ChangcheAnalysisGridCell
        perspective={perspective}
        record={record}
        tags={tags}
        studentId={studentId}
        tenantId={tenantId}
        schoolYear={schoolYear}
      />
    );
  }

  return null;
}

// ─── ChangcheDraftGridCell ──

export function ChangcheDraftGridCell({
  perspective,
  record,
  activityType,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  perspective: Perspective;
  record: RecordChangche | null;
  activityType: string;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  const queryClient = useQueryClient();
  const recordQk = ["studentRecord", "recordTab", studentId] as const;

  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      if (!record?.ai_draft_content) return;
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await acceptAiDraftAction(record.id, "changche");
      if (!res.success) {
        if ("error" in res && res.error === "CONTENT_EXISTS") {
          if (!confirm("기존 가안이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
          const forced = await acceptAiDraftAction(record.id, "changche", true);
          if (!forced.success) throw new Error("error" in forced ? forced.error : "수용 실패");
        } else {
          throw new Error("error" in res ? res.error : "수용 실패");
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!record?.content?.trim()) return;
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await confirmDraftAction(record.id, "changche");
      if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSave = useCallback(async (content: string) => {
    if (!record) return;
    const { saveChangcheAction } = await import("@/lib/domains/student-record/actions/record");
    await saveChangcheAction(
      {
        id: record.id,
        student_id: studentId,
        tenant_id: tenantId,
        grade,
        activity_type: activityType as "autonomy" | "club" | "career",
        content,
        char_limit: charLimit,
      },
      schoolYear,
    );
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [record, studentId, tenantId, grade, activityType, charLimit, schoolYear, queryClient, recordQk]);

  if (!record) {
    return <span className="text-sm text-[var(--text-placeholder)]">기록 없음</span>;
  }

  if (perspective === "ai") {
    return (
      <DraftBlock
        label="AI 초안"
        style={DRAFT_BLOCK_STYLES.ai}
        content={record.ai_draft_content}
      />
    );
  }

  if (perspective === "consultant") {
    return (
      <DraftBlock
        label="컨설턴트 가안"
        style={DRAFT_BLOCK_STYLES.consultant}
        content={record.content}
        editable
        onSave={handleSave}
        charLimit={charLimit}
        importAction={record.ai_draft_content && !record.content?.trim() ? () => acceptAiMutation.mutate() : undefined}
        importLabel="AI 초안 수용"
        isImporting={acceptAiMutation.isPending}
      />
    );
  }

  // confirmed
  return (
    <DraftBlock
      label="확정본"
      style={DRAFT_BLOCK_STYLES.confirmed}
      content={record.confirmed_content}
      importAction={record.content?.trim() ? () => confirmMutation.mutate() : undefined}
      importLabel="가안 확정"
      isImporting={confirmMutation.isPending}
      staleWarning={
        record.confirmed_content?.trim() && record.content?.trim() && record.content !== record.confirmed_content
          ? "가안과 다름"
          : undefined
      }
    />
  );
}

// ─── ChangcheAnalysisGridCell ──

export function ChangcheAnalysisGridCell({
  perspective,
  record,
  tags,
  studentId,
  tenantId,
  schoolYear,
}: {
  perspective: Perspective;
  record: RecordChangche | null;
  tags: AnalysisTagLike[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const queryClient = useQueryClient();
  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  const analysisTags = useMemo(() => tags.filter((t) => t.tag_context !== "draft_analysis"), [tags]);
  const aiTags = useMemo(() => analysisTags.filter((t) => t.source === "ai"), [analysisTags]);
  const manualTags = useMemo(() => analysisTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [analysisTags]);
  const confirmedTags = useMemo(() => analysisTags.filter((t) => t.status === "confirmed"), [analysisTags]);

  const combinedContent = record?.content?.trim() || record?.imported_content || "";

  const taggerProps: TaggerProps | undefined = useMemo(() => {
    if (!record) return undefined;
    return {
      studentId, tenantId, schoolYear,
      records: [record],
      displayName: (CHANGCHE_TYPE_LABELS as Record<string, string>)[record.activity_type] ?? record.activity_type,
      recordType: "changche" as const,
    };
  }, [studentId, tenantId, schoolYear, record]);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: t.record_type as "changche",
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
      for (const t of tagsToDelete) {
        await deleteActivityTagAction(t.id);
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const [mode, setMode] = useState<AnalysisBlockMode>(
    perspective === "ai" ? "competency" : "tagging",
  );

  if (perspective === "ai") {
    return (
      <AnalysisBlock
        label="AI"
        tags={aiTags}
        content={combinedContent}
        mode={mode}
        setMode={setMode}
      />
    );
  }

  if (perspective === "consultant") {
    return (
      <AnalysisBlock
        label="컨설턴트"
        tags={manualTags}
        content={combinedContent}
        mode={mode}
        setMode={setMode}
        importAction={aiTags.length > 0 ? () => importAiMutation.mutate() : undefined}
        importLabel="AI 가져오기"
        isImporting={importAiMutation.isPending}
        taggerProps={taggerProps}
        onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
        onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${manualTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(manualTags); }}
      />
    );
  }

  return (
    <AnalysisBlock
      label="확정"
      tags={confirmedTags}
      content={combinedContent}
      mode={mode}
      setMode={setMode}
      importAction={manualTags.length > 0 ? () => importConsultantMutation.mutate() : undefined}
      importLabel="컨설턴트 가져오기"
      isImporting={importConsultantMutation.isPending}
      taggerProps={taggerProps}
      onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
      onDeleteAll={() => { if (confirm(`확정 태그 ${confirmedTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(confirmedTags); }}
    />
  );
}

// ── ChangcheChatCell ──

export function ChangcheChatCell({
  activityType,
  activityLabel,
}: {
  activityType: string;
  activityLabel: string;
}) {
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  const [showDirectionPanel, setShowDirectionPanel] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const areaId = `changche:${activityType}`;

  return (
    <div className="flex h-full min-h-[300px] flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => { setShowDirectionPanel((v) => !v); if (!showDirectionPanel) setShowGuidePanel(false); }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            showDirectionPanel
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              : "text-[var(--text-tertiary)] hover:bg-gray-100 dark:hover:bg-gray-800",
          )}
        >
          <Compass className="h-3 w-3" />
          방향 설정
        </button>
        <button
          type="button"
          onClick={() => { setShowGuidePanel((v) => !v); if (!showGuidePanel) setShowDirectionPanel(false); }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            showGuidePanel
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              : "text-[var(--text-tertiary)] hover:bg-gray-100 dark:hover:bg-gray-800",
          )}
        >
          <BookOpen className="h-3 w-3" />
          가이드 추천
        </button>
      </div>

      {showDirectionPanel && (
        <DirectionFromChatPanel
          subjectId={areaId}
          subjectName={activityLabel}
          onClose={() => setShowDirectionPanel(false)}
        />
      )}

      {showGuidePanel && activeRoomId && (
        <GuideRecommendationPanel
          roomId={activeRoomId}
          subjectId={areaId}
          subjectName={activityLabel}
          onClose={() => setShowGuidePanel(false)}
        />
      )}

      <div className="min-h-0 flex-1">
        <InlineTopicChat
          recordTopic={areaId}
          autoEnter
          subjectName={activityLabel}
          onRoomEnter={setActiveRoomId}
        />
      </div>
    </div>
  );
}
