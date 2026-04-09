"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentSwitcher } from "@/app/(admin)/admin/calendar/_components/StudentSwitcher";
import { TopBarCenterSlotPortal } from "@/components/layout/TopBarCenterSlotContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Menu, ChevronDown, ChevronUp } from "lucide-react";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { RecordLayoutShell } from "./RecordLayoutShell";
import { SidePanelProvider } from "@/components/side-panel";
import { StudentRecordProvider } from "./StudentRecordContext";
import { GlobalLayerBar } from "./GlobalLayerBar";
import {
  type LayerKey,
  type LayerPerspective,
  layerToLegacyTab,
  getDefaultPerspective,
} from "@/lib/domains/student-record/layer-view";
import { ContextGridBottomSheet } from "./ContextGridBottomSheet";
import { ContextTopSheet } from "./ContextTopSheet";
import { RecordSidePanelContainer } from "./side-panel/RecordSidePanelContainer";
import { AgentUIBridgeProvider } from "./AgentUIBridge";
import type { UIStateSnapshot } from "@/lib/agents/ui-state";
import type { AgentAction } from "@/lib/agents/agent-actions";
import { RecordYearSelector } from "./RecordYearSelector";
import { ImportDialog } from "./ImportDialog";
import { CareerProfilePanel } from "./CareerProfilePanel";
import { RecordStageContent } from "./stages/record/RecordStageContent";
import { DiagnosisStageContent } from "./stages/diagnosis/DiagnosisStageContent";
import { DesignStageContent } from "./stages/design/DesignStageContent";
import { StrategyStageContent } from "./stages/strategy/StrategyStageContent";
import { RecordSidebar } from "./RecordSidebar";
import { useStudentRecordOverview } from "./useStudentRecordOverview";
import { useRecordStageData } from "./stages/record/useRecordStageData";
import { useDiagnosisStageData } from "./stages/diagnosis/useDiagnosisStageData";
import { useDesignStageData } from "./stages/design/useDesignStageData";
import { useStrategyStageData } from "./stages/strategy/useStrategyStageData";
import { classifySubjectId } from "./stages/record/GradesAndSetekSection";
import { STAGES } from "./recordStages";
import type { StageId } from "./recordStages";
import { User } from "lucide-react";

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
};

export type SubjectNavItem = {
  subjectId: string;
  subjectName: string;
  grade: number;
  schoolYear: number;
  category: "general" | "elective" | "pe_art" | "liberal";
};

type StudentRecordClientProps = {
  studentId: string;
  tenantId: string;
  subjects: Subject[];
  initialSchoolYear: number;
  studentGrade: number;
  studentName?: string;
  schoolName?: string;
  studentClass?: string;
  studentNumber?: string;
  curriculumRevisionId?: string;
  curriculumYear?: number;
};

// ─── 메인 컴포넌트 ─────────────────────────────────────

export function StudentRecordClient({
  studentId,
  tenantId,
  subjects,
  initialSchoolYear,
  studentGrade,
  studentName,
  schoolName,
  studentClass,
  studentNumber,
  curriculumRevisionId,
  curriculumYear,
}: StudentRecordClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"all" | number>("all");
  // Phase 2.1: 9 레이어 × 2 관점 state (레거시 4탭은 layerToLegacyTab 매핑으로 변환)
  const [globalLayer, setGlobalLayer] = useState<LayerKey>("neis");
  const [globalPerspective, setGlobalPerspective] = useState<LayerPerspective | null>(null);

  // 레거시 4탭 호환 — 기존 에디터들에 전달
  const globalSetekTab = useMemo<import("./stages/record/SetekEditor").SetekLayerTab>(
    () => layerToLegacyTab(globalLayer) ?? "neis",
    [globalLayer],
  );

  const handleLayerChange = useCallback((layer: LayerKey) => {
    setGlobalLayer(layer);
    setGlobalPerspective(getDefaultPerspective(layer));
  }, []);
  const [importOpen, setImportOpen] = useState(false);
  const [topSheetOpen, setTopSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("sec-1");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // ─── Phase 4: 5개 분리 훅 ────────────────────────────
  const {
    warnings, progressCounts, pipelineData, isPipelineRunning,
  } = useStudentRecordOverview({ studentId, studentGrade, initialSchoolYear });

  const {
    yearGradePairs, recordByGrade, suppByGrade,
    anyRecordLoading, anySuppLoading,
    allRecordFailed, allSuppFailed, firstRecordError,
    mergedReadings, allRecordSummaries,
    setekGuidesRes,
    transformedSetekGuideItems, transformedChangcheGuideItems, transformedHaengteukGuideItems,
  } = useRecordStageData({ studentId, studentGrade, subjects });

  const {
    diagnosisData, diagnosisLoading, diagnosisError,
  } = useDiagnosisStageData({ studentId, tenantId, initialSchoolYear, yearGradePairs });

  const {
    storylineData, storylineLoading, storylineError,
    coursePlanData,
  } = useDesignStageData({ studentId, initialSchoolYear });

  const {
    strategyData, strategyLoading, strategyError,
    scorePanelData, scorePanelLoading,
  } = useStrategyStageData({ studentId, initialSchoolYear });

  const allFailed = allRecordFailed && allSuppFailed && !!storylineError && !!strategyError;
  const firstError = allFailed ? (firstRecordError ?? storylineError ?? strategyError) : null;

  // ─── viewMode에 따른 visible pairs ────────────────
  const visiblePairs = useMemo(() => {
    if (viewMode === "all") return yearGradePairs;
    return yearGradePairs.filter((p) => p.schoolYear === viewMode);
  }, [viewMode, yearGradePairs]);

  // ─── 바텀시트 과목 네비게이션 리스트 ────────────────
  const subjectNavList = useMemo<SubjectNavItem[]>(() => {
    const items: SubjectNavItem[] = [];
    const seen = new Set<string>();
    for (const [, entry] of recordByGrade) {
      for (const setek of entry.data.seteks) {
        const key = `${entry.grade}:${setek.subject_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const subj = subjects.find((s) => s.id === setek.subject_id);
        items.push({
          subjectId: setek.subject_id,
          subjectName: subj?.name ?? "알 수 없는 과목",
          grade: entry.grade,
          schoolYear: entry.schoolYear,
          category: classifySubjectId(setek.subject_id, subjects),
        });
      }
    }
    return items.sort((a, b) => a.grade - b.grade || a.subjectName.localeCompare(b.subjectName, "ko"));
  }, [recordByGrade, subjects]);

  // ─── 전학년 합산 supplementary ────────────────────
  const mergedSupplementary = useMemo(() => {
    const awards: NonNullable<ReturnType<typeof suppByGrade.get>>["data"]["awards"] = [];
    const volunteer: NonNullable<ReturnType<typeof suppByGrade.get>>["data"]["volunteer"] = [];
    const disciplinary: NonNullable<ReturnType<typeof suppByGrade.get>>["data"]["disciplinary"] = [];
    const applications: NonNullable<ReturnType<typeof suppByGrade.get>>["data"]["applications"] = [];
    const interviewConflicts: NonNullable<ReturnType<typeof suppByGrade.get>>["data"]["interviewConflicts"] = [];
    for (const p of visiblePairs) {
      const entry = suppByGrade.get(p.grade);
      if (!entry) continue;
      awards.push(...entry.data.awards);
      volunteer.push(...entry.data.volunteer);
      disciplinary.push(...entry.data.disciplinary);
      applications.push(...entry.data.applications);
      interviewConflicts.push(...entry.data.interviewConflicts);
    }
    return { awards, volunteer, disciplinary, applications, interviewConflicts };
  }, [visiblePairs, suppByGrade]);

  // ─── 진단 탭용 필터링 ────────────────────────────
  const currentYearTagIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rec of allRecordSummaries) ids.add(rec.id);
    return ids;
  }, [allRecordSummaries]);

  const filteredActivityTags = useMemo(() => {
    const allTags = diagnosisData?.activityTags ?? [];
    if (currentYearTagIds.size === 0) return allTags;
    return allTags.filter((t) => currentYearTagIds.has(t.record_id));
  }, [diagnosisData?.activityTags, currentYearTagIds]);

  // ─── 현재 스테이지 계산 ──────────────────────────
  const activeStage = useMemo<StageId>(() => {
    for (const stage of STAGES) {
      if (stage.sections.some((s) => s.id === activeSection)) return stage.id;
    }
    return "record";
  }, [activeSection]);

  // ─── stageCompletions (탭 바 미니 바용) ─────────
  const stageCompletions = useMemo<Record<string, number>>(() => {
    const { recordFilled, recordTotal, diagnosisFilled, designFilled, strategyFilled } = progressCounts;
    return {
      record: recordTotal > 0 ? Math.round((recordFilled / recordTotal) * 100) : 0,
      diagnosis: Math.round((diagnosisFilled / 1) * 100),
      design: Math.round((designFilled / 7) * 100),
      strategy: Math.round((strategyFilled / 6) * 100),
    };
  }, [progressCounts]);

  // ─── IntersectionObserver ─────────────────────────
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const sectionEls = container.querySelectorAll<HTMLElement>("[data-section-id]");
    if (sectionEls.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) {
          const id = (topEntry.target as HTMLElement).dataset.sectionId;
          if (id) setActiveSection(id);
        }
      },
      { root: container, rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [anyRecordLoading, anySuppLoading, storylineLoading, strategyLoading, viewMode]);

  // ─── TOC 클릭 → 스크롤 ───────────────────────────
  const scrollToSection = useCallback((sectionId: string) => {
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-section-id="${sectionId}"]`);
    if (target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: offset, behavior: "smooth" });
      setActiveSection(sectionId);
    }
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  // ─── 빠른 섹션 이동 (Alt+↑/↓) ─────────────────
  const allSectionIds = useMemo(() => STAGES.flatMap((s) => s.sections.map((sec) => sec.id)), []);

  const jumpPrev = useCallback(() => {
    const idx = allSectionIds.indexOf(activeSection);
    if (idx > 0) scrollToSection(allSectionIds[idx - 1]);
  }, [activeSection, allSectionIds, scrollToSection]);

  const jumpNext = useCallback(() => {
    const idx = allSectionIds.indexOf(activeSection);
    if (idx < allSectionIds.length - 1) scrollToSection(allSectionIds[idx + 1]);
  }, [activeSection, allSectionIds, scrollToSection]);

  const scrollToStageFirst = useCallback((stageId: string) => {
    const stage = STAGES.find((s) => s.id === stageId);
    if (stage && stage.sections.length > 0) scrollToSection(stage.sections[0].id);
  }, [scrollToSection]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); jumpPrev(); }
      if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); jumpNext(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [jumpPrev, jumpNext]);

  // ─── 활성 과목 상태 (세특 레이어 탭 ↔ 사이드 패널) ──
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState<number | null>(null);
  const [activeSubjectName, setActiveSubjectName] = useState<string | null>(null);

  // ─── 탐구 가이드 배정 쿼리 (viewMode 의존) ────────
  const guideSchoolYear = viewMode === "all" ? undefined : viewMode;
  const { data: guideAssignmentsRes } = useQuery({
    queryKey: ["explorationGuide", "assignments", studentId, guideSchoolYear ?? "all"],
    queryFn: () => import("@/lib/domains/guide/actions/assignment").then((m) => m.fetchAssignedGuidesAction(studentId, guideSchoolYear)),
    staleTime: 60_000,
    enabled: !!studentId,
  });
  const assignmentIds = useMemo(
    () => (guideAssignmentsRes?.success && guideAssignmentsRes.data ? guideAssignmentsRes.data.map((a) => a.id) : []),
    [guideAssignmentsRes],
  );
  const { data: fileCountsRes } = useQuery({
    queryKey: ["explorationGuide", "fileCounts", assignmentIds],
    queryFn: () => import("@/lib/domains/guide/actions/deliverable").then((m) => m.getAssignmentFileCountsAction(assignmentIds)),
    staleTime: 60_000,
    enabled: assignmentIds.length > 0,
  });
  void fileCountsRes; // 현재 미사용, 향후 활용

  // ─── Agent UI Bridge ───────────────────────────────
  const getAgentSnapshot = useCallback((): UIStateSnapshot => ({
    activeLayerTab: globalSetekTab,
    viewMode,
    activeSection,
    activeStage,
    focusedSubject: activeSubjectId
      ? { subjectId: activeSubjectId, subjectName: activeSubjectName ?? "", schoolYear: activeSchoolYear ?? 0 }
      : null,
    sidePanelApp: null,
    bottomSheetOpen: !!activeSubjectId,
    topSheetOpen,
  }), [globalSetekTab, viewMode, activeSection, activeStage, activeSubjectId, activeSubjectName, activeSchoolYear, topSheetOpen]);

  const dispatchAgentAction = useCallback((action: AgentAction) => {
    switch (action.type) {
      case "navigate_section":
        scrollToSection(action.sectionId);
        break;
      case "navigate_tab": {
        // 레거시 4탭 → 9 레이어 역매핑 (Phase 2.1 후방 호환)
        const tab = action.tab as typeof globalSetekTab;
        const layerMap: Record<typeof tab, LayerKey> = {
          neis: "neis",
          draft: "draft",
          analysis: "analysis",
          direction: "improve_direction", // direction 탭은 보완방향으로 매핑
        };
        handleLayerChange(layerMap[tab]);
        break;
      }
      case "focus_subject": {
        const found = subjects.find((s) => s.name === action.subjectName);
        if (found) {
          setActiveSubjectId(found.id);
          setActiveSchoolYear(action.schoolYear);
          setActiveSubjectName(found.name);
        }
        break;
      }
      case "change_view_mode":
        setViewMode(action.viewMode);
        break;
      case "open_side_panel":
        break;
    }
  }, [scrollToSection, subjects]);

  const agentUIBridgeValue = useMemo(() => ({
    getSnapshot: getAgentSnapshot,
    dispatchAction: dispatchAgentAction,
  }), [getAgentSnapshot, dispatchAgentAction]);

  // ─── BroadcastChannel: 팝아웃 에이전트 윈도우 동기화 ──
  useEffect(() => {
    try {
      const snapshot = getAgentSnapshot();
      const ch = new BroadcastChannel("agent-ui-state");
      ch.postMessage(snapshot);
      ch.close();
    } catch { /* BroadcastChannel 미지원 환경 무시 */ }
  }, [getAgentSnapshot]);

  useEffect(() => {
    try {
      const ch = new BroadcastChannel("agent-ui-action");
      ch.onmessage = (e: MessageEvent) => {
        if (e.data && typeof e.data === "object" && typeof e.data.type === "string") {
          dispatchAgentAction(e.data as AgentAction);
        }
      };
      return () => ch.close();
    } catch { /* BroadcastChannel 미지원 환경 무시 */ }
  }, [dispatchAgentAction]);

  // ─── 전체 실패 시 에러 화면 ────────────────────────
  if (allFailed) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          데이터를 불러오는 중 오류가 발생했습니다: {(firstError as Error)?.message ?? "알 수 없는 에러"}
        </div>
      </div>
    );
  }

  // 헤더 표시용 텍스트
  const headerSubtitle = viewMode === "all"
    ? `${studentName ?? "학생"} · 전체 학년`
    : (() => {
        const pair = yearGradePairs.find((p) => p.schoolYear === viewMode);
        return pair ? `${pair.schoolYear}학년도 · ${studentName ?? "학생"} (${pair.grade}학년)` : "";
      })();

  return (
    <StudentRecordProvider value={{ studentId, tenantId, studentName, studentGrade, initialSchoolYear, schoolName, curriculumRevisionId, curriculumYear, subjects, activeSubjectId, setActiveSubjectId, activeSchoolYear, setActiveSchoolYear, activeSubjectName, setActiveSubjectName, scrollToSection, hasTargetMajor: !!diagnosisData?.targetMajor }}>
    <SidePanelProvider storageKey="recordSidePanelApp">
    <AgentUIBridgeProvider value={agentUIBridgeValue}>
    <TopBarCenterSlotPortal>
      <div className="contents">
        <div className="flex flex-1 items-center justify-center gap-2 order-2">
          <GlobalLayerBar
            layer={globalLayer}
            perspective={globalPerspective}
            onLayerChange={handleLayerChange}
            onPerspectiveChange={setGlobalPerspective}
          />
        </div>
        <div className="order-4 ml-auto">
          <StudentSwitcher
            currentStudentId={studentId}
            currentStudentName={studentName ?? null}
            onSelect={(id) => router.push(`/admin/students/${id}/record`)}
          />
        </div>
      </div>
    </TopBarCenterSlotPortal>
    <RecordLayoutShell
      sidebar={
        <RecordSidebar
          stages={STAGES}
          activeSection={activeSection}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          studentGrade={studentGrade}
          studentId={studentId}
          progressCounts={progressCounts}
          scrollToSection={scrollToSection}
          onImportOpen={() => setImportOpen(true)}
        />
      }
      isSidebarOpen={sidebarOpen}
      onToggleSidebar={toggleSidebar}
      rightPanel={<RecordSidePanelContainer />}
    >
      {/* ─── 스테이지 탭 바 ────────────────────────── */}
      <div className="hidden shrink-0 border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-4 md:flex">
        {STAGES.map((stage) => {
          const completion = stageCompletions[stage.id] ?? 0;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                const firstSection = stage.sections[0]?.id;
                if (firstSection) scrollToSection(firstSection);
              }}
              className={cn(
                "inline-flex flex-col items-center gap-0.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                activeStage === stage.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span>{stage.emoji}</span>
                {stage.label}
              </span>
              <div className="h-0.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-indigo-400 transition-all duration-500" style={{ width: `${completion}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── 메인 문서 스크롤 영역 ────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* 브레드크럼 (데스크톱) */}
        {(() => {
          const currentStage = STAGES.find((s) => s.sections.some((sec) => sec.id === activeSection));
          const sectionIndex = currentStage?.sections.findIndex((s) => s.id === activeSection) ?? 0;
          const totalSections = currentStage?.sections.length ?? 0;
          return (
            <div className="sticky top-0 z-20 hidden items-center gap-1.5 border-b border-[var(--border-secondary)] bg-[var(--background)]/95 px-4 py-1 backdrop-blur md:flex">
              <select
                value={currentStage?.id ?? "record"}
                onChange={(e) => scrollToStageFirst(e.target.value)}
                className="rounded border border-[var(--border-primary)] bg-transparent px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
              </select>
              <span className="text-[var(--text-tertiary)]">›</span>
              <select
                value={activeSection}
                onChange={(e) => scrollToSection(e.target.value)}
                className="rounded border border-[var(--border-primary)] bg-transparent px-2 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {currentStage?.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.number ? `${sec.number}. ` : ""}{sec.label}</option>
                ))}
              </select>
              <span className="text-xs text-[var(--text-placeholder)]">({sectionIndex + 1}/{totalSections})</span>
              <button type="button" onClick={jumpPrev} className="rounded p-0.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]" title="이전 섹션 (Alt+↑)">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={jumpNext} className="rounded p-0.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]" title="다음 섹션 (Alt+↓)">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <span className="ml-auto text-xs text-[var(--text-placeholder)]">Alt+↑↓</span>
            </div>
          );
        })()}

        {/* 모바일 상단 컨트롤 */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border-secondary)] bg-[var(--background)]/95 px-4 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            aria-label="목차 열기"
          >
            <Menu className="size-5" />
          </button>
          <RecordYearSelector value={viewMode} onChange={setViewMode} studentGrade={studentGrade} />
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="ml-auto rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            PDF 가져오기
          </button>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          {/* ─── 문서 헤더 ────────────────────────── */}
          <div className="mb-6 border-b-2 border-gray-400 pb-3 text-center dark:border-gray-300">
            <h1 className="text-xl font-bold tracking-wide text-[var(--text-primary)] md:text-2xl">
              학 교 생 활 기 록 부
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{headerSubtitle}</p>
          </div>

          {/* ─── 학반정보 + 사진 영역 ────────────── */}
          <div className="mb-6 flex items-stretch gap-4">
            <div className="flex-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={5} className="border border-gray-400 px-3 py-1 text-left text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
                      졸업 대장 번호
                    </th>
                  </tr>
                  <tr>
                    <th className="border border-gray-400 px-4 py-1.5 text-center text-xs font-medium dark:border-gray-500">학년</th>
                    <th className="border border-gray-400 px-4 py-1.5 text-center text-xs font-medium dark:border-gray-500">학과</th>
                    <th className="border border-gray-400 px-4 py-1.5 text-center text-xs font-medium dark:border-gray-500">반</th>
                    <th className="border border-gray-400 px-4 py-1.5 text-center text-xs font-medium dark:border-gray-500">번호</th>
                    <th className="border border-gray-400 px-4 py-1.5 text-center text-xs font-medium dark:border-gray-500">담임성명</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map((p) => {
                    const att = recordByGrade.get(p.grade)?.data.schoolAttendance as Record<string, unknown> | null | undefined;
                    const teacherName = (att?.homeroom_teacher as string) ?? "";
                    const className = (att?.class_name as string) ?? (p.grade === studentGrade ? (studentClass ?? "") : "");
                    const studentNum = (att?.student_number as string) ?? (p.grade === studentGrade ? (studentNumber ?? "") : "");
                    return (
                      <tr key={p.grade}>
                        <td className="border border-gray-400 px-4 py-1.5 text-center dark:border-gray-500">{p.grade}</td>
                        <td className="border border-gray-400 px-4 py-1.5 text-center dark:border-gray-500">-</td>
                        <td className="border border-gray-400 px-4 py-1.5 text-center dark:border-gray-500">{className || "-"}</td>
                        <td className="border border-gray-400 px-4 py-1.5 text-center dark:border-gray-500">{studentNum || "-"}</td>
                        <td className="border border-gray-400 px-4 py-1.5 text-center dark:border-gray-500">{teacherName || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="hidden shrink-0 sm:block">
              <div className="flex h-full w-[120px] items-center justify-center border border-gray-400 bg-gray-50 dark:border-gray-500 dark:bg-gray-800">
                <User className="size-12 text-gray-300 dark:text-gray-600" />
              </div>
            </div>
          </div>

          {/* ─── 진로/대학 프로필 패널 (항상 표시) ─── */}
          {!diagnosisLoading && diagnosisData && (
            <CareerProfilePanel
              studentId={studentId}
              tenantId={tenantId}
              currentCareerField={diagnosisData.careerField ?? null}
              currentTargetMajor={diagnosisData.targetMajor ?? null}
              currentSubClassificationName={diagnosisData.targetSubClassificationName ?? null}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: studentRecordKeys.all })}
            />
          )}

          {/* ─── 온보딩 체크리스트 ───────────────── */}
          {diagnosisData?.targetMajor && (() => {
            const hasCoursePlan = (coursePlanData?.plans?.length ?? 0) > 0;
            const hasStoryline = (storylineData?.storylines?.length ?? 0) > 0;
            const hasRoadmap = (storylineData?.roadmapItems?.length ?? 0) > 0;
            const hasGuide = (setekGuidesRes?.success && (setekGuidesRes.data?.length ?? 0) > 0);
            const totalRecords = [...recordByGrade.values()].reduce((sum, d) => {
              return sum + (d.data.seteks?.length ?? 0) + (d.data.changche?.length ?? 0);
            }, 0);
            const steps = [
              { done: true, label: "진로 설정", section: null },
              { done: hasCoursePlan, label: "수강 계획", section: "sec-course-plan" },
              { done: hasStoryline, label: "스토리라인", section: "sec-storyline" },
              { done: hasRoadmap, label: "로드맵", section: "sec-roadmap" },
              { done: hasGuide, label: "세특 방향", section: "sec-setek-guide" },
            ];
            const doneCount = steps.filter((s) => s.done).length;
            if (doneCount >= 5 || totalRecords >= 5) return null;
            return (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/20">
                <p className="mb-2 text-xs font-medium text-indigo-700 dark:text-indigo-400">컨설팅 준비 ({doneCount}/5)</p>
                <div className="flex gap-1">
                  {steps.map((step) => (
                    <button
                      key={step.label}
                      type="button"
                      onClick={() => {
                        if (step.section) {
                          document.querySelector(`[data-section-id='${step.section}']`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      disabled={!step.section}
                      className={cn(
                        "flex-1 rounded px-2 py-1.5 text-xs font-medium transition",
                        step.done
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700",
                      )}
                    >
                      {step.done ? "✓ " : ""}{step.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─── 기록 스테이지 (생기부 모형 항상 유지) ───────────────────── */}
          <RecordStageContent
            subjects={subjects}
            visiblePairs={visiblePairs}
            recordByGrade={recordByGrade}
            anyRecordLoading={anyRecordLoading}
            anySuppLoading={anySuppLoading}
            mergedSupplementary={mergedSupplementary}
            mergedReadings={mergedReadings}
            diagnosisData={diagnosisData}
            coursePlanData={coursePlanData}
            globalSetekTab={globalSetekTab}
            onSetekTabChange={(tab) => {
              // 레거시 4탭 → 9 레이어 역매핑
              const layerMap: Record<typeof tab, LayerKey> = {
                neis: "neis",
                draft: "draft",
                analysis: "analysis",
                direction: "improve_direction",
              };
              handleLayerChange(layerMap[tab]);
            }}
            globalLayer={globalLayer}
            globalPerspective={globalPerspective}
            guideAssignments={guideAssignmentsRes?.success ? guideAssignmentsRes.data as Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }> : undefined}
            setekGuideItems={transformedSetekGuideItems}
            changcheGuideItems={transformedChangcheGuideItems}
            haengteukGuideItems={transformedHaengteukGuideItems}
          />

          {/* ─── 진단 스테이지 ───────────────────── */}
          <DiagnosisStageContent
            diagnosisData={diagnosisData}
            diagnosisLoading={diagnosisLoading}
            anyRecordLoading={anyRecordLoading}
            filteredActivityTags={filteredActivityTags}
            allRecordSummaries={allRecordSummaries}
            currentYearTagIds={currentYearTagIds}
            recordByGrade={recordByGrade}
            isPipelineRunning={isPipelineRunning}
            warnings={warnings}
          />

          {/* ─── 설계 스테이지 ───────────────────── */}
          <DesignStageContent
            diagnosisData={diagnosisData}
            diagnosisLoading={diagnosisLoading}
            storylineData={storylineData}
            storylineLoading={storylineLoading}
            allRecordSummaries={allRecordSummaries}
            pipelineData={pipelineData}
          />

          {/* ─── 전략 스테이지 ───────────────────── */}
          <StrategyStageContent
            strategyData={strategyData}
            strategyLoading={strategyLoading}
            anySuppLoading={anySuppLoading}
            mergedApplications={{ applications: mergedSupplementary.applications, interviewConflicts: mergedSupplementary.interviewConflicts }}
            allRecordSummaries={allRecordSummaries}
            scorePanelData={scorePanelData}
            scorePanelLoading={scorePanelLoading}
          />

          <div className="h-24" />
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        studentId={studentId}
        tenantId={tenantId}
        subjects={subjects}
        onImportComplete={() => scrollToSection("sec-diagnosis-analysis")}
      />
    </RecordLayoutShell>
    <ContextGridBottomSheet
      onOpenTopSheet={() => setTopSheetOpen(true)}
      guideAssignments={guideAssignmentsRes?.success ? guideAssignmentsRes.data as Array<{ id: string; status: string; target_subject_id?: string | null; exploration_guides?: { id: string; title: string; guide_type?: string } }> : undefined}
      setekGuideItems={transformedSetekGuideItems}
      subjectNavList={subjectNavList}
      changcheGuideItems={transformedChangcheGuideItems}
      haengteukGuideItems={transformedHaengteukGuideItems}
    />
    <ContextTopSheet
      isOpen={topSheetOpen}
      onClose={() => setTopSheetOpen(false)}
      studentGrade={studentGrade}
      initialSchoolYear={initialSchoolYear}
    />
    </AgentUIBridgeProvider>
    </SidePanelProvider>
    </StudentRecordProvider>
  );
}
