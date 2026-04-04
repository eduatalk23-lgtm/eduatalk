"use client";

// ============================================
// 컨텍스트 그리드 — 특정 과목의 모든 레이어를 열로 펼쳐 비교
// 행(관점): AI / 컨설턴트 / 확정
// 열(레이어): 선택 가능 (가이드/가안/NEIS/분석/메모/논의/방향)
// Phase 3: NEIS, 메모 열 (rowSpan=3) 우선 구현
// ============================================

import { Fragment, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { cn } from "@/lib/cn";
import { BookOpen, Compass } from "lucide-react";

const InlineTopicChat = dynamic(
  () =>
    import("@/app/(admin)/admin/students/[id]/plans/_components/side-panel/apps/chat/ChatPanelApp").then(
      (m) => ({ default: m.ChatPanelApp }),
    ),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-8 text-sm text-[var(--text-tertiary)]">채팅 로딩 중...</div> },
);
const GuideRecommendationPanel = dynamic(
  () =>
    import("./GuideRecommendationPanel").then((m) => ({ default: m.GuideRecommendationPanel })),
  { ssr: false },
);
const DirectionFromChatPanel = dynamic(
  () =>
    import("./DirectionFromChatPanel").then((m) => ({ default: m.DirectionFromChatPanel })),
  { ssr: false },
);
import type { MergedSetekRow, SetekGuideItemLike } from "./SetekEditor";
import type { GridColumnKey } from "./ContextGridBottomSheet";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "./shared/AnalysisBlocks";
import { AnalysisBlock } from "./shared/AnalysisBlocks";
import { MultiRecordDraftBlock, DRAFT_BLOCK_STYLES } from "./shared/DraftBlocks";
import { InlineAreaMemos } from "./InlineAreaMemos";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import type { RecordSetek } from "@/lib/domains/student-record";
import type { SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";

// ─── 타입 ──

type GuideAssignmentLike = {
  id: string;
  status: string;
  target_subject_id?: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
};

export interface ContextGridProps {
  row: MergedSetekRow;
  selectedColumns: GridColumnKey[];
  onColumnsChange: (cols: GridColumnKey[]) => void;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  subjectTags: AnalysisTagLike[];
  subjectReflection?: SubjectReflectionRate;
  subjectGuides: GuideAssignmentLike[];
  subjectDirection: SetekGuideItemLike[];
  /** 설계 모드(NEIS 없음) 학년 — AI 초안/분석 미생성 안내 */
  isDesignMode?: boolean;
}

// ─── 상수 ──

const PERSPECTIVES = ["ai", "consultant", "confirmed"] as const;
type Perspective = (typeof PERSPECTIVES)[number];

const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  ai: "AI",
  consultant: "컨설턴트",
  confirmed: "확정",
};

/** 열별 rowSpan: 관점 구분이 없는 열은 3, 3행 분리는 1 */
const COL_ROW_SPAN: Record<GridColumnKey, number> = {
  chat: 3,
  guide: 1,
  design_direction: 1,   // 3행 분리: AI설계방향/컨설턴트/확정
  draft: 1,
  draft_analysis: 1,     // 3행 분리: AI가안분석/컨설턴트/확정
  neis: 3,
  analysis: 1,
  improve_direction: 1,  // 3행 분리: AI보완방향/컨설턴트/확정
  memo: 3,
};

const COL_LABELS: Record<GridColumnKey, string> = {
  chat: "논의",
  guide: "가이드",
  design_direction: "설계방향",
  draft: "가안",
  draft_analysis: "가안분석",
  neis: "NEIS",
  analysis: "분석",
  improve_direction: "보완방향",
  memo: "메모",
};

const SELECTABLE_COLUMNS: GridColumnKey[] = [
  "chat", "guide", "design_direction", "draft", "draft_analysis",
  "neis", "analysis", "improve_direction", "memo",
];
const MAX_COLS = 3;

/** 3행 분리 열의 관점별 라벨 (열마다 다른 이름) */
const COL_PERSPECTIVE_LABELS: Partial<Record<GridColumnKey, Record<Perspective, string>>> = {
  draft: { ai: "AI 초안", consultant: "컨설턴트 가안", confirmed: "확정본" },
  draft_analysis: { ai: "AI 분석", consultant: "컨설턴트", confirmed: "확정" },
  analysis: { ai: "AI 분석", consultant: "컨설턴트", confirmed: "확정" },
  guide: { ai: "AI 추천", consultant: "배정 목록", confirmed: "완료" },
  design_direction: { ai: "AI 설계", consultant: "컨설턴트", confirmed: "확정" },
  improve_direction: { ai: "AI 보완", consultant: "컨설턴트", confirmed: "확정" },
};

// ─── 메인 컴포넌트 ──

export function ContextGrid({
  row,
  selectedColumns,
  onColumnsChange,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  subjectTags,
  subjectReflection,
  subjectGuides,
  subjectDirection,
  isDesignMode,
}: ContextGridProps) {
  // 열별 관점 필터: 3행 분리 열만 해당 (rowSpan 열은 관점 구분 없음)
  const [columnPerspectives, setColumnPerspectives] = useState<Record<string, Set<Perspective>>>(() => {
    const init: Record<string, Set<Perspective>> = {};
    for (const col of SELECTABLE_COLUMNS) {
      if (COL_ROW_SPAN[col] === 1) {
        init[col] = new Set(PERSPECTIVES);
      }
    }
    return init;
  });

  const togglePerspective = useCallback((col: GridColumnKey, p: Perspective) => {
    setColumnPerspectives((prev) => {
      const current = prev[col] ?? new Set(PERSPECTIVES);
      const next = new Set(current);
      if (next.has(p)) {
        if (next.size <= 1) return prev; // 최소 1개
        next.delete(p);
      } else {
        next.add(p);
      }
      return { ...prev, [col]: next };
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── 독립 컬럼 레이아웃 (각 열이 자기만의 행 구성) ── */}
      <div className="min-h-0 flex-1 flex gap-px rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
        {selectedColumns.map((col) => {
          const isSplit = COL_ROW_SPAN[col] === 1;
          const perspLabels = COL_PERSPECTIVE_LABELS[col];
          const checkedPersp = isSplit
            ? PERSPECTIVES.filter((p) => columnPerspectives[col]?.has(p) ?? true)
            : null;

          return (
            <div key={col} className="flex min-h-0 flex-1 flex-col gap-px">
              {/* 헤더 1행: 타이틀(좌) + 체크박스(우) */}
              <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {COL_LABELS[col]}
                </span>
                {isSplit && perspLabels && (
                  <div className="ml-auto flex items-center gap-2">
                    {PERSPECTIVES.map((p) => {
                      const checked = columnPerspectives[col]?.has(p) ?? true;
                      return (
                        <label key={p} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerspective(col, p)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                          />
                          <span className={cn("text-xs", checked ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-600")}>
                            {perspLabels[p]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 셀: 분리 열은 체크된 관점만, rowSpan 열은 단일 셀 */}
              {isSplit && checkedPersp ? (
                checkedPersp.map((perspective) => (
                  <div key={perspective} className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-gray-900">
                    <GridCell
                      column={col}
                      perspective={perspective}
                      row={row}
                      charLimit={charLimit}
                      studentId={studentId}
                      schoolYear={schoolYear}
                      tenantId={tenantId}
                      grade={grade}
                      subjectTags={subjectTags}
                      subjectReflection={subjectReflection}
                      subjectGuides={subjectGuides}
                      subjectDirection={subjectDirection}
                      isDesignMode={isDesignMode}
                    />
                  </div>
                ))
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar bg-white p-3 dark:bg-gray-900">
                  <GridCell
                    column={col}
                    perspective="ai"
                    row={row}
                    charLimit={charLimit}
                    studentId={studentId}
                    schoolYear={schoolYear}
                    tenantId={tenantId}
                    grade={grade}
                    subjectTags={subjectTags}
                    subjectReflection={subjectReflection}
                    subjectGuides={subjectGuides}
                    subjectDirection={subjectDirection}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 셀 렌더러 ──

function GridCell({
  column,
  perspective,
  row,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  subjectTags,
  subjectReflection,
  subjectGuides,
  subjectDirection,
  isDesignMode,
}: {
  column: GridColumnKey;
  perspective: Perspective;
  row: MergedSetekRow;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  subjectTags: AnalysisTagLike[];
  subjectReflection?: SubjectReflectionRate;
  subjectGuides: GuideAssignmentLike[];
  subjectDirection: SetekGuideItemLike[];
  isDesignMode?: boolean;
}) {
  // ── 논의 (rowSpan=3, 관점 무관 — 채팅 + 가이드 추천) ──
  if (column === "chat") {
    return (
      <ChatWithGuideRecommendation
        subjectId={row.subjectId}
        subjectName={row.displayName}
      />
    );
  }

  // ── NEIS (rowSpan=3, 관점 무관) ──
  if (column === "neis") {
    return (
      <div className="flex flex-col gap-2">
        {row.records.map((setek) => (
          <div key={setek.id} className="flex flex-col gap-0.5">
            {row.records.length > 1 && setek.semester != null && (
              <span className="text-sm font-semibold text-[var(--text-tertiary)]">{setek.semester}학기</span>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
              {setek.content?.trim() || setek.imported_content || ""}
            </p>
            {!setek.content?.trim() && !setek.imported_content && (
              <p className="text-sm text-[var(--text-placeholder)]">없음</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── 메모 (rowSpan=3, 관점 무관) ──
  if (column === "memo") {
    return (
      <InlineAreaMemos
        studentId={studentId}
        areaType="setek"
        areaId={row.subjectId}
        areaLabel={row.displayName}
      />
    );
  }

  // ── 가이드 (3행 분리: AI=추천배정/산문가이드, 컨설턴트=배정목록, 확정=완료) ──
  if (column === "guide") {
    if (perspective === "ai") {
      // AI 추천 가이드 배정 (CMS 탐구가이드 또는 산문형 활동 가이드)
      const aiRecommended = subjectGuides.filter((g) => g.ai_recommendation_reason);
      if (aiRecommended.length > 0) {
        return (
          <div className="flex flex-col gap-1">
            {aiRecommended.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <Bot className="h-3 w-3 shrink-0 text-violet-500" />
                <span className="truncate text-sm text-[var(--text-primary)]">{g.exploration_guides?.title ?? "가이드"}</span>
              </div>
            ))}
          </div>
        );
      }
      return <span className="text-sm text-[var(--text-placeholder)]">AI 추천 가이드 없음</span>;
    }
    if (perspective === "consultant") {
      // 배정 가이드 목록
      const assigned = subjectGuides.filter((g) => g.status !== "completed");
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
    // confirmed
    const completed = subjectGuides.filter((g) => g.status === "completed");
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

  // ── 설계방향 (prospective — 3행 분리) ──
  if (column === "design_direction") {
    if (perspective === "ai") {
      const prospective = subjectDirection.filter((d) => d.guideMode === "prospective");
      if (prospective.length === 0) {
        return <span className="text-sm text-[var(--text-placeholder)]">설계방향 없음</span>;
      }
      return (
        <div className="flex flex-col gap-1.5">
          {prospective.map((d, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm text-[var(--text-primary)] line-clamp-3">{d.direction}</p>
              {d.keywords.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {d.keywords.slice(0, 5).map((kw) => (
                    <span key={kw} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    // consultant / confirmed — placeholder
    return (
      <span className="text-sm text-[var(--text-placeholder)]">
        {perspective === "consultant" ? "컨설턴트 설계방향 — 준비 중" : "확정 설계방향 — 준비 중"}
      </span>
    );
  }

  // ── 보완방향 (retrospective — 3행 분리) ──
  if (column === "improve_direction") {
    if (perspective === "ai") {
      const retrospective = subjectDirection.filter((d) => d.guideMode === "retrospective" || !d.guideMode);
      if (retrospective.length === 0) {
        return <span className="text-sm text-[var(--text-placeholder)]">보완방향 없음</span>;
      }
      return (
        <div className="flex flex-col gap-1.5">
          {retrospective.map((d, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm text-[var(--text-primary)] line-clamp-3">{d.direction}</p>
              {d.keywords.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {d.keywords.slice(0, 5).map((kw) => (
                    <span key={kw} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    // consultant / confirmed — placeholder
    return (
      <span className="text-sm text-[var(--text-placeholder)]">
        {perspective === "consultant" ? "컨설턴트 보완방향 — 준비 중" : "확정 보완방향 — 준비 중"}
      </span>
    );
  }

  // ── 가안 (관점별 3행) ──
  if (column === "draft") {
    // 설계 모드에서 P7 가안이 아직 없으면 안내 표시
    if (isDesignMode && perspective === "ai" && !row.records.some((r) => r.ai_draft_content?.trim())) {
      return (
        <div className="flex h-full items-center justify-center">
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            설계 모드 — P7 파이프라인 실행 또는 직접 작성
          </span>
        </div>
      );
    }
    return (
      <DraftGridCell
        perspective={perspective}
        records={row.records}
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
    return (
      <DraftAnalysisGridCell
        perspective={perspective}
        row={row}
        subjectTags={subjectTags}
        studentId={studentId}
        tenantId={tenantId}
        schoolYear={schoolYear}
      />
    );
  }

  // ── 분석 (관점별 3행) ──
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
      <AnalysisGridCell
        perspective={perspective}
        row={row}
        subjectTags={subjectTags}
        studentId={studentId}
        tenantId={tenantId}
        schoolYear={schoolYear}
      />
    );
  }

  // ── 논의 (rowSpan=3) ── — 열 선택기에서 제외, 별도 버튼 제공
  return null;
}

// ─── 가안 셀 (관점별 단일 블록 + mutation) ──

function DraftGridCell({
  perspective,
  records,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  perspective: Perspective;
  records: RecordSetek[];
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  const queryClient = useQueryClient();
  const recordQk = ["studentRecord", "recordTab", studentId] as const;

  // AI 초안 → 컨설턴트 가안 수용 (E1: content 보호, E4: 낙관적 잠금)
  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      for (const r of records) {
        if (!r.ai_draft_content) continue;
        const res = await acceptAiDraftAction(r.id, "setek");
        if (!res.success) {
          if ("error" in res && res.error === "CONTENT_EXISTS") {
            if (!confirm(`${r.semester}학기 세특에 기존 가안이 있습니다. AI 초안으로 덮어쓰시겠습니까?`)) continue;
            const forced = await acceptAiDraftAction(r.id, "setek", true);
            if (!forced.success && "error" in forced && forced.error === "CONFLICT") {
              throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
            }
          } else if ("error" in res && res.error === "CONFLICT") {
            throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
          } else {
            throw new Error("error" in res ? res.error : "수용 실패");
          }
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  // 컨설턴트 가안 → 확정
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

  // 컨설턴트 가안 저장
  const handleSaveContent = useCallback(async (recordId: string, content: string) => {
    const setek = records.find((r) => r.id === recordId);
    if (!setek) return;
    await saveSetekAction({
      student_id: studentId,
      school_year: schoolYear,
      tenant_id: tenantId,
      grade,
      semester: setek.semester,
      subject_id: setek.subject_id,
      content,
      char_limit: charLimit,
    });
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [records, studentId, schoolYear, tenantId, grade, charLimit, queryClient, recordQk]);

  if (perspective === "ai") {
    return (
      <MultiRecordDraftBlock
        label="AI 초안"
        style={DRAFT_BLOCK_STYLES.ai}
        records={records}
        getContent={(r) => r.ai_draft_content}
      />
    );
  }

  if (perspective === "consultant") {
    return (
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
    );
  }

  // confirmed
  return (
    <MultiRecordDraftBlock
      label="확정본"
      style={DRAFT_BLOCK_STYLES.confirmed}
      records={records}
      getContent={(r) => r.confirmed_content}
      importAction={records.some((r) => r.content?.trim()) ? () => confirmMutation.mutate() : undefined}
      importLabel="가안 확정"
      isImporting={confirmMutation.isPending}
      staleWarning={
        // E5: 확정본이 있으나 현재 가안과 다른 레코드가 하나라도 있으면 경고
        records.some(
          (r) => r.confirmed_content?.trim() && r.content?.trim() && r.content !== r.confirmed_content,
        ) ? "가안과 다름" : undefined
      }
    />
  );
}

// ─── 분석 셀 (관점별 단일 블록 + mutation) ──

function AnalysisGridCell({
  perspective,
  row,
  subjectTags,
  studentId,
  tenantId,
  schoolYear,
}: {
  perspective: Perspective;
  row: MergedSetekRow;
  subjectTags: AnalysisTagLike[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const queryClient = useQueryClient();
  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  // analysis 열은 draft_analysis 태그 제외
  const analysisTags = useMemo(() => subjectTags.filter((t) => t.tag_context !== "draft_analysis"), [subjectTags]);
  const aiTags = useMemo(() => analysisTags.filter((t) => t.source === "ai"), [analysisTags]);
  const manualTags = useMemo(() => analysisTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [analysisTags]);
  const confirmedTags = useMemo(() => analysisTags.filter((t) => t.status === "confirmed"), [analysisTags]);

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

  // AI 태그 → 컨설턴트 복사
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
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  // 컨설턴트 태그 → 확정
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

  // 개별 태그 삭제
  const deleteTagMutation = useMutation({
    mutationFn: async (tag: AnalysisTagLike) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const res = await deleteActivityTagAction(tag.id);
      if (!res.success) throw new Error("error" in res ? res.error : "삭제 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  // 전체 태그 삭제
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

  // confirmed
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

// ─── 가안분석 셀 (draft_analysis 태그 전용) ──

function DraftAnalysisGridCell({
  perspective,
  row,
  subjectTags,
}: {
  perspective: Perspective;
  row: MergedSetekRow;
  subjectTags: AnalysisTagLike[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  // draft_analysis 태그만 필터
  const draftTags = useMemo(() => subjectTags.filter((t) => t.tag_context === "draft_analysis"), [subjectTags]);

  const aiTags = useMemo(() => draftTags.filter((t) => t.source === "ai"), [draftTags]);
  const manualTags = useMemo(() => draftTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [draftTags]);
  const confirmedTags = useMemo(() => draftTags.filter((t) => t.status === "confirmed"), [draftTags]);

  const combinedContent = useMemo(
    () => row.records.map((r) => r.ai_draft_content?.trim() || "").filter(Boolean).join("\n\n"),
    [row.records],
  );

  const [mode, setMode] = useState<AnalysisBlockMode>(
    perspective === "ai" ? "competency" : "tagging",
  );

  if (draftTags.length === 0 && perspective === "ai") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="rounded bg-gray-50 px-2 py-1 text-xs text-[var(--text-tertiary)] dark:bg-gray-800">
          가안분석 태그 없음 — 파이프라인 P8 실행 필요
        </span>
      </div>
    );
  }

  if (perspective === "ai") {
    return (
      <AnalysisBlock
        label="AI 가안분석"
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
      />
    );
  }

  // confirmed
  return (
    <AnalysisBlock
      label="확정"
      tags={confirmedTags}
      content={combinedContent}
      mode={mode}
      setMode={setMode}
    />
  );
}

// ── 논의 + 가이드 추천 통합 컴포넌트 ──

function ChatWithGuideRecommendation({
  subjectId,
  subjectName,
}: {
  subjectId: string;
  subjectName: string;
}) {
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  const [showDirectionPanel, setShowDirectionPanel] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-[300px] flex-col gap-2">
      {/* 액션 버튼 */}
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

      {/* 방향 설정 패널 */}
      {showDirectionPanel && (
        <DirectionFromChatPanel
          subjectId={subjectId}
          subjectName={subjectName}
          onClose={() => setShowDirectionPanel(false)}
        />
      )}

      {/* 가이드 추천 패널 */}
      {showGuidePanel && activeRoomId && (
        <GuideRecommendationPanel
          roomId={activeRoomId}
          subjectId={subjectId}
          subjectName={subjectName}
          onClose={() => setShowGuidePanel(false)}
        />
      )}

      {/* 채팅 */}
      <div className="min-h-0 flex-1">
        <InlineTopicChat
          recordTopic={subjectId}
          autoEnter
          subjectName={subjectName}
          onRoomEnter={setActiveRoomId}
        />
      </div>
    </div>
  );
}
