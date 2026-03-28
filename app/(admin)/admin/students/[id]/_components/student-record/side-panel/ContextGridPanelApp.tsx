"use client";

// ============================================
// 컨텍스트 그리드 사이드 패널 앱
// 선택한 과목의 모든 레이어를 세로 스택으로 표시
// 기존 shared 컴포넌트(AnalysisBlock, MultiRecordDraftBlock 등) 재사용
// ============================================

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { ChevronDown, BookOpen, Compass, PenLine, FileText, Search, StickyNote } from "lucide-react";
import { recordTabQueryOptions, diagnosisTabQueryOptions } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "../shared/AnalysisBlocks";
import { AnalysisBlock } from "../shared/AnalysisBlocks";
import { MultiRecordDraftBlock, DRAFT_BLOCK_STYLES } from "../shared/DraftBlocks";
import { InlineAreaMemos } from "../InlineAreaMemos";

// ─── 타입 ──

interface ContextGridPanelAppProps {
  studentId: string;
  tenantId: string;
  activeSubjectId?: string | null;
  activeSchoolYear?: number | null;
  activeSubjectName?: string | null;
}

type LayerSection = "guide" | "direction" | "draft" | "neis" | "analysis" | "memo";

const SECTIONS: { key: LayerSection; label: string; icon: typeof FileText }[] = [
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "analysis", label: "분석", icon: Search },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "direction", label: "방향", icon: Compass },
  { key: "memo", label: "메모", icon: StickyNote },
];

// ─── 메인 ──

export function ContextGridPanelApp({
  studentId,
  tenantId,
  activeSubjectId,
  activeSchoolYear,
  activeSubjectName,
}: ContextGridPanelAppProps) {
  const [openSections, setOpenSections] = useState<Set<LayerSection>>(
    new Set(["neis", "draft", "analysis"]),
  );

  const toggleSection = useCallback((key: LayerSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // React Query — 캐시된 데이터 재사용 (StudentRecordClient와 동일 키)
  const { data: recordData } = useQuery(
    recordTabQueryOptions(studentId, activeSchoolYear ?? 0),
  );
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, activeSchoolYear ?? 0, tenantId),
  );

  // 선택된 과목의 세특 레코드 찾기
  const subjectRecords = useMemo(() => {
    if (!recordData?.seteks || !activeSubjectId) return [];
    return recordData.seteks
      .filter((s: RecordSetek) => s.subject_id === activeSubjectId)
      .sort((a: RecordSetek, b: RecordSetek) => a.semester - b.semester);
  }, [recordData?.seteks, activeSubjectId]);

  const subjectName = activeSubjectName ?? "과목";

  // 분석 태그 필터
  const subjectTags = useMemo(() => {
    if (!diagnosisData?.activityTags || subjectRecords.length === 0) return [];
    const recordIds = new Set(subjectRecords.map((r: RecordSetek) => r.id));
    return (diagnosisData.activityTags as AnalysisTagLike[]).filter(
      (t) => t.record_type === "setek" && recordIds.has(t.record_id),
    );
  }, [diagnosisData?.activityTags, subjectRecords]);

  const charLimit = getCharLimit("setek", activeSchoolYear ?? 0);

  if (!activeSubjectId || !activeSchoolYear) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-[var(--text-tertiary)]">
          세특 테이블에서 과목의 ⤢ 버튼을 클릭하면<br />해당 과목의 모든 레이어를 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  if (subjectRecords.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-[var(--text-tertiary)]">해당 과목의 세특 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex-shrink-0 border-b border-[var(--border-secondary)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{subjectName}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">컨텍스트 그리드 · 전 레이어 비교</p>
      </div>

      {/* 스크롤 콘텐츠 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3">
        <div className="flex flex-col gap-2">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-lg border border-[var(--border-secondary)]">
              {/* 섹션 헤더 (토글) */}
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <Icon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <span className="flex-1 text-xs font-semibold text-[var(--text-primary)]">{label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform", openSections.has(key) && "rotate-180")} />
              </button>

              {/* 섹션 내용 */}
              {openSections.has(key) && (
                <div className="border-t border-[var(--border-secondary)] px-3 py-2">
                  {key === "neis" && (
                    <NeisSection records={subjectRecords} />
                  )}
                  {key === "draft" && (
                    <DraftSection
                      records={subjectRecords}
                      charLimit={charLimit}
                      studentId={studentId}
                      schoolYear={activeSchoolYear}
                      tenantId={tenantId}
                    />
                  )}
                  {key === "analysis" && (
                    <AnalysisSection
                      records={subjectRecords}
                      subjectTags={subjectTags}
                      subjectName={subjectName}
                      studentId={studentId}
                      tenantId={tenantId}
                      schoolYear={activeSchoolYear}
                    />
                  )}
                  {key === "guide" && (
                    <p className="py-2 text-xs text-[var(--text-tertiary)]">가이드 정보는 메인 뷰에서 확인하세요.</p>
                  )}
                  {key === "direction" && (
                    <p className="py-2 text-xs text-[var(--text-tertiary)]">방향 정보는 메인 뷰에서 확인하세요.</p>
                  )}
                  {key === "memo" && (
                    <InlineAreaMemos
                      studentId={studentId}
                      areaType="setek"
                      areaId={activeSubjectId}
                      areaLabel={subjectName}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NEIS 섹션 ──

function NeisSection({ records }: { records: RecordSetek[] }) {
  return (
    <div className="flex flex-col gap-2">
      {records.map((setek) => (
        <div key={setek.id} className="flex flex-col gap-0.5">
          {records.length > 1 && setek.semester != null && (
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">{setek.semester}학기</span>
          )}
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
            {setek.content?.trim() || setek.imported_content || ""}
          </p>
          {!setek.content?.trim() && !setek.imported_content && (
            <p className="text-xs text-[var(--text-placeholder)]">없음</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 가안 섹션 ──

function DraftSection({
  records,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
}: {
  records: RecordSetek[];
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
}) {
  const queryClient = useQueryClient();
  const recordQk = ["studentRecord", "recordTab", studentId] as const;

  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      for (const r of records) {
        if (r.ai_draft_content && !r.content?.trim()) {
          const res = await acceptAiDraftAction(r.id, "setek");
          if (!res.success) throw new Error("error" in res ? res.error : "수용 실패");
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      for (const r of records) {
        if (r.content?.trim()) {
          const res = await confirmDraftAction(r.id, "setek");
          if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSaveContent = useCallback(async (recordId: string, content: string) => {
    const setek = records.find((r) => r.id === recordId);
    if (!setek) return;
    await saveSetekAction({
      student_id: studentId,
      school_year: schoolYear,
      tenant_id: tenantId,
      grade: setek.grade ?? 1,
      semester: setek.semester,
      subject_id: setek.subject_id,
      content,
      char_limit: charLimit,
    });
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [records, studentId, schoolYear, tenantId, charLimit, queryClient, recordQk]);

  return (
    <div className="flex flex-col gap-3">
      <MultiRecordDraftBlock
        label="AI 초안"
        style={DRAFT_BLOCK_STYLES.ai}
        records={records}
        getContent={(r) => r.ai_draft_content}
      />
      <MultiRecordDraftBlock
        label="컨설턴트 가안"
        style={DRAFT_BLOCK_STYLES.consultant}
        records={records}
        getContent={(r) => r.content}
        editable
        onSave={handleSaveContent}
        charLimit={charLimit}
        importAction={records.some((r) => r.ai_draft_content && !r.content?.trim()) ? () => acceptAiMutation.mutate() : undefined}
        importLabel="AI 초안 수용"
        isImporting={acceptAiMutation.isPending}
      />
      <MultiRecordDraftBlock
        label="확정본"
        style={DRAFT_BLOCK_STYLES.confirmed}
        records={records}
        getContent={(r) => r.confirmed_content}
        importAction={records.some((r) => r.content?.trim()) ? () => confirmMutation.mutate() : undefined}
        importLabel="가안 확정"
        isImporting={confirmMutation.isPending}
      />
    </div>
  );
}

// ─── 분석 섹션 ──

function AnalysisSection({
  records,
  subjectTags,
  subjectName,
  studentId,
  tenantId,
  schoolYear,
}: {
  records: RecordSetek[];
  subjectTags: AnalysisTagLike[];
  subjectName: string;
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const queryClient = useQueryClient();
  const diagnosisQk = ["studentRecord", "diagnosisTab", studentId] as const;

  const aiTags = useMemo(() => subjectTags.filter((t) => t.source === "ai"), [subjectTags]);
  const manualTags = useMemo(() => subjectTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [subjectTags]);
  const confirmedTags = useMemo(() => subjectTags.filter((t) => t.status === "confirmed"), [subjectTags]);

  const combinedContent = useMemo(
    () => records.map((r) => r.content?.trim() || r.imported_content || "").filter(Boolean).join("\n\n"),
    [records],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records,
    displayName: subjectName,
    recordType: "setek" as const,
  }), [studentId, tenantId, schoolYear, records, subjectName]);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId, student_id: studentId,
          record_type: t.record_type as "setek", record_id: t.record_id,
          competency_item: t.competency_item,
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
      for (const t of tagsToDelete) await deleteActivityTagAction(t.id);
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");

  return (
    <div className="flex flex-col gap-3">
      <AnalysisBlock label="AI" tags={aiTags} content={combinedContent} mode={aiMode} setMode={setAiMode} />
      <AnalysisBlock
        label="컨설턴트" tags={manualTags} content={combinedContent}
        mode={consultantMode} setMode={setConsultantMode}
        importAction={aiTags.length > 0 ? () => importAiMutation.mutate() : undefined}
        importLabel="AI 가져오기" isImporting={importAiMutation.isPending}
        taggerProps={taggerProps}
        onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
        onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${manualTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(manualTags); }}
      />
      <AnalysisBlock
        label="확정" tags={confirmedTags} content={combinedContent}
        mode={confirmedMode} setMode={setConfirmedMode}
        importAction={manualTags.length > 0 ? () => importConsultantMutation.mutate() : undefined}
        importLabel="컨설턴트 가져오기" isImporting={importConsultantMutation.isPending}
        taggerProps={taggerProps}
        onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
        onDeleteAll={() => { if (confirm(`확정 태그 ${confirmedTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(confirmedTags); }}
      />
    </div>
  );
}
