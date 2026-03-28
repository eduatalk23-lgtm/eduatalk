"use client";

import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentSwitcher } from "@/app/(admin)/admin/calendar/_components/StudentSwitcher";
import { TopBarCenterSlotPortal } from "@/components/layout/TopBarCenterSlotContext";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";
import { Menu, User, ChevronDown, FileText, ClipboardList, Search, Compass, Target } from "lucide-react";
import type { RecordSetek, RecordPersonalSetek } from "@/lib/domains/student-record";
import {
  recordTabQueryOptions,
  storylineTabQueryOptions,
  supplementaryTabQueryOptions,
  strategyTabQueryOptions,
  diagnosisTabQueryOptions,
  coursePlanTabQueryOptions,
  pipelineStatusQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import { RecordLayoutShell } from "./RecordLayoutShell";
import { SidePanelProvider } from "@/components/side-panel";
import { StudentRecordProvider } from "./StudentRecordContext";
import { GlobalLayerBar } from "./GlobalLayerBar";
import { ContextGridBottomSheet } from "./ContextGridBottomSheet";
import { ContextTopSheet } from "./ContextTopSheet";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { RecordSidePanelContainer } from "./side-panel/RecordSidePanelContainer";
import { RecordYearSelector } from "./RecordYearSelector";
import { SetekEditor } from "./SetekEditor";
import { ChangcheEditor } from "./ChangcheEditor";
import { HaengteukEditor } from "./HaengteukEditor";
import { ReadingEditor } from "./ReadingEditor";
import { PersonalSetekEditor } from "./PersonalSetekEditor";
import { AttendanceEditor, AttendanceTableHeader } from "./AttendanceEditor";
import { StorylineManager } from "./StorylineManager";
import { InquiryLinkSuggestions } from "./InquiryLinkSuggestions";
import { RecordWarningPanel } from "./RecordWarningPanel";
import { InterviewQuestionPanel } from "./InterviewQuestionPanel";
import { computeWarnings } from "@/lib/domains/student-record/warnings/engine";
import type { WarningCheckInput } from "@/lib/domains/student-record/warnings/engine";
import { StorylineTimeline } from "./StorylineTimeline";
import { RoadmapEditor } from "./RoadmapEditor";
import { ApplicationBoard } from "./ApplicationBoard";
import { SupplementaryEditor } from "./SupplementaryEditor";
import { MinScorePanel } from "./MinScorePanel";
import { ImportDialog } from "./ImportDialog";
import { RecordGradesDisplay } from "./RecordGradesDisplay";
import { CompetencyAnalysisSection } from "./CompetencyAnalysisSection";
import { CrossReferenceChips } from "./CrossReferenceChips";
import { SameSchoolSetekInfo } from "./SameSchoolSetekInfo";
import { DiagnosisComparisonView } from "./DiagnosisComparisonView";
import { CourseAdequacyDisplay } from "./CourseAdequacyDisplay";
import { StrategyEditor as StrategyEditorPanel } from "./StrategyEditor";
import { PlacementDashboard } from "./PlacementDashboard";
import { AllocationSimulator } from "./AllocationSimulator";
import { AlumniSearch } from "./AlumniSearch";
const ActivitySummaryPanel = lazy(() => import("./ActivitySummaryPanel").then((m) => ({ default: m.ActivitySummaryPanel })));
const SetekGuidePanel = lazy(() => import("./SetekGuidePanel").then((m) => ({ default: m.SetekGuidePanel })));
import { CareerSetupBanner } from "./CareerSetupBanner";
const ExplorationGuidePanel = lazy(() => import("./ExplorationGuidePanel").then((m) => ({ default: m.ExplorationGuidePanel })));
const BypassMajorPanel = lazy(() => import("./BypassMajorPanel").then((m) => ({ default: m.BypassMajorPanel })));
import { PipelineSidebarWidget } from "./PipelineSidebarWidget";
import { DesignPipelineResultsPanel } from "./DesignPipelineResultsPanel";

const CoursePlanEditor = lazy(() => import("./CoursePlanEditor"));

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
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
};

// ─── TOC 섹션 정의 ────────────────────────────────────

type TocItem = {
  id: string;
  label: string;
  number?: string;
  indent?: boolean;
};

// ─── 4단계 사이드바 그룹 ──────────────────────────────

type StageId = "record" | "diagnosis" | "design" | "strategy";

type StageConfig = {
  id: StageId;
  emoji: string;
  label: string;
  hasYearSelector: boolean;
  sections: TocItem[];
};

const STAGES: StageConfig[] = [
  {
    id: "record",
    emoji: "📋",
    label: "기록",
    hasYearSelector: true,
    sections: [
      { id: "sec-1", number: "1", label: "인적·학적사항" },
      { id: "sec-2", number: "2", label: "출결상황" },
      { id: "sec-3", number: "3", label: "수상경력" },
      { id: "sec-4", number: "4", label: "자격증 및 인증" },
      { id: "sec-5", number: "5", label: "학교폭력 조치사항" },
      { id: "sec-6", number: "6", label: "창의적 체험활동" },
      { id: "sec-6-volunteer", label: "봉사활동실적", indent: true },
      { id: "sec-7", number: "7", label: "교과학습발달" },
      { id: "sec-7-grades", label: "성적", indent: true },
      { id: "sec-7-setek", label: "세특", indent: true },
      { id: "sec-7-personal", label: "개인세특", indent: true },
      { id: "sec-8", number: "8", label: "독서활동" },
      { id: "sec-9", number: "9", label: "행동특성 및 종합의견" },
    ],
  },
  {
    id: "diagnosis",
    emoji: "🔍",
    label: "진단",
    hasYearSelector: true,
    sections: [
      { id: "sec-diagnosis-analysis", label: "역량 분석" },
      { id: "sec-diagnosis-crossref", label: "교차 분석" },
      { id: "sec-diagnosis-overall", label: "종합진단" },
      { id: "sec-diagnosis-adequacy", label: "교과이수적합" },
      { id: "sec-warnings", label: "경보" },
    ],
  },
  {
    id: "design",
    emoji: "📐",
    label: "설계",
    hasYearSelector: false,
    sections: [
      { id: "sec-pipeline-results", label: "AI 분석 결과" },
      { id: "sec-course-plan", label: "수강 계획" },
      { id: "sec-storyline", label: "스토리라인" },
      { id: "sec-roadmap", label: "로드맵" },
      { id: "sec-compensation", label: "보완전략" },
      { id: "sec-activity-summary", label: "활동 요약서" },
      { id: "sec-setek-guide", label: "세특 방향 가이드" },
      { id: "sec-exploration-guide", label: "활동 가이드" },
      { id: "sec-bypass-major", label: "우회학과" },
    ],
  },
  {
    id: "strategy",
    emoji: "🎯",
    label: "전략",
    hasYearSelector: false,
    sections: [
      { id: "sec-applications", label: "지원현황" },
      { id: "sec-minscore", label: "최저시뮬" },
      { id: "sec-placement", label: "배치 분석" },
      { id: "sec-allocation", label: "배분 시뮬" },
      { id: "sec-interview", label: "면접 질문" },
      { id: "sec-alumni", label: "졸업생 DB" },
    ],
  },
];

/** 모든 섹션 ID 플랫 목록 (IntersectionObserver용) */
const ALL_SECTION_IDS = STAGES.flatMap((s) => s.sections.map((sec) => sec.id));

// ─── 학년-연도 쌍 타입 ──────────────────────────────────

type GradeYearPair = {
  grade: number;
  schoolYear: number;
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
}: StudentRecordClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"all" | number>("all");
  const [globalSetekTab, setGlobalSetekTab] = useState<import("./SetekEditor").SetekLayerTab>("neis");
  const [importOpen, setImportOpen] = useState(false);
  const [topSheetOpen, setTopSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("sec-1");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const currentSchoolYear = calculateSchoolYear();

  // ─── 학년-연도 쌍 계산 ───────────────────────────────
  const yearGradePairs = useMemo<GradeYearPair[]>(() => {
    const pairs: GradeYearPair[] = [];
    for (let g = 1; g <= studentGrade; g++) {
      const sy = gradeToSchoolYear(g, studentGrade, currentSchoolYear);
      pairs.push({ grade: g, schoolYear: sy });
    }
    return pairs;
  }, [studentGrade, currentSchoolYear]);

  // viewMode에 따른 visible grades
  const visiblePairs = useMemo(() => {
    if (viewMode === "all") return yearGradePairs;
    return yearGradePairs.filter((p) => p.schoolYear === viewMode);
  }, [viewMode, yearGradePairs]);

  // ─── 다년도 병렬 쿼리 (record) ──────────────────────

  const recordQueries = useQueries({
    queries: yearGradePairs.map((p) => recordTabQueryOptions(studentId, p.schoolYear)),
  });

  const supplementaryQueries = useQueries({
    queries: yearGradePairs.map((p) => supplementaryTabQueryOptions(studentId, p.schoolYear)),
  });

  // storyline/strategy는 학년 무관 → 단일 쿼리
  const { data: storylineData, isLoading: storylineLoading, error: storylineError } = useQuery(
    storylineTabQueryOptions(studentId, initialSchoolYear),
  );
  const { data: strategyData, isLoading: strategyLoading, error: strategyError } = useQuery(
    strategyTabQueryOptions(studentId, initialSchoolYear),
  );
  const { data: diagnosisData, isLoading: diagnosisLoading, error: diagnosisError } = useQuery(
    diagnosisTabQueryOptions(studentId, initialSchoolYear, tenantId),
  );

  // 파이프라인 상태 (수동 분석 중복 방지용)
  const { data: pipelineData } = useQuery(pipelineStatusQueryOptions(studentId));
  const isPipelineRunning = pipelineData?.status === "running";

  // P1: 수강 계획 데이터 (세특 placeholder 연동)
  const { data: coursePlanData } = useQuery(coursePlanTabQueryOptions(studentId));

  // G1: 세특 레이어 탭용 추가 데이터
  const { data: setekGuidesRes } = useQuery({
    queryKey: ["studentRecord", "setekGuides", studentId],
    queryFn: () => import("@/lib/domains/student-record/actions/activitySummary").then((m) => m.fetchSetekGuides(studentId)),
    staleTime: 60_000,
    enabled: !!studentId,
  });
  const guideSchoolYear = viewMode === "all" ? undefined : viewMode;
  const { data: guideAssignmentsRes } = useQuery({
    queryKey: ["explorationGuide", "assignments", studentId, guideSchoolYear ?? "all"],
    queryFn: () => import("@/lib/domains/guide/actions/assignment").then((m) => m.fetchAssignedGuidesAction(studentId, guideSchoolYear)),
    staleTime: 60_000,
    enabled: !!studentId,
  });

  // 레이어 뷰: 배정별 결과물 파일 수 (배치)
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

  // ─── 학년별 데이터 맵 ─────────────────────────────────

  const recordByGrade = useMemo(() => {
    const map = new Map<number, { grade: number; schoolYear: number; data: NonNullable<(typeof recordQueries)[0]["data"]> }>();
    yearGradePairs.forEach((p, i) => {
      const q = recordQueries[i];
      if (q.data) {
        map.set(p.grade, { grade: p.grade, schoolYear: p.schoolYear, data: q.data });
      }
    });
    return map;
  }, [yearGradePairs, recordQueries]);

  const suppByGrade = useMemo(() => {
    const map = new Map<number, { grade: number; schoolYear: number; data: NonNullable<(typeof supplementaryQueries)[0]["data"]> }>();
    yearGradePairs.forEach((p, i) => {
      const q = supplementaryQueries[i];
      if (q.data) {
        map.set(p.grade, { grade: p.grade, schoolYear: p.schoolYear, data: q.data });
      }
    });
    return map;
  }, [yearGradePairs, supplementaryQueries]);

  // ─── 로딩/에러 상태 ─────────────────────────────────

  const anyRecordLoading = recordQueries.some((q) => q.isLoading);
  const anySuppLoading = supplementaryQueries.some((q) => q.isLoading);
  // 섹션별 에러 (전역 에러 대신 부분 에러)
  const recordErrorGrades = useMemo(() => {
    const errors = new Map<number, Error>();
    yearGradePairs.forEach((p, i) => {
      const err = recordQueries[i]?.error;
      if (err) errors.set(p.grade, err as Error);
    });
    return errors;
  }, [yearGradePairs, recordQueries]);
  const suppErrorGrades = useMemo(() => {
    const errors = new Map<number, Error>();
    yearGradePairs.forEach((p, i) => {
      const err = supplementaryQueries[i]?.error;
      if (err) errors.set(p.grade, err as Error);
    });
    return errors;
  }, [yearGradePairs, supplementaryQueries]);

  // ─── 현재 스테이지 계산 (activeSection → stageId) ────
  const activeStage = useMemo<StageId>(() => {
    for (const stage of STAGES) {
      if (stage.sections.some((s) => s.id === activeSection)) return stage.id;
    }
    return "record";
  }, [activeSection]);

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

  // G1: 활성 과목 ID (세특 레이어 탭 ↔ 사이드 패널 연결)
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState<number | null>(null);
  const [activeSubjectName, setActiveSubjectName] = useState<string | null>(null);

  // 전체 치명적 에러 (모든 쿼리 실패) 시에만 페이지 차단
  const allFailed = recordQueries.every((q) => !!q.error)
    && supplementaryQueries.every((q) => !!q.error)
    && !!storylineError && !!strategyError;
  if (allFailed) {
    const firstError = recordQueries[0]?.error ?? storylineError ?? strategyError;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          데이터를 불러오는 중 오류가 발생했습니다: {(firstError as Error)?.message ?? "알 수 없는 에러"}
        </div>
      </div>
    );
  }

  // ─── Sidebar Content ──────────────────────────────

  // 사이드바 스테이지 접기/펼치기
  const [expandedStages, setExpandedStages] = useState<Set<StageId>>(
    () => new Set<StageId>(["record", "diagnosis", "design", "strategy"]),
  );

  const toggleStage = useCallback((stageId: StageId) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  // ─── G0-2 진행률 계산 (recordByGrade/suppByGrade + 파이프라인 태스크 상태) ──
  const progressCounts = useMemo(() => {
    // 파이프라인 태스크 완료 헬퍼
    const taskDone = (key: string) => pipelineData?.tasks?.[key as keyof typeof pipelineData.tasks] === "completed";

    let recordFilled = 0;
    const recordTotal = 7; // sec-1~3, sec-6~9 (sec-4,5 항상 빈)
    if (recordByGrade.size > 0) recordFilled++; // sec-1 (항상)
    for (const [, entry] of recordByGrade) {
      if (entry.data.schoolAttendance) { recordFilled++; break; }
    }
    // awards/disciplinary from suppByGrade
    let hasAwards = false;
    for (const [, entry] of suppByGrade) {
      if (entry.data.awards.length > 0 || entry.data.disciplinary.length > 0) { hasAwards = true; break; }
    }
    if (hasAwards) recordFilled++;
    for (const [, entry] of recordByGrade) {
      if (entry.data.changche.length > 0) { recordFilled++; break; }
    }
    for (const [, entry] of recordByGrade) {
      if (entry.data.seteks.length > 0) { recordFilled++; break; }
    }
    let hasReadings = false;
    for (const [, entry] of recordByGrade) {
      if (entry.data.readings.length > 0) { hasReadings = true; break; }
    }
    if (hasReadings) recordFilled++;
    for (const [, entry] of recordByGrade) {
      if (entry.data.haengteuk) { recordFilled++; break; }
    }

    const diagnosisFilled = diagnosisData ? 1 : 0;

    // 설계 스테이지: 데이터 존재 + 파이프라인 태스크 완료 (total=7)
    const designFilled = [
      storylineData?.storylines?.length ?? 0,                  // 스토리라인
      storylineData?.roadmapItems?.length ?? 0,                // 로드맵
      taskDone("activity_summary") ? 1 : 0,                    // 활동 요약서
      taskDone("setek_guide") ? 1 : 0,                         // 세특 방향
      taskDone("guide_matching") ? 1 : 0,                      // 가이드 배정
      taskDone("course_recommendation") ? 1 : 0,               // 수강 추천
      taskDone("bypass_analysis") ? 1 : 0,                     // 우회학과
    ].filter((n) => n > 0).length;

    // 전략 스테이지: 수동 입력 + 파이프라인 태스크 완료 (total=6)
    let hasApps = false;
    for (const [, entry] of suppByGrade) {
      if (entry.data.applications.length > 0) { hasApps = true; break; }
    }
    const strategyFilled = [
      hasApps ? 1 : 0,                                          // 지원 현황
      strategyData?.minScoreTargets?.length ? 1 : 0,            // 최저 목표
      taskDone("ai_strategy") ? 1 : 0,                          // 보완전략
      taskDone("interview_generation") ? 1 : 0,                  // 면접 질문
      taskDone("roadmap_generation") ? 1 : 0,                    // 로드맵 생성
      taskDone("ai_diagnosis") ? 1 : 0,                          // 종합 진단
    ].filter((n) => n > 0).length;

    return { recordFilled, recordTotal, diagnosisFilled, designFilled, strategyFilled };
  }, [recordByGrade, suppByGrade, diagnosisData, storylineData, strategyData, pipelineData]);

  const sidebarContent = (
    <div className="flex flex-col gap-0.5 p-3">
      {/* 진행률 대시보드 — 전체 + 스테이지별 미니 바 */}
      <div className="mb-3 rounded-lg bg-[var(--surface-secondary)] px-3 py-2.5">
        {/* 전체 진행률 */}
        {(() => {
          const totalFilled = progressCounts.recordFilled + progressCounts.diagnosisFilled + progressCounts.designFilled + progressCounts.strategyFilled;
          const totalAll = progressCounts.recordTotal + 1 + 7 + 6;
          const pct = Math.round((totalFilled / totalAll) * 100);
          return (
            <div className="mb-2 flex items-center justify-between pb-1.5 border-b border-[var(--border-secondary)]">
              <span className="text-xs font-semibold text-[var(--text-primary)]">전체 진행</span>
              <span className={`text-xs font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-gray-500"}`}>
                {pct}% ({totalFilled}/{totalAll})
              </span>
            </div>
          );
        })()}
        <div className="flex flex-col gap-1.5">
          {([
            { label: "기록", icon: ClipboardList, filled: progressCounts.recordFilled, total: progressCounts.recordTotal, color: "bg-blue-500" },
            { label: "진단", icon: Search, filled: progressCounts.diagnosisFilled, total: 1, color: "bg-purple-500" },
            { label: "설계", icon: Compass, filled: progressCounts.designFilled, total: 7, color: "bg-indigo-500" },
            { label: "전략", icon: Target, filled: progressCounts.strategyFilled, total: 6, color: "bg-emerald-500" },
          ] as const).map(({ label, icon: Icon, filled, total, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="flex w-14 shrink-0 items-center gap-1 text-xs text-[var(--text-secondary)]">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${total > 0 ? Math.round((filled / total) * 100) : 0}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-medium text-[var(--text-primary)]">{filled}/{total}</span>
            </div>
          ))}
        </div>
        {/* G4-5: 불완전함 보존 알림 */}
        {((progressCounts.recordFilled + progressCounts.diagnosisFilled + progressCounts.designFilled + progressCounts.strategyFilled) /
          (progressCounts.recordTotal + 1 + 7 + 6)) >= 0.95 && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            완벽한 일관성보다 자연스러운 다양성이 설득력 있습니다
          </p>
        )}
      </div>

      {/* Phase B: AI 초기 분석 파이프라인 */}
      <PipelineSidebarWidget
        studentId={studentId}
        tenantId={tenantId}
        hasTargetMajor={!!diagnosisData?.targetMajor}
        onReview={() => scrollToSection("sec-pipeline-results")}
      />

      {STAGES.map((stage) => {
        const isExpanded = expandedStages.has(stage.id);
        const hasActive = stage.sections.some((s) => s.id === activeSection);

        return (
          <div key={stage.id}>
            {/* 스테이지 헤더 */}
            <button
              onClick={() => toggleStage(stage.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors",
                hasActive && !isExpanded
                  ? "text-indigo-700 dark:text-indigo-300"
                  : "text-[var(--text-primary)]",
                "hover:bg-[var(--surface-hover)]",
              )}
            >
              <span>{stage.emoji} {stage.label}</span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-[var(--text-tertiary)] transition-transform duration-150",
                  isExpanded && "rotate-180",
                )}
              />
            </button>

            {/* 펼침 영역 */}
            {isExpanded && (
              <div className="flex flex-col gap-0.5 pb-1">
                {/* 학년 선택 (기록/진단만) */}
                {stage.hasYearSelector && (
                  <div className="px-2 py-1">
                    <RecordYearSelector compact value={viewMode} onChange={setViewMode} studentGrade={studentGrade} />
                  </div>
                )}
                {/* 섹션 목록 */}
                {stage.sections.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
                      item.indent ? "pl-9" : "pl-7",
                      activeSection === item.id
                        ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    {item.number && (
                      <span className="inline-flex size-5 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {item.number}
                      </span>
                    )}
                    {item.indent && <span className="text-[var(--text-tertiary)]">├</span>}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* PDF 가져오기 */}
      <div className="mt-3 border-t border-[var(--border-secondary)] pt-3">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="w-full rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          PDF 가져오기
        </button>
      </div>

      {/* Report 생성 */}
      <div className="mt-2">
        <Link
          href={`/admin/students/${studentId}/report`}
          target="_blank"
          className="block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
        >
          Report 생성
        </Link>
      </div>
    </div>
  );

  // ─── 전학년 합산 supplementary 데이터 ─────────────

  const mergedSupplementary = useMemo(() => {
    const awards: NonNullable<(typeof supplementaryQueries)[0]["data"]>["awards"] = [];
    const volunteer: NonNullable<(typeof supplementaryQueries)[0]["data"]>["volunteer"] = [];
    const disciplinary: NonNullable<(typeof supplementaryQueries)[0]["data"]>["disciplinary"] = [];
    const applications: NonNullable<(typeof supplementaryQueries)[0]["data"]>["applications"] = [];
    const interviewConflicts: NonNullable<(typeof supplementaryQueries)[0]["data"]>["interviewConflicts"] = [];

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

  // ─── 전학년 합산 readings ─────────────────────────

  const mergedReadings = useMemo(() => {
    const readings: NonNullable<(typeof recordQueries)[0]["data"]>["readings"] = [];
    for (const p of visiblePairs) {
      const entry = recordByGrade.get(p.grade);
      if (!entry) continue;
      readings.push(...entry.data.readings);
    }
    return readings;
  }, [visiblePairs, recordByGrade]);

  // ─── 진단 탭용: 전체 레코드 추출 ────────────────────

  const allRecordSummaries = useMemo(() => {
    const result: { id: string; type: "setek" | "personal_setek" | "changche" | "haengteuk"; label: string; content: string; subjectName?: string; grade?: number }[] = [];
    for (const [g, entry] of recordByGrade) {
      for (const s of entry.data.seteks) {
        const text = s.content?.trim() || s.imported_content || "";
        if (text) {
          const subjectName = subjects.find((sub) => sub.id === s.subject_id)?.name ?? "과목";
          result.push({ id: s.id, type: "setek", label: `${g}학년 ${subjectName}`, content: text, subjectName, grade: g });
        }
      }
      for (const c of entry.data.changche) {
        const text = c.content?.trim() || (c as unknown as { imported_content?: string }).imported_content || "";
        if (text) result.push({ id: c.id, type: "changche", label: `${g}학년 ${c.activity_type}`, content: text, grade: g });
      }
      if (entry.data.haengteuk) {
        const text = entry.data.haengteuk.content?.trim() || (entry.data.haengteuk as unknown as { imported_content?: string }).imported_content || "";
        if (text) result.push({ id: entry.data.haengteuk.id, type: "haengteuk", label: `${g}학년 행특`, content: text, grade: g });
      }
    }
    return result;
  }, [recordByGrade, subjects]);

  // ─── 현재 학년 레코드 기반 태그 필터 ─────────────
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

  // ─── 경고 계산 ─────────────────────────────────
  const warnings = useMemo(() => {
    const recordsMap = new Map<number, import("@/lib/domains/student-record").RecordTabData>();
    for (const [g, entry] of recordByGrade) {
      recordsMap.set(g, entry.data);
    }
    const input: WarningCheckInput = {
      recordsByGrade: recordsMap,
      storylineData: storylineData ?? null,
      diagnosisData: diagnosisData ?? null,
      strategyData: strategyData ?? null,
      currentGrade: studentGrade,
    };
    return computeWarnings(input);
  }, [recordByGrade, storylineData, diagnosisData, strategyData, studentGrade]);

  // 헤더 표시용 텍스트
  const headerSubtitle = viewMode === "all"
    ? `${studentName ?? "학생"} · 전체 학년`
    : (() => {
        const pair = yearGradePairs.find((p) => p.schoolYear === viewMode);
        return pair ? `${pair.schoolYear}학년도 · ${studentName ?? "학생"} (${pair.grade}학년)` : "";
      })();

  return (
    <StudentRecordProvider value={{ studentId, tenantId, studentName, activeSubjectId, setActiveSubjectId, activeSchoolYear, setActiveSchoolYear, activeSubjectName, setActiveSubjectName }}>
    <SidePanelProvider storageKey="recordSidePanelApp">
    <TopBarCenterSlotPortal>
      <div className="contents">
        <div className="flex items-center gap-2 order-2">
          <FileText className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">생기부</span>
          <div className="ml-2">
            <GlobalLayerBar activeTab={globalSetekTab} onChange={setGlobalSetekTab} />
          </div>
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
      sidebar={sidebarContent}
      isSidebarOpen={sidebarOpen}
      onToggleSidebar={toggleSidebar}
      rightPanel={<RecordSidePanelContainer />}
    >
      {/* ─── 스테이지 탭 바 (데스크톱) ────────────────── */}
      <div className="hidden shrink-0 border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-4 md:flex">
        {STAGES.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => {
              const firstSection = stage.sections[0]?.id;
              if (firstSection) scrollToSection(firstSection);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeStage === stage.id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            <span>{stage.emoji}</span>
            {stage.label}
          </button>
        ))}
      </div>

      {/* ─── 메인 문서 스크롤 영역 ────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {headerSubtitle}
            </p>
          </div>

          {/* ─── 학반정보 + 사진 영역 (실제 생기부 원본 레이아웃) ── */}
          <div className="mb-6 flex items-stretch gap-4">
            {/* 테이블 */}
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
            {/* 증명사진 — NEIS 원본: 테이블 전체 높이에 맞춤 */}
            <div className="hidden shrink-0 sm:block">
              <div className="flex h-full w-[120px] items-center justify-center border border-gray-400 bg-gray-50 dark:border-gray-500 dark:bg-gray-800">
                <User className="size-12 text-gray-300 dark:text-gray-600" />
              </div>
            </div>
          </div>

          {/* ─── G2-3: 진로 미설정 배너 ──── */}
          {!diagnosisLoading && diagnosisData && !diagnosisData.targetMajor && (
            <CareerSetupBanner
              studentId={studentId}
              tenantId={tenantId}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
              }}
            />
          )}

          {/* ─── 온보딩 체크리스트 (진로 설정 완료 + 기록 5건 미만) ──── */}
          {diagnosisData?.targetMajor && (() => {
            const hasCoursePlan = (coursePlanData?.plans?.length ?? 0) > 0;
            const hasStoryline = (storylineData?.storylines?.length ?? 0) > 0;
            const hasRoadmap = (storylineData?.roadmapItems?.length ?? 0) > 0;
            const hasGuide = (setekGuidesRes?.success && (setekGuidesRes.data?.length ?? 0) > 0);
            const totalRecords = Object.values(recordByGrade ?? {}).reduce((sum, d) => {
              if (!d) return sum;
              return sum + (d.seteks?.length ?? 0) + (d.changche?.length ?? 0);
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

          {/* ─── 1. 인적·학적사항 (실제 생기부 원본 구조) ──── */}
          <DocSection id="sec-1" number="1" title="인적·학적사항">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td rowSpan={2} className="w-20 border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
                      학생정보
                    </td>
                    <td colSpan={3} className="border border-gray-400 px-0 py-0 dark:border-gray-500">
                      <div className="grid grid-cols-3">
                        <span className="border-r border-gray-400 px-3 py-1.5 text-sm text-[var(--text-primary)] dark:border-gray-500">
                          성명: {studentName ?? "-"}
                        </span>
                        <span className="border-r border-gray-400 px-3 py-1.5 text-sm text-[var(--text-primary)] dark:border-gray-500">
                          성별: -
                        </span>
                        <span className="px-3 py-1.5 text-sm text-[var(--text-primary)]">
                          주민등록번호: -
                        </span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="border border-gray-400 px-3 py-1.5 text-sm text-[var(--text-primary)] dark:border-gray-500">
                      주소: -
                    </td>
                  </tr>
                  <InfoRow
                    label="학적사항"
                    value={schoolName ? `${schoolName} 제${studentGrade}학년 재학` : "-"}
                  />
                  <InfoRow label="특기사항" value="-" />
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ─── 2. 출결상황 (전학년 단일 테이블 — 실제 생기부 원본) ──── */}
          <DocSection id="sec-2" number="2" title="출결상황">
            {anyRecordLoading ? <SectionSkeleton /> : visiblePairs.length > 1 ? (
              /* 전학년/다학년: 헤더 1번 + 학년별 row */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <AttendanceTableHeader />
                  <tbody>
                    {visiblePairs.map((p) => {
                      const entry = recordByGrade.get(p.grade);
                      return (
                        <AttendanceEditor
                          key={p.grade}
                          attendance={entry?.data.schoolAttendance ?? null}
                          studentId={studentId}
                          schoolYear={p.schoolYear}
                          tenantId={tenantId}
                          grade={p.grade}
                          variant="row"
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* 단일 학년: 기존 standalone */
              (() => {
                const p = visiblePairs[0];
                const entry = p ? recordByGrade.get(p.grade) : undefined;
                return p ? (
                  <AttendanceEditor
                    attendance={entry?.data.schoolAttendance ?? null}
                    studentId={studentId}
                    schoolYear={p.schoolYear}
                    tenantId={tenantId}
                    grade={p.grade}
                  />
                ) : null;
              })()
            )}
          </DocSection>

          {/* ─── 3. 수상경력 (봉사 제외 — 봉사는 6번 하위) ── */}
          <DocSection id="sec-3" number="3" title="수상경력">
            {anySuppLoading ? <SectionSkeleton /> : (
              <SupplementaryEditor
                awards={mergedSupplementary.awards}
                volunteer={[]}
                disciplinary={mergedSupplementary.disciplinary}
                studentId={studentId}
                schoolYear={visiblePairs[0]?.schoolYear ?? initialSchoolYear}
                tenantId={tenantId}
                grade={visiblePairs[0]?.grade ?? studentGrade}
                show={["awards", "disciplinary"]}
              />
            )}
          </DocSection>

          {/* ─── 4. 자격증 및 인증 취득상황 ───────── */}
          <DocSection id="sec-4" number="4" title="자격증 및 인증 취득상황">
            <div className="flex flex-col gap-4">
              <EmptyTable
                title="자격증 및 인증 취득상황"
                headers={["구분", "명칭 또는 종류", "번호 또는 내용", "취득연월일", "발급기관"]}
              />
              <EmptyTable
                title="국가직무능력표준 이수상황"
                headers={["학년", "학기", "세분류", "능력단위(코드)", "이수시간", "원점수", "성취도", "비고"]}
              />
            </div>
          </DocSection>

          {/* ─── 5. 학교폭력 조치사항 관리 ───────── */}
          <DocSection id="sec-5" number="5" title="학교폭력 조치사항 관리">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">학년</th>
                    <th className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">조치결정 일자</th>
                    <th className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">조치사항</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map((p) => (
                    <tr key={p.grade}>
                      <td className="border border-gray-400 px-3 py-1.5 text-center text-sm text-[var(--text-primary)] dark:border-gray-500">{p.grade}</td>
                      <td className="border border-gray-400 px-3 py-1.5 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500" />
                      <td className="border border-gray-400 px-3 py-1.5 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ─── 6. 창의적 체험활동상황 ──────────── */}
          <DocSection id="sec-6" number="6" title="창의적 체험활동상황">
            {anyRecordLoading ? <SectionSkeleton /> : (
              <div className="flex flex-col gap-4">
                {visiblePairs.map((p) => {
                  const entry = recordByGrade.get(p.grade);
                  return (
                    <div key={p.grade}>
                      {visiblePairs.length > 1 && (
                        <GradeLabel grade={p.grade} schoolYear={p.schoolYear} />
                      )}
                      <ChangcheEditor
                        changche={entry?.data.changche ?? []}
                        studentId={studentId}
                        schoolYear={p.schoolYear}
                        tenantId={tenantId}
                        grade={p.grade}
                        diagnosisActivityTags={diagnosisData?.activityTags}
                        guideAssignments={guideAssignmentsRes?.success ? guideAssignmentsRes.data as Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }> : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 봉사활동실적 — 실제 생기부에서 6번 창체 하위 */}
            <div data-section-id="sec-6-volunteer" className="mt-6">
              {anySuppLoading ? <SectionSkeleton /> : (
                <SupplementaryEditor
                  awards={[]}
                  volunteer={mergedSupplementary.volunteer}
                  disciplinary={[]}
                  studentId={studentId}
                  schoolYear={visiblePairs[0]?.schoolYear ?? initialSchoolYear}
                  tenantId={tenantId}
                  grade={visiblePairs[0]?.grade ?? studentGrade}
                  show={["volunteer"]}
                />
              )}
            </div>
          </DocSection>

          {/* ─── 7. 교과학습발달상황 ─────────────── */}
          <DocSection id="sec-7" number="7" title="교과학습발달상황">
            {/* 진단 약점 안내 배너 */}
            {diagnosisData?.consultantDiagnosis?.weaknesses && (diagnosisData.consultantDiagnosis.weaknesses as string[]).length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-900/10">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  종합진단 약점 — 세특 작성 시 아래 항목을 보완하세요:
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {(diagnosisData.consultantDiagnosis.weaknesses as string[]).map((w) => (
                    <li key={w} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {visiblePairs.map((p) => {
              const entry = recordByGrade.get(p.grade);
              // P1: 해당 학년의 confirmed plans
              const confirmedForGrade = coursePlanData?.plans
                ?.filter((cp) => cp.plan_status === "confirmed" && cp.grade === p.grade)
                .map((cp) => ({
                  subjectId: cp.subject_id,
                  subjectName: cp.subject.name,
                  semester: cp.semester,
                  subjectGroupName: cp.subject.subject_group?.name ?? "",
                  subjectTypeName: cp.subject.subject_type?.name ?? "",
                }));
              return (
                <div key={p.grade} className="mb-8 last:mb-0">
                  {visiblePairs.length > 1 && (
                    <GradeLabel grade={p.grade} schoolYear={p.schoolYear} />
                  )}
                  <GradesAndSetekSection
                    studentId={studentId}
                    schoolYear={p.schoolYear}
                    studentGrade={p.grade}
                    tenantId={tenantId}
                    subjects={subjects}
                    seteks={entry?.data.seteks}
                    personalSeteks={entry?.data.personalSeteks}
                    isLoading={anyRecordLoading}
                    showSectionAnchors={p.grade === visiblePairs[0]?.grade}
                    diagnosisActivityTags={diagnosisData?.activityTags}
                    setekGuideItems={(() => {
                      if (!setekGuidesRes?.success || !setekGuidesRes.data) return undefined;
                      const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
                      const items = setekGuidesRes.data
                        .map((row) => ({
                          subjectName: subjectMap.get(row.subject_id) ?? row.subject_id,
                          keywords: row.keywords ?? [],
                          direction: row.direction,
                          competencyFocus: row.competency_focus,
                          cautions: row.cautions ?? undefined,
                          teacherPoints: row.teacher_points,
                        }));
                      return items.length > 0 ? items : undefined;
                    })()}
                    guideAssignments={guideAssignmentsRes?.success ? guideAssignmentsRes.data as Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }> : undefined}
                    confirmedPlansForGrade={confirmedForGrade}
                    studentClassificationId={diagnosisData?.targetSubClassificationId}
                    studentClassificationName={diagnosisData?.targetSubClassificationName}
                    schoolName={schoolName}
                    courseAdequacy={diagnosisData?.courseAdequacy}
                    activeSetekTab={globalSetekTab}
                    onSetekTabChange={setGlobalSetekTab}

                  />
                </div>
              );
            })}
          </DocSection>

          {/* ─── 8. 독서활동상황 ──────────────────── */}
          <DocSection id="sec-8" number="8" title="독서활동상황">
            <p className="mb-2 text-xs text-[var(--text-tertiary)]">※ 기재는 되나, 대입에 미반영되는 영역</p>
            {anyRecordLoading ? <SectionSkeleton /> : (
              <ReadingEditor
                readings={mergedReadings}
                studentId={studentId}
                schoolYear={visiblePairs[0]?.schoolYear ?? initialSchoolYear}
                tenantId={tenantId}
                grade={visiblePairs[0]?.grade ?? studentGrade}
                diagnosisActivityTags={diagnosisData?.activityTags}
              />
            )}
          </DocSection>

          {/* ─── 9. 행동특성 및 종합의견 ──────────── */}
          <DocSection id="sec-9" number="9" title="행동특성 및 종합의견">
            <p className="mb-2 text-xs text-[var(--text-tertiary)]">※ 재학생의 경우, 3-1학기는 기재되지 않습니다.</p>
            {anyRecordLoading ? <SectionSkeleton /> : (
              <div className="flex flex-col gap-4">
                {visiblePairs.map((p) => {
                  const entry = recordByGrade.get(p.grade);
                  return (
                    <div key={p.grade}>
                      {visiblePairs.length > 1 && (
                        <GradeLabel grade={p.grade} schoolYear={p.schoolYear} />
                      )}
                      <HaengteukEditor
                        haengteuk={entry?.data.haengteuk ?? null}
                        studentId={studentId}
                        schoolYear={p.schoolYear}
                        tenantId={tenantId}
                        grade={p.grade}
                        diagnosisActivityTags={diagnosisData?.activityTags}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </DocSection>

          {/* ─── 🔍 진단 스테이지 구분선 ──────────── */}
          <StageDivider emoji="🔍" label="진단" />

          <StrategySection id="sec-diagnosis-analysis" title="역량 분석">
            {diagnosisLoading || anyRecordLoading ? <SectionSkeleton /> : (
              <CompetencyAnalysisSection
                competencyScores={[...(diagnosisData?.competencyScores.ai ?? []), ...(diagnosisData?.competencyScores.consultant ?? [])]}
                activityTags={filteredActivityTags}
                records={allRecordSummaries}
                studentId={studentId}
                tenantId={tenantId}
                schoolYear={initialSchoolYear}
                isPipelineRunning={isPipelineRunning}
                targetMajor={diagnosisData?.targetMajor}
                takenSubjects={diagnosisData?.takenSubjects}
              />
            )}
          </StrategySection>

          {/* 동일과목 세특 비교 + 크로스레퍼런스 */}
          <StrategySection id="sec-diagnosis-crossref" title="교차 분석">
            {diagnosisLoading || anyRecordLoading ? <SectionSkeleton /> : (
              <div className="flex flex-col gap-4">
                {/* 같은 학교 동일 과목 세특 참고 */}
                {schoolName && allRecordSummaries.filter((r) => r.type === "setek").length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">같은 학교 동일 과목 세특</p>
                    {[...new Set(allRecordSummaries.filter((r) => r.type === "setek").map((r) => r.subjectName))].map((subjectName) => {
                      const rec = allRecordSummaries.find((r) => r.type === "setek" && r.subjectName === subjectName);
                      if (!rec) return null;
                      // subject_id가 필요 — recordByGrade에서 찾기
                      const setekRecord = [...recordByGrade.values()].flatMap((e) => e.data.seteks).find((s) => s.id === rec.id);
                      if (!setekRecord) return null;
                      return (
                        <SameSchoolSetekInfo
                          key={setekRecord.subject_id}
                          studentId={studentId}
                          subjectId={setekRecord.subject_id}
                          schoolYear={initialSchoolYear}
                        />
                      );
                    })}
                  </div>
                )}
                {/* 크로스레퍼런스 */}
                <CrossReferenceChips
                  studentId={studentId}
                  tenantId={tenantId}
                  currentRecordIds={currentYearTagIds}
                  currentRecordType="setek"
                  currentGrade={studentGrade}
                  allTags={filteredActivityTags as import("@/lib/domains/student-record").ActivityTag[]}
                  courseAdequacy={diagnosisData?.courseAdequacy ?? null}
                />
              </div>
            )}
          </StrategySection>

          <StrategySection id="sec-diagnosis-overall" title="종합진단">
            {diagnosisLoading ? <SectionSkeleton /> : (
              <DiagnosisComparisonView
                aiDiagnosis={diagnosisData?.aiDiagnosis ?? null}
                consultantDiagnosis={diagnosisData?.consultantDiagnosis ?? null}
                aiScores={diagnosisData?.competencyScores.ai ?? []}
                consultantScores={diagnosisData?.competencyScores.consultant ?? []}
                activityTags={filteredActivityTags}
                studentId={studentId}
                tenantId={tenantId}
                schoolYear={initialSchoolYear}
                targetMajor={diagnosisData?.targetMajor}
                schoolName={schoolName}
              />
            )}
          </StrategySection>

          <StrategySection id="sec-diagnosis-adequacy" title="교과이수적합도">
            {diagnosisLoading ? <SectionSkeleton /> : (
              <CourseAdequacyDisplay
                initialResult={diagnosisData?.courseAdequacy ?? null}
                takenSubjects={diagnosisData?.takenSubjects ?? []}
                offeredSubjects={diagnosisData?.offeredSubjects ?? null}
                initialMajor={diagnosisData?.targetMajor ?? null}
                curriculumYear={(initialSchoolYear - studentGrade + 1) >= 2025 ? 2022 : 2015}
              />
            )}
          </StrategySection>

          <StrategySection id="sec-warnings" title="조기 경보">
            <RecordWarningPanel warnings={warnings} />
          </StrategySection>

          {/* ─── 📐 설계 스테이지 구분선 ──────────── */}
          <StageDivider emoji="📐" label="설계" />

          {/* Phase B: AI 초기 분석 결과 패널 */}
          <div data-section-id="sec-pipeline-results">
            <DesignPipelineResultsPanel studentId={studentId} tenantId={tenantId} />
          </div>

          {/* ─── 설계: 계획 그룹 ──────────────────── */}
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">계획</p>

          {/* ─── 수강 계획 ──────────────────────────── */}
          <StrategySection id="sec-course-plan" title="수강 계획">
            <Suspense fallback={<SectionSkeleton />}>
              <CoursePlanEditor studentId={studentId} tenantId={tenantId} />
            </Suspense>
          </StrategySection>

          {/* ─── 스토리라인 ───────────────────────── */}
          <StrategySection id="sec-storyline" title="스토리라인">
            {storylineLoading ? <SectionSkeleton /> : storylineData ? (
              <div className="flex flex-col gap-6">
                <StorylineManager storylines={storylineData.storylines} studentId={studentId} tenantId={tenantId} />
                <InquiryLinkSuggestions
                  records={allRecordSummaries}
                  storylines={storylineData.storylines}
                  studentId={studentId}
                  tenantId={tenantId}
                  cachedResult={(pipelineData?.taskResults?.storyline_generation as import("@/lib/domains/student-record/llm/prompts/inquiryLinking").InquiryLinkResult) ?? null}
                />
                {storylineData.storylines.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-medium text-[var(--text-primary)]">타임라인 미리보기</h4>
                    <StorylineTimeline storylines={storylineData.storylines} roadmapItems={storylineData.roadmapItems} />
                  </div>
                )}
              </div>
            ) : null}
          </StrategySection>

          {/* ─── 로드맵 ──────────────────────────── */}
          <StrategySection id="sec-roadmap" title="로드맵">
            {storylineLoading ? <SectionSkeleton /> : storylineData ? (
              <RoadmapEditor
                roadmapItems={storylineData.roadmapItems}
                storylines={storylineData.storylines}
                studentId={studentId}
                schoolYear={initialSchoolYear}
                tenantId={tenantId}
                grade={studentGrade}
              />
            ) : null}
          </StrategySection>

          {/* ─── 보완전략 ──────────────────────────── */}
          <StrategySection id="sec-compensation" title="보완전략">
            {diagnosisLoading ? <SectionSkeleton /> : (
              <StrategyEditorPanel
                strategies={diagnosisData?.strategies ?? []}
                studentId={studentId}
                tenantId={tenantId}
                schoolYear={initialSchoolYear}
                grade={studentGrade}
                aiScores={diagnosisData?.competencyScores.ai}
                aiDiagnosis={diagnosisData?.aiDiagnosis}
                targetMajor={diagnosisData?.targetMajor}
                notTakenSubjects={diagnosisData?.courseAdequacy?.notTaken}
              />
            )}
          </StrategySection>

          {/* ─── 설계: AI 리포트 그룹 ────────────── */}
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">AI 리포트</p>

          {/* ─── 활동 요약서 ──────────────────────── */}
          <StrategySection id="sec-activity-summary" title="활동 요약서">
            <Suspense fallback={<SectionSkeleton />}>
              <ActivitySummaryPanel
                studentId={studentId}
                studentGrade={studentGrade}
                studentName={studentName}
              />
            </Suspense>
          </StrategySection>

          {/* ─── 세특 방향 가이드 ─────────────────── */}
          <StrategySection id="sec-setek-guide" title="세특 방향 가이드">
            <Suspense fallback={<SectionSkeleton />}>
              <SetekGuidePanel
                studentId={studentId}
                studentGrade={studentGrade}
                studentName={studentName}
              />
            </Suspense>
          </StrategySection>

          {/* ─── 설계: 가이드 그룹 ─────────────── */}
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">가이드</p>

          {/* ─── 활동 가이드 (탐구 가이드 배정) ──── */}
          <StrategySection id="sec-exploration-guide" title="활동 가이드">
            <Suspense fallback={<SectionSkeleton />}>
              <ExplorationGuidePanel
                studentId={studentId}
                studentGrade={studentGrade}
                tenantId={tenantId}
                schoolName={schoolName}
                schoolYear={initialSchoolYear}
                studentClassificationId={diagnosisData?.targetSubClassificationId ?? undefined}
                studentClassificationName={diagnosisData?.targetSubClassificationName ?? undefined}
              />
            </Suspense>
          </StrategySection>

          {/* ─── 우회학과 탐색 (CMS C1.5) ────────── */}
          <StrategySection id="sec-bypass-major" title="우회학과 탐색">
            <Suspense fallback={<SectionSkeleton />}>
              <BypassMajorPanel
                studentId={studentId}
                studentGrade={studentGrade}
                tenantId={tenantId}
              />
            </Suspense>
          </StrategySection>

          {/* ─── 🎯 전략 스테이지 구분선 ──────────── */}
          <StageDivider emoji="🎯" label="전략" />

          {/* ─── 지원현황 ────────────────────────── */}
          <StrategySection id="sec-applications" title="지원현황">
            {anySuppLoading ? <SectionSkeleton /> : (
              <ApplicationBoard
                applications={mergedSupplementary.applications}
                interviewConflicts={mergedSupplementary.interviewConflicts}
                studentId={studentId}
                schoolYear={initialSchoolYear}
                tenantId={tenantId}
              />
            )}
          </StrategySection>

          {/* ─── 최저시뮬 ────────────────────────── */}
          <StrategySection id="sec-minscore" title="최저 학력 시뮬레이션">
            {strategyLoading ? <SectionSkeleton /> : strategyData ? (
              <MinScorePanel
                targets={strategyData.minScoreTargets}
                simulations={strategyData.minScoreSimulations}
                studentId={studentId}
                schoolYear={initialSchoolYear}
                tenantId={tenantId}
              />
            ) : null}
          </StrategySection>

          <StrategySection id="sec-placement" title="정시 배치 분석">
            <PlacementDashboard studentId={studentId} />
          </StrategySection>

          <StrategySection id="sec-allocation" title="수시 6장 배분 시뮬레이션">
            {anySuppLoading ? <SectionSkeleton /> : (
              <AllocationSimulator
                studentId={studentId}
                existingApplications={mergedSupplementary.applications}
              />
            )}
          </StrategySection>

          <StrategySection id="sec-interview" title="면접 예상 질문">
            <InterviewQuestionPanel records={allRecordSummaries} />
          </StrategySection>

          <StrategySection id="sec-alumni" title="졸업생 입시 DB 검색">
            <AlumniSearch />
          </StrategySection>

          <div className="h-24" />
        </div>
      </div>

      {/* ─── Import Dialog ────────────────────────── */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        studentId={studentId}
        tenantId={tenantId}
        subjects={subjects}
      />
    </RecordLayoutShell>
    <ContextGridBottomSheet onOpenTopSheet={() => setTopSheetOpen(true)} />
    <ContextTopSheet
      isOpen={topSheetOpen}
      onClose={() => setTopSheetOpen(false)}
      studentGrade={studentGrade}
      initialSchoolYear={initialSchoolYear}
    />
    </SidePanelProvider>
    </StudentRecordProvider>
  );
}

// ─── 학년 라벨 ──────────────────────────────────────

function GradeLabel({ grade, schoolYear }: { grade: number; schoolYear: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
        {grade}학년
      </span>
      <span className="text-xs text-[var(--text-tertiary)]">{schoolYear}학년도</span>
    </div>
  );
}

// ─── 문서 섹션 래퍼 (공식 기록 1~9) ─────────────────

function DocSection({ id, number, title, children, isEmpty, emptyLabel }: {
  id: string; number: string; title: string; children: React.ReactNode;
  isEmpty?: boolean; emptyLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(!!isEmpty);

  // 데이터 상태 변경 시 접기 동기화
  useEffect(() => {
    if (isEmpty) setCollapsed(true);
  }, [isEmpty]);

  return (
    <section data-section-id={id} className="mb-6 scroll-mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {number}. {title}
        </h3>
        {isEmpty && !collapsed ? null : isEmpty ? (
          <span className="text-xs text-[var(--text-tertiary)]">
            {emptyLabel ?? "해당 없음"}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

// ─── 전략 섹션 래퍼 ─────────────────────────────────

function StrategySection({ id, title, children, isEmpty, emptyLabel }: {
  id: string; title: string; children: React.ReactNode;
  isEmpty?: boolean; emptyLabel?: string;
}) {
  const [collapsed, setCollapsed] = useState(!!isEmpty);

  useEffect(() => {
    if (isEmpty) setCollapsed(true);
  }, [isEmpty]);

  return (
    <section data-section-id={id} className="mb-8 scroll-mt-4">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-4 flex w-full items-center gap-2 border-b border-[var(--border-secondary)] pb-2 text-left"
      >
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h3>
        {isEmpty && collapsed && (
          <span className="text-xs text-[var(--text-tertiary)]">
            {emptyLabel ?? "데이터 없음"}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>
      {!collapsed && children}
    </section>
  );
}

// ─── 서브 헤더 ──────────────────────────────────────

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-bold text-[var(--text-primary)]">
      &lt; {children} &gt;
    </h4>
  );
}

// ─── 인적사항 테이블 행 ─────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-24 border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
        {label}
      </td>
      <td className="border border-gray-400 px-3 py-1.5 text-sm text-[var(--text-primary)] dark:border-gray-500">{value}</td>
    </tr>
  );
}

// ─── 빈 테이블 모형 (4,5번) ─────────────────────────

function EmptyTable({ title, headers }: { title?: string; headers: string[] }) {
  return (
    <div>
      {title && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">&lt; {title} &gt;</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={headers.length} className="border border-gray-400 px-4 py-2 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500">
                해당 사항 없음
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 7번 교과학습 통합 섹션 (성적→세특 연속 배치) ───

const PE_ART_GROUPS = new Set(["체육", "예술"]);
const ELECTIVE_TYPES = new Set(["진로선택", "진로 선택", "융합선택", "융합 선택"]);

function classifySubjectId(subjectId: string, subjects: Subject[]): "general" | "elective" | "pe_art" | "liberal" {
  const subj = subjects.find((s) => s.id === subjectId);
  if (!subj) return "general";
  const groupName = subj.subject_group?.name ?? "";
  const typeName = subj.subject_type?.name ?? "";
  const isAO = subj.subject_type?.is_achievement_only ?? false;
  if (groupName === "교양") return "liberal";
  if (PE_ART_GROUPS.has(groupName) || isAO) return "pe_art";
  if (ELECTIVE_TYPES.has(typeName)) return "elective";
  return "general";
}

function GradesAndSetekSection({
  studentId,
  schoolYear,
  studentGrade,
  tenantId,
  subjects,
  seteks,
  personalSeteks,
  isLoading,
  showSectionAnchors = true,
  diagnosisActivityTags,
  setekGuideItems,
  guideAssignments,
  confirmedPlansForGrade,
  studentClassificationId,
  studentClassificationName,
  schoolName,
  courseAdequacy,
  activeSetekTab,
  onSetekTabChange,
}: {
  studentId: string;
  schoolYear: number;
  studentGrade: number;
  tenantId: string;
  subjects: Subject[];
  seteks?: RecordSetek[];
  personalSeteks?: RecordPersonalSetek[];
  isLoading: boolean;
  showSectionAnchors?: boolean;
  diagnosisActivityTags?: Array<{ id: string; record_type: string; record_id: string; competency_item: string; evaluation: string; evidence_summary?: string | null; source?: string; status?: string }>;
  setekGuideItems?: Array<{ subjectName: string; keywords: string[]; direction: string; competencyFocus?: string[]; cautions?: string; teacherPoints?: string[] }>;
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  confirmedPlansForGrade?: Array<{ subjectId: string; subjectName: string; semester: number; subjectGroupName: string; subjectTypeName: string }>;
  studentClassificationId?: number | null;
  studentClassificationName?: string | null;
  schoolName?: string | null;
  courseAdequacy?: import("@/lib/domains/student-record").CourseAdequacyResult | null;
  activeSetekTab?: import("./SetekEditor").SetekLayerTab;
  onSetekTabChange?: (tab: import("./SetekEditor").SetekLayerTab) => void;
}) {
  // 2022 개정 판별 (2025년 입학생~)
  const enrollmentYear = schoolYear - studentGrade + 1;
  const is2022Curriculum = enrollmentYear >= 2025;
  const peArtSectionTitle = is2022Curriculum
    ? "< 체육 · 예술 / 과학탐구실험 >"
    : "< 체육 · 예술 >";

  // 세특을 과목유형별로 분류
  const { generalSeteks, electiveSeteks, peArtSeteks } = useMemo(() => {
    if (!seteks) return { generalSeteks: [], electiveSeteks: [], peArtSeteks: [] };
    const gen: RecordSetek[] = [];
    const elec: RecordSetek[] = [];
    const peArt: RecordSetek[] = [];
    for (const s of seteks) {
      const cat = classifySubjectId(s.subject_id, subjects);
      if (cat === "pe_art") peArt.push(s);
      else if (cat === "elective") elec.push(s);
      else gen.push(s); // general + liberal
    }
    return { generalSeteks: gen, electiveSeteks: elec, peArtSeteks: peArt };
  }, [seteks, subjects]);

  // P1: confirmed plans를 카테고리별로 분류
  type PlannedSub = { subjectId: string; subjectName: string; semester: number };
  const { generalPlanned, electivePlanned, peArtPlanned } = useMemo(() => {
    if (!confirmedPlansForGrade) return { generalPlanned: [] as PlannedSub[], electivePlanned: [] as PlannedSub[], peArtPlanned: [] as PlannedSub[] };
    const gen: PlannedSub[] = [];
    const elec: PlannedSub[] = [];
    const peArt: PlannedSub[] = [];
    for (const p of confirmedPlansForGrade) {
      const groupName = p.subjectGroupName;
      const typeName = p.subjectTypeName;
      if (groupName === "교양") { gen.push(p); continue; }
      if (PE_ART_GROUPS.has(groupName)) { peArt.push(p); continue; }
      if (ELECTIVE_TYPES.has(typeName)) { elec.push(p); continue; }
      gen.push(p);
    }
    return { generalPlanned: gen, electivePlanned: elec, peArtPlanned: peArt };
  }, [confirmedPlansForGrade]);

  return (
    <>
      {/* ── 일반과목: 성적 → 이수학점 → 세특 ── */}
      <div {...(showSectionAnchors ? { "data-section-id": "sec-7-grades" } : {})} className="mb-6">
        <RecordGradesDisplay studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} studentGrade={studentGrade} subjects={subjects} variant="general" />
      </div>

      <div {...(showSectionAnchors ? { "data-section-id": "sec-7-setek" } : {})} className="mb-6">
        <SubHeader>세부능력 및 특기사항</SubHeader>
        {isLoading ? <SectionSkeleton /> : (
          <SetekEditor
            seteks={generalSeteks}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            subjects={subjects}
            grade={studentGrade}
            diagnosisActivityTags={diagnosisActivityTags}
            setekGuideItems={setekGuideItems}
            guideAssignments={guideAssignments}
            plannedSubjects={generalPlanned}
            studentClassificationId={studentClassificationId}
            schoolName={schoolName}
            courseAdequacy={courseAdequacy}
            activeTab={activeSetekTab}
            onTabChange={onSetekTabChange}

          />
        )}
      </div>

      {/* ── 진로 선택 과목: 성적 → 세특 ── */}
      <div className="mb-6">
        <SubHeader>&lt; 진로 선택 과목 &gt;</SubHeader>
        <RecordGradesDisplay studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} studentGrade={studentGrade} subjects={subjects} variant="elective" />
      </div>

      {(electiveSeteks.length > 0 || electivePlanned.length > 0) && (
        <div className="mb-6">
          <SubHeader>세부능력 및 특기사항</SubHeader>
          <SetekEditor
            seteks={electiveSeteks}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            subjects={subjects}
            grade={studentGrade}
            diagnosisActivityTags={diagnosisActivityTags}
            setekGuideItems={setekGuideItems}
            guideAssignments={guideAssignments}
            plannedSubjects={electivePlanned}
            studentClassificationId={studentClassificationId}
            schoolName={schoolName}
            activeTab={activeSetekTab}
            onTabChange={onSetekTabChange}

          />
        </div>
      )}

      {/* ── 체육 · 예술: 성적 → 세특 ── */}
      <div className="mb-6">
        <SubHeader>{peArtSectionTitle}</SubHeader>
        <RecordGradesDisplay studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} studentGrade={studentGrade} subjects={subjects} variant="pe_art" />
      </div>

      {(peArtSeteks.length > 0 || peArtPlanned.length > 0) && (
        <div className="mb-6">
          <SubHeader>세부능력 및 특기사항</SubHeader>
          <SetekEditor
            seteks={peArtSeteks}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            subjects={subjects}
            grade={studentGrade}
            diagnosisActivityTags={diagnosisActivityTags}
            setekGuideItems={setekGuideItems}
            guideAssignments={guideAssignments}
            plannedSubjects={peArtPlanned}
            studentClassificationId={studentClassificationId}
            schoolName={schoolName}
            activeTab={activeSetekTab}
            onTabChange={onSetekTabChange}

          />
        </div>
      )}

      {/* ── 개인세특 ── */}
      <div {...(showSectionAnchors ? { "data-section-id": "sec-7-personal" } : {})}>
        <SubHeader>개인 세부능력 및 특기사항</SubHeader>
        {isLoading ? <SectionSkeleton /> : personalSeteks ? (
          <PersonalSetekEditor
            personalSeteks={personalSeteks}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            grade={studentGrade}
          />
        ) : null}
      </div>
    </>
  );
}

// ─── 로딩 스켈레톤 ──────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-20 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── 스테이지 구분선 ──────────────────────────────────

function StageDivider({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 my-8 border-y border-gray-200 bg-gray-50/90 px-4 py-2.5 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90 sm:-mx-6 sm:px-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
        {emoji} {label}
      </span>
    </div>
  );
}
