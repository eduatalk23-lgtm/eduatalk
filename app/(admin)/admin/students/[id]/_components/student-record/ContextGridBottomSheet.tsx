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
import { SubjectNavStrip } from "./SubjectNavStrip";
import { useStudentRecordContext } from "./StudentRecordContext";
import { recordTabQueryOptions, diagnosisTabQueryOptions } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import type { SetekLayerTab, MergedSetekRow, SetekGuideItemLike } from "./SetekEditor";
import type { AnalysisTagLike } from "./shared/AnalysisBlocks";
import type { SubjectNavItem } from "./StudentRecordClient";

// ─── 상수 ──

const DEFAULT_COLUMNS: SetekLayerTab[] = ["draft", "neis", "analysis"];
const MAX_COLUMNS = 3;
const SELECTABLE_COLS: SetekLayerTab[] = ["guide", "direction", "draft", "neis", "analysis", "memo"];
const COL_LABELS: Record<SetekLayerTab, string> = {
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
}

// ─── 메인 컴포넌트 ──

export function ContextGridBottomSheet({
  onOpenTopSheet,
  guideAssignments,
  setekGuideItems,
  subjectNavList,
}: ContextGridBottomSheetProps) {
  const ctx = useStudentRecordContext();
  const { activeSubjectId, activeSchoolYear, activeSubjectName, studentId, tenantId } = ctx;

  // 시트 표시 여부 (DOM 유지) vs 열림 상태 (애니메이션)
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // ─── localStorage 영속 상태 ──

  const [selectedColumns, setSelectedColumns] = useState<SetekLayerTab[]>(() =>
    readLS(LS_KEY_COLUMNS, DEFAULT_COLUMNS, (v) => {
      const parsed = JSON.parse(v) as SetekLayerTab[];
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

  const handleColumnsChange = useCallback((cols: SetekLayerTab[]) => {
    if (cols.length > MAX_COLUMNS) return;
    setSelectedColumns(cols);
  }, []);

  const handleColumnToggle = useCallback((col: SetekLayerTab) => {
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

  const { data: recordData } = useQuery(
    recordTabQueryOptions(studentId, activeSchoolYear ?? 0),
  );
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, activeSchoolYear ?? 0, tenantId),
  );

  // 선택된 과목의 세특 레코드
  const subjectRecords = useMemo(() => {
    if (!recordData?.seteks || !activeSubjectId) return [];
    return (recordData.seteks as RecordSetek[])
      .filter((s) => s.subject_id === activeSubjectId)
      .sort((a, b) => a.semester - b.semester);
  }, [recordData?.seteks, activeSubjectId]);

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

  const filteredGuides = useMemo(() => {
    if (!guideAssignments || !activeSubjectId) return [];
    return guideAssignments.filter((a) => a.target_subject_id === activeSubjectId);
  }, [guideAssignments, activeSubjectId]);

  const filteredDirection = useMemo(() => {
    if (!setekGuideItems || !activeSubjectName) return [];
    return setekGuideItems.filter((g) => g.subjectName === activeSubjectName);
  }, [setekGuideItems, activeSubjectName]);

  const charLimit = getCharLimit("setek", activeSchoolYear ?? 0);
  const grade = subjectRecords[0]?.grade ?? 1;

  if (!visible) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={close}
      />

      {/* 바텀시트 */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out dark:border-gray-700 dark:bg-gray-900",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ height: "80vh" }}
      >
        {/* 헤더: 열 선택(좌~중앙) | 학생컨텍스트+닫기(우) */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-2 pb-2 dark:border-gray-800">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2">
            {/* 열 선택 */}
            <div className="flex flex-1 items-center gap-1.5">
              {SELECTABLE_COLS.map((col) => {
                const active = selectedColumns.includes(col);
                const disabled = !active && selectedColumns.length >= MAX_COLUMNS;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleColumnToggle(col)}
                    disabled={disabled}
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-2.5 py-1 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : disabled
                          ? "bg-gray-50 text-gray-300 cursor-not-allowed dark:bg-gray-900 dark:text-gray-600"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {COL_LABELS[col]}
                  </button>
                );
              })}
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
                    `/admin/agent-popout?${params.toString()}`,
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

        {/* 과목 네비게이션 스트립 */}
        {subjectNavList && subjectNavList.length > 0 && (
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
          {mergedRow ? (
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
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">데이터를 불러오는 중...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
