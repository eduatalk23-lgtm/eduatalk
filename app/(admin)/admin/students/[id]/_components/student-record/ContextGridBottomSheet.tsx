"use client";

// ============================================
// 컨텍스트 그리드 바텀시트
// z-index 오버레이, 가로 100%, 하단에서 위로 슬라이드
// ContextGrid 컴포넌트를 래핑하여 전체폭 그리드 제공
// + 과목 네비게이션 스트립 (학년·교과 필터 + prev/next)
// ============================================

import { useEffect, useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Bot, Check, ChevronUp, X } from "lucide-react";
import { ContextGrid } from "./ContextGrid";
import { ContextGridChangche } from "./ContextGridChangche";
import { ContextGridHaengteuk } from "./ContextGridHaengteuk";
import type { ChangcheGuideItemLike } from "./ContextGridChangche";
import type { HaengteukGuideItemLike } from "./ContextGridHaengteuk";
import { SubjectNavStrip } from "./SubjectNavStrip";
import { useStudentRecordContext } from "./StudentRecordContext";
import { recordTabQueryOptions, diagnosisTabQueryOptions } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek, RecordChangche, RecordHaengteuk } from "@/lib/domains/student-record";
import type { MergedSetekRow, SetekGuideItemLike } from "./SetekEditor";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";
import type { SubjectNavItem } from "./StudentRecordClient";

// ─── ID 종류 감지 ──

type ActiveIdKind = "setek" | "changche" | "haengteuk";

function detectIdKind(id: string | null | undefined): ActiveIdKind | null {
  if (!id) return null;
  if (id === "haengteuk") return "haengteuk";
  if (id.startsWith("changche:")) return "changche";
  return "setek";
}

// ─── ContextGrid 전용 열 타입 (에디터 탭과 별개) ──

export type GridColumnKey = "chat" | "guide" | "direction" | "draft" | "neis" | "analysis" | "memo";

const DEFAULT_COLUMNS: GridColumnKey[] = ["draft", "neis", "analysis"];
const MAX_COLUMNS = 3;
const SELECTABLE_COLS: GridColumnKey[] = ["chat", "guide", "direction", "draft", "neis", "analysis", "memo"];
const COL_LABELS: Record<GridColumnKey, string> = {
  chat: "논의", guide: "가이드", direction: "방향", draft: "가안", neis: "NEIS", analysis: "분석", memo: "메모",
};

const LS_KEY_COLUMNS = "contextGrid:selectedColumns";
const LS_KEY_GRADE = "contextGrid:gradeFilter";
const LS_KEY_CATEGORY = "contextGrid:categoryFilter";

type CategoryFilter = "all" | "general" | "elective" | "pe_art";

function readLS<T>(key: string, fallback: T, parse: (v: string) => T | null): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

// ─── Props ──

interface ContextGridBottomSheetProps {
  onOpenTopSheet?: () => void;
  guideAssignments?: Array<{
    id: string;
    status: string;
    target_subject_id?: string | null;
    exploration_guides?: { id: string; title: string; guide_type?: string };
  }>;
  setekGuideItems?: SetekGuideItemLike[];
  subjectNavList?: SubjectNavItem[];
  changcheGuideItems?: ChangcheGuideItemLike[];
  haengteukGuideItems?: HaengteukGuideItemLike[];
}

// ─── 메인 컴포넌트 ──

export function ContextGridBottomSheet({
  onOpenTopSheet,
  guideAssignments,
  setekGuideItems,
  subjectNavList,
  changcheGuideItems,
  haengteukGuideItems,
}: ContextGridBottomSheetProps) {
  const ctx = useStudentRecordContext();
  const { activeSubjectId, activeSchoolYear, activeSubjectName, studentId, tenantId } = ctx;
  const activeKind = detectIdKind(activeSubjectId);

  // 시트 표시 여부 (DOM 유지) vs 열림 상태 (애니메이션)
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // ─── localStorage 영속 상태 ──

  const [selectedColumns, setSelectedColumns] = useState<GridColumnKey[]>(() =>
    readLS(LS_KEY_COLUMNS, DEFAULT_COLUMNS, (v) => {
      const parsed = JSON.parse(v) as GridColumnKey[];
      return Array.isArray(parsed) && parsed.length > 0 && parsed.length <= MAX_COLUMNS ? parsed : null;
    }),
  );

  const [gradeFilter, setGradeFilter] = useState<number | "all">(() =>
    readLS(LS_KEY_GRADE, "all" as number | "all", (v) => {
      if (v === "all") return "all";
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  );

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() =>
    readLS(LS_KEY_CATEGORY, "all" as CategoryFilter, (v) =>
      (["all", "general", "elective", "pe_art"] as const).includes(v as CategoryFilter)
        ? (v as CategoryFilter)
        : null,
    ),
  );

  // localStorage 동기화
  useEffect(() => { writeLS(LS_KEY_COLUMNS, JSON.stringify(selectedColumns)); }, [selectedColumns]);
  useEffect(() => { writeLS(LS_KEY_GRADE, String(gradeFilter)); }, [gradeFilter]);
  useEffect(() => { writeLS(LS_KEY_CATEGORY, categoryFilter); }, [categoryFilter]);

  // ─── 시트 열기/닫기 ──

  useEffect(() => {
    if (activeSubjectId && activeSchoolYear) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
    }
  }, [activeSubjectId, activeSchoolYear]);

  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setVisible(false);
      ctx.setActiveSubjectId?.(null);
      ctx.setActiveSchoolYear?.(null);
      ctx.setActiveSubjectName?.(null);
    }, 300);
  }, [ctx]);

  // ─── 과목 네비게이션 ──

  const filteredSubjects = useMemo(() => {
    if (!subjectNavList) return [];
    return subjectNavList.filter((s) => {
      if (gradeFilter !== "all" && s.grade !== gradeFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });
  }, [subjectNavList, gradeFilter, categoryFilter]);

  const currentIndex = useMemo(
    () => filteredSubjects.findIndex((s) => s.subjectId === activeSubjectId),
    [filteredSubjects, activeSubjectId],
  );

  const switchToSubject = useCallback((item: SubjectNavItem) => {
    ctx.setActiveSubjectId?.(item.subjectId);
    ctx.setActiveSchoolYear?.(item.schoolYear);
    ctx.setActiveSubjectName?.(item.subjectName);
  }, [ctx]);

  const movePrev = useCallback(() => {
    if (currentIndex > 0) switchToSubject(filteredSubjects[currentIndex - 1]);
  }, [currentIndex, filteredSubjects, switchToSubject]);

  const moveNext = useCallback(() => {
    if (currentIndex < filteredSubjects.length - 1) switchToSubject(filteredSubjects[currentIndex + 1]);
  }, [currentIndex, filteredSubjects, switchToSubject]);

  // 외부 트리거 시 필터 자동 조정 (현재 과목이 필터에서 보이도록)
  useEffect(() => {
    if (!activeSubjectId || !subjectNavList) return;
    const item = subjectNavList.find((s) => s.subjectId === activeSubjectId);
    if (!item) return;
    if (gradeFilter !== "all" && item.grade !== gradeFilter) setGradeFilter("all");
    if (categoryFilter !== "all" && item.category !== categoryFilter) setCategoryFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 외부 변경 시에만 리셋
  }, [activeSubjectId]);

  // 사용 가능한 학년 목록
  const availableGrades = useMemo(() => {
    if (!subjectNavList) return [];
    return [...new Set(subjectNavList.map((s) => s.grade))].sort();
  }, [subjectNavList]);

  // ─── 키보드 ──

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") { e.preventDefault(); movePrev(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") { e.preventDefault(); moveNext(); return; }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close, movePrev, moveNext]);

  // ─── 열 선택 ──

  const handleColumnsChange = useCallback((cols: GridColumnKey[]) => {
    if (cols.length > MAX_COLUMNS) return;
    setSelectedColumns(cols);
  }, []);

  const handleColumnToggle = useCallback((col: GridColumnKey) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== col);
      }
      if (prev.length >= MAX_COLUMNS) return prev;
      return [...prev, col].sort(
        (a, b) => SELECTABLE_COLS.indexOf(a) - SELECTABLE_COLS.indexOf(b),
      );
    });
  }, []);

  // ─── React Query (과목 전환 시 자동 재평가) ──

  const { data: recordData, isFetched: isRecordFetched } = useQuery(
    recordTabQueryOptions(studentId, activeSchoolYear ?? 0),
  );
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, activeSchoolYear ?? 0, tenantId),
  );

  // ─── 열 선택: activeKind에 따라 사용 가능한 열 필터링 ──

  const availableCols = useMemo<GridColumnKey[]>(() => {
    // 세특/창체/행특 모두 방향 레이어 사용 가능 (P4~P6 방향 가이드 생성)
    return SELECTABLE_COLS;
  }, []);

  // ─── Setek 데이터 ──

  const subjectRecords = useMemo(() => {
    if (activeKind !== "setek" || !recordData?.seteks || !activeSubjectId) return [];
    return (recordData.seteks as RecordSetek[])
      .filter((s) => s.subject_id === activeSubjectId)
      .sort((a, b) => a.semester - b.semester);
  }, [recordData?.seteks, activeSubjectId, activeKind]);

  const mergedRow: MergedSetekRow | null = useMemo(() => {
    if (subjectRecords.length === 0) return null;
    return {
      displayName: activeSubjectName ?? "과목",
      records: subjectRecords,
      subjectId: activeSubjectId!,
    };
  }, [subjectRecords, activeSubjectName, activeSubjectId]);

  const subjectTags = useMemo(() => {
    if (!diagnosisData?.activityTags || subjectRecords.length === 0) return [];
    const recordIds = new Set(subjectRecords.map((r) => r.id));
    return (diagnosisData.activityTags as AnalysisTagLike[]).filter(
      (t) => t.record_type === "setek" && recordIds.has(t.record_id),
    );
  }, [diagnosisData?.activityTags, subjectRecords]);

  // 설계 모드 판별: 이 학년에 NEIS imported_content가 있는 레코드가 0건이면 설계 모드
  const isDesignMode = useMemo(() => {
    if (!recordData) return false;
    const allRecords = [
      ...((recordData.seteks ?? []) as Array<{ imported_content?: string | null }>),
      ...((recordData.changche ?? []) as Array<{ imported_content?: string | null }>),
      ...(recordData.haengteuk ? [recordData.haengteuk as { imported_content?: string | null }] : []),
    ];
    if (allRecords.length === 0) return true;
    return !allRecords.some((r) => r.imported_content && r.imported_content.trim().length > 20);
  }, [recordData]);

  const filteredGuides = useMemo(() => {
    if (!guideAssignments || !activeSubjectId) return [];
    return guideAssignments.filter((a) => a.target_subject_id === activeSubjectId);
  }, [guideAssignments, activeSubjectId]);

  const filteredDirection = useMemo(() => {
    if (!setekGuideItems || !activeSubjectName) return [];
    return setekGuideItems.filter(
      (g) => g.subjectName === activeSubjectName && g.schoolYear === activeSchoolYear,
    );
  }, [setekGuideItems, activeSubjectName, activeSchoolYear]);

  const charLimit = getCharLimit("setek", activeSchoolYear ?? 0);
  const grade = subjectRecords[0]?.grade ?? 1;

  // ─── Changche / Haengteuk 데이터 ──

  const changcheRecord = useMemo<RecordChangche | null>(() => {
    if (activeKind !== "changche" || !recordData?.changche || !activeSubjectId) return null;
    const activityType = activeSubjectId.replace("changche:", "");
    return (recordData.changche as RecordChangche[]).find((c) => c.activity_type === activityType) ?? null;
  }, [recordData?.changche, activeSubjectId, activeKind]);

  const haengteukRecord = useMemo<RecordHaengteuk | null>(() => {
    if (activeKind !== "haengteuk" || !recordData?.haengteuk) return null;
    return recordData.haengteuk as RecordHaengteuk;
  }, [recordData?.haengteuk, activeKind]);

  const nonSetekTags = useMemo(() => {
    if (!diagnosisData?.activityTags || !activeKind || activeKind === "setek") return [];
    const tags = diagnosisData.activityTags as AnalysisTagLike[];
    if (activeKind === "changche" && changcheRecord) {
      return tags.filter((t) => t.record_type === "changche" && t.record_id === changcheRecord.id);
    }
    if (activeKind === "haengteuk" && haengteukRecord) {
      return tags.filter((t) => t.record_type === "haengteuk" && t.record_id === haengteukRecord.id);
    }
    return [];
  }, [diagnosisData?.activityTags, activeKind, changcheRecord, haengteukRecord]);

  const nonSetekContent = useMemo(() => {
    if (activeKind === "changche" && changcheRecord) {
      return changcheRecord.content?.trim() || changcheRecord.imported_content || "";
    }
    if (activeKind === "haengteuk" && haengteukRecord) {
      return haengteukRecord.content?.trim() || haengteukRecord.imported_content || "";
    }
    return "";
  }, [activeKind, changcheRecord, haengteukRecord]);

  const nonSetekCharLimit = useMemo(() => {
    if (activeKind === "changche" && changcheRecord) {
      return getCharLimit(changcheRecord.activity_type as "autonomy" | "club" | "career", activeSchoolYear ?? 0);
    }
    if (activeKind === "haengteuk") {
      return getCharLimit("haengteuk", activeSchoolYear ?? 0);
    }
    return 0;
  }, [activeKind, changcheRecord, activeSchoolYear]);

  if (!visible) return null;

  return (
    <>
      {/* 전체화면 그리드 */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-white transition-opacity duration-300 ease-out dark:bg-gray-900",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {/* 비교 열 선택 (GlobalLayerBar와 시각적 구분 — 체크박스 토글) */}
            <div className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-xs text-[var(--text-tertiary)]">비교 열</span>
              <div className="flex items-center gap-1">
                {availableCols.map((col) => {
                  const active = selectedColumns.includes(col);
                  const disabled = !active && selectedColumns.length >= MAX_COLUMNS;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleColumnToggle(col)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors",
                        active
                          ? "border-gray-400 bg-white text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
                          : disabled
                            ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600"
                            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700",
                      )}
                    >
                      <span className={cn(
                        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                        active
                          ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-500"
                          : "border-gray-300 dark:border-gray-600",
                      )}>
                        {active && <Check className="h-2.5 w-2.5" />}
                      </span>
                      {COL_LABELS[col]}
                    </button>
                  );
                })}
              </div>
              <span className="shrink-0 text-xs text-[var(--text-placeholder)]">최대 {MAX_COLUMNS}개</span>
            </div>

            {/* 우: AI 어시스턴트 + 학생 컨텍스트 + 닫기 */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("studentId", studentId);
                  if (ctx.studentName) params.set("studentName", ctx.studentName);
                  window.open(
                    `/agent-popout?${params.toString()}`,
                    "agent-popout",
                    "width=480,height=700",
                  );
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
              >
                <Bot className="h-3.5 w-3.5" />
                AI
              </button>
              {onOpenTopSheet && (
                <button
                  type="button"
                  onClick={onOpenTopSheet}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  학생 컨텍스트
                </button>
              )}
              <button type="button" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 과목 네비게이션 스트립 (세특 전용) */}
        {activeKind === "setek" && subjectNavList && subjectNavList.length > 0 && (
          <SubjectNavStrip
            items={filteredSubjects}
            activeSubjectId={activeSubjectId ?? null}
            gradeFilter={gradeFilter}
            categoryFilter={categoryFilter}
            grades={availableGrades}
            onGradeChange={setGradeFilter}
            onCategoryChange={setCategoryFilter}
            onSubjectSelect={switchToSubject}
            onPrev={movePrev}
            onNext={moveNext}
            canPrev={currentIndex > 0}
            canNext={currentIndex >= 0 && currentIndex < filteredSubjects.length - 1}
            currentIndex={currentIndex}
            totalCount={filteredSubjects.length}
          />
        )}

        {/* 그리드 콘텐츠 */}
        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          {activeKind === "setek" && mergedRow ? (
            <ContextGrid
              row={mergedRow}
              selectedColumns={selectedColumns}
              onColumnsChange={handleColumnsChange}
              charLimit={charLimit}
              studentId={studentId}
              schoolYear={activeSchoolYear ?? 0}
              tenantId={tenantId}
              grade={grade}
              subjectTags={subjectTags}
              subjectGuides={filteredGuides}
              subjectDirection={filteredDirection}
              isDesignMode={isDesignMode}
            />
          ) : activeKind === "changche" && changcheRecord ? (
            <ContextGridChangche
              record={changcheRecord}
              activityType={changcheRecord.activity_type}
              selectedColumns={selectedColumns}
              onColumnsChange={handleColumnsChange}
              charLimit={nonSetekCharLimit}
              studentId={studentId}
              schoolYear={activeSchoolYear ?? 0}
              tenantId={tenantId}
              grade={changcheRecord.grade ?? 1}
              tags={nonSetekTags}
              guideAssignments={guideAssignments ?? []}
              guideItem={changcheGuideItems?.find(
                (g) => g.activityType === changcheRecord.activity_type && g.schoolYear === activeSchoolYear,
              )}
              isDesignMode={isDesignMode}
            />
          ) : activeKind === "haengteuk" ? (
            <ContextGridHaengteuk
              record={haengteukRecord}
              selectedColumns={selectedColumns}
              onColumnsChange={handleColumnsChange}
              charLimit={nonSetekCharLimit}
              studentId={studentId}
              schoolYear={activeSchoolYear ?? 0}
              tenantId={tenantId}
              grade={haengteukRecord?.grade ?? 1}
              tags={nonSetekTags}
              guideAssignments={guideAssignments ?? []}
              guideItem={haengteukGuideItems?.find((g) => g.schoolYear === activeSchoolYear)}
              isDesignMode={isDesignMode}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              {isRecordFetched ? (
                <>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {activeKind === "setek"
                      ? "이 학년의 세특 레코드가 없습니다"
                      : activeKind === "changche"
                        ? "이 학년의 창체 레코드가 없습니다"
                        : "레코드가 없습니다"}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    수강계획을 확정한 뒤 파이프라인을 실행하면 자동 생성됩니다
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-tertiary)]">데이터를 불러오는 중...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 간소화 레코드 뷰 (창체/행특용) ──

function SimplifiedRecordView({
  title,
  content,
  tags,
  charLimit,
  selectedColumns,
  draftContent,
  consultantContent,
  confirmedContent,
}: {
  title: string;
  content: string;
  tags: AnalysisTagLike[];
  charLimit: number;
  selectedColumns: GridColumnKey[];
  draftContent: string | null;
  consultantContent: string | null;
  confirmedContent: string | null;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedColumns.length}, 1fr)` }}>
        {selectedColumns.map((col) => (
          <div key={col} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{COL_LABELS[col]}</span>
            {col === "neis" && (
              <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                {content || <span className="text-[var(--text-placeholder)]">기록 없음</span>}
                {content && charLimit > 0 && (
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {content.length}자 / {charLimit}자
                  </p>
                )}
              </div>
            )}
            {col === "draft" && (
              <div className="flex flex-col gap-2 text-sm">
                {draftContent && (
                  <div className="rounded bg-violet-50 p-2 dark:bg-violet-900/20">
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-400">AI 초안</span>
                    <p className="mt-0.5 text-violet-600 dark:text-violet-300 line-clamp-4">{draftContent}</p>
                  </div>
                )}
                {consultantContent?.trim() && (
                  <div className="rounded bg-blue-50 p-2 dark:bg-blue-900/20">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">컨설턴트 가안</span>
                    <p className="mt-0.5 text-blue-600 dark:text-blue-300 line-clamp-4">{consultantContent}</p>
                  </div>
                )}
                {confirmedContent?.trim() && (
                  <div className="rounded bg-emerald-50 p-2 dark:bg-emerald-900/20">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">확정본</span>
                    <p className="mt-0.5 text-emerald-600 dark:text-emerald-300 line-clamp-4">{confirmedContent}</p>
                  </div>
                )}
                {!draftContent && !consultantContent?.trim() && !confirmedContent?.trim() && (
                  <span className="text-[var(--text-placeholder)]">가안 없음</span>
                )}
              </div>
            )}
            {col === "analysis" && (
              <div className="flex flex-wrap gap-1">
                {tags.length > 0 ? tags.map((t, i) => (
                  <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                    t.evaluation === "positive" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : t.evaluation === "negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                  )}>
                    {t.competency_item}
                  </span>
                )) : <span className="text-[var(--text-placeholder)]">태그 없음</span>}
              </div>
            )}
            {col === "guide" && (
              <span className="text-sm text-[var(--text-placeholder)]">가이드 데이터 없음</span>
            )}
            {col === "memo" && (
              <span className="text-sm text-[var(--text-placeholder)]">메모는 에디터에서 확인</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
