"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReadingAction, removeReadingAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordReading } from "@/lib/domains/student-record";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, MessageSquare, StickyNote, ChevronDown } from "lucide-react";
import { InlineAreaMemos } from "../../InlineAreaMemos";
import type { AnalysisTagLike, AnalysisBlockMode } from "../../shared/AnalysisBlocks";
import { AnalysisBlock, COMPETENCY_LABELS, EVAL_COLORS } from "../../shared/AnalysisBlocks";

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type ReadingLayerTab = "chat" | "neis" | "analysis" | "memo";

const READING_TABS: { key: ReadingLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "chat", label: "논의", icon: MessageSquare },
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "memo", label: "메모", icon: StickyNote },
];

// ─── 타입 ──────────────────────────────────────

type ReadingEditorProps = {
  readings: RecordReading[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: AnalysisTagLike[];
};

export function ReadingEditor({
  readings,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
}: ReadingEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<ReadingLayerTab>("neis");
  const queryClient = useQueryClient();

  // 역량 태그 필터: reading record_type만
  const allReadingIds = useMemo(() => new Set(readings.map((r) => r.id)), [readings]);
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "reading" && allReadingIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allReadingIds]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeReadingAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`"${title}" 독서 기록을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {READING_TABS.map((tab) => {
          const hasData = tab.key === "neis" ? readings.length > 0
            : tab.key === "analysis" ? filteredTags.length > 0
            : false;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
              title={tab.label}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {hasData && tab.key !== "neis" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 통합 테이블 (모든 탭에서 유지 — 세특과 동일 패턴) ─── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-28 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>도서명</th>
              {activeTab === "neis" && (
                <>
                  <th className={`${B} w-20 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>저자</th>
                  <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>과목 또는 영역</th>
                </>
              )}
              {(activeTab === "analysis" || activeTab === "memo" || activeTab === "chat") && (
                <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
                  {activeTab === "analysis" ? "역량 분석" : activeTab === "memo" ? "메모" : "논의"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 && !showAddForm && (
              <tr>
                <td colSpan={activeTab === "neis" ? 3 : 2} className={`${B} px-4 py-2 text-center text-sm text-[var(--text-tertiary)]`}>
                  등록된 독서 기록이 없습니다.
                </td>
              </tr>
            )}
            {readings.map((reading) => {
              const bookTags = filteredTags.filter((t) => t.record_id === reading.id);
              return (
                <tr key={reading.id} className="group align-top">
                  <td className={`${B} px-2 py-1.5 text-sm text-[var(--text-primary)]`}>
                    {reading.book_title}
                  </td>
                  {activeTab === "neis" && (
                    <>
                      <td className={`${B} px-2 py-1.5 text-sm text-[var(--text-secondary)]`}>{reading.author ?? "-"}</td>
                      <td className={`${B} relative px-2 py-1.5 text-sm text-[var(--text-secondary)]`}>
                        {reading.subject_area}
                        <button
                          onClick={() => handleDelete(reading.id, reading.book_title)}
                          disabled={deleteMutation.isPending}
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 disabled:opacity-50 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                        >
                          삭제
                        </button>
                      </td>
                    </>
                  )}
                  {activeTab === "analysis" && (
                    <td className={`${B} p-2`}>
                      <ReadingAnalysisCell bookTags={bookTags} reading={reading} studentId={studentId} tenantId={tenantId} />
                    </td>
                  )}
                  {activeTab === "memo" && (
                    <td className={`${B} p-1`}>
                      <InlineAreaMemos studentId={studentId} areaType="reading" areaId={reading.id} areaLabel={reading.book_title} />
                    </td>
                  )}
                  {activeTab === "chat" && (
                    <td className={`${B} p-1`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (setActiveSubjectId) { setActiveSubjectId("reading"); }
                          sidePanel.openApp("chat");
                        }}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        채팅 열기
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 추가 폼 (NEIS 탭에서만) */}
      {activeTab === "neis" && (
        showAddForm ? (
          <AddReadingForm studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} onClose={() => setShowAddForm(false)} />
        ) : (
          <button onClick={() => setShowAddForm(true)} className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
            + 독서 추가
          </button>
        )
      )}
    </div>
  );
}

// ─── 🔍분석 탭: 독서별 접기/펼치기 + AnalysisBlock 3블록 (Tagger 없음) ──

function ReadingAnalysisCell({
  bookTags,
  reading,
  studentId,
  tenantId,
}: {
  bookTags: AnalysisTagLike[];
  reading: RecordReading;
  studentId: string;
  tenantId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("competency");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("competency");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => bookTags.filter((t) => t.source === "ai"), [bookTags]);
  const manualTags = useMemo(() => bookTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [bookTags]);
  const confirmedTags = useMemo(() => bookTags.filter((t) => t.status === "confirmed"), [bookTags]);

  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId, student_id: studentId,
          record_type: t.record_type as "reading",
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
      {/* 접기/펼치기 요약 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {bookTags.length > 0 ? bookTags.slice(0, 3).map((t, i) => (
            <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
              EVAL_COLORS[t.evaluation || "needs_review"],
            )}>
              {COMPETENCY_LABELS[t.competency_item || ""] || t.competency_item}
            </span>
          )) : (
            <span className="text-sm text-[var(--text-placeholder)]">태그 없음</span>
          )}
          {bookTags.length > 3 && (
            <span className="text-xs text-[var(--text-tertiary)]">+{bookTags.length - 3}</span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {/* 펼친 상태: 3개 독립 블록 */}
      {expanded && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content=""
            mode={aiMode}
            setMode={setAiMode}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content=""
            mode={consultantMode}
            setMode={setConsultantMode}
            importAction={aiTags.length > 0 ? () => importAiMutation.mutate() : undefined}
            importLabel="AI 가져오기"
            isImporting={importAiMutation.isPending}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${manualTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(manualTags); }}
          />
          <AnalysisBlock
            label="확정"
            tags={confirmedTags}
            content=""
            mode={confirmedMode}
            setMode={setConfirmedMode}
            importAction={manualTags.length > 0 ? () => importConsultantMutation.mutate() : undefined}
            importLabel="컨설턴트 가져오기"
            isImporting={importConsultantMutation.isPending}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`확정 태그 ${confirmedTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(confirmedTags); }}
          />
        </div>
      )}
    </div>
  );
}

function AddReadingForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  onClose: () => void;
}) {
  const [bookTitle, setBookTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookTitle.trim()) throw new Error("제목을 입력해주세요.");
      if (!subjectArea.trim()) throw new Error("관련 과목을 입력해주세요.");
      const result = await addReadingAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        book_title: bookTitle.trim(),
        author: author.trim() || null,
        subject_area: subjectArea.trim(),
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">독서 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="도서명 *"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="저자"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          />
          <input
            value={subjectArea}
            onChange={(e) => setSubjectArea(e.target.value)}
            placeholder="관련 과목 *"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
