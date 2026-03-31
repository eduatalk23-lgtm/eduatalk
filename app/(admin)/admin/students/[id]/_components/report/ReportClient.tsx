"use client";

import { useRef, useState, useMemo, useEffect, type ReactNode } from "react";
import { computeGradeStage, type GradeStage } from "@/lib/domains/student-record/grade-stage";
import { useQuery } from "@tanstack/react-query";
import { reportDataQueryOptions } from "@/lib/query-options/studentRecord";
import { ReportSkeleton } from "./ReportSkeleton";
import { Printer, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { CoverSection } from "./sections/CoverSection";
import { TableOfContents } from "./sections/TableOfContents";
import { ExecutiveSummarySection } from "./sections/ExecutiveSummarySection";
import { ActivitySummaryReportSection } from "./sections/ActivitySummaryReportSection";
import { ScoreSection } from "./sections/ScoreSection";
import { CompetencySection } from "./sections/CompetencySection";
import { DiagnosisSection } from "./sections/DiagnosisSection";
import { StorylineSection } from "./sections/StorylineSection";
import { EdgeSummarySection } from "./sections/EdgeSummarySection";
import { MockSection } from "./sections/MockSection";
import { ApplicationSection } from "./sections/ApplicationSection";
import { StrategySection } from "./sections/StrategySection";
import { SetekGuideSection } from "./sections/SetekGuideSection";
import { CausalFlowSection } from "./sections/CausalFlowSection";
import { InterviewSection } from "./sections/InterviewSection";
import { BypassMajorSummarySection } from "./sections/BypassMajorSummarySection";
import { WarningSection } from "./sections/WarningSection";
import { GradeHeaderSection } from "./sections/GradeHeaderSection";
import { CoursePlanSection } from "./sections/CoursePlanSection";
import { ChangcheGuideSection } from "./sections/ChangcheGuideSection";
import { HaengteukGuideSection } from "./sections/HaengteukGuideSection";
import { ReadingSection } from "./sections/ReadingSection";
import { RoadmapSection } from "./sections/RoadmapSection";
import { ProgressSection } from "./sections/ProgressSection";
import { ActionItemsSection } from "./sections/ActionItemsSection";
import { UnivStrategySection } from "./sections/UnivStrategySection";
import { ConclusionSection } from "./sections/ConclusionSection";
import { GrowthTrajectorySection } from "./sections/GrowthTrajectorySection";
import { CohortBenchmarkSection } from "./sections/CohortBenchmarkSection";

interface ReportClientProps {
  studentId: string;
}

type SectionImportance = "primary" | "secondary" | "tertiary";

interface SectionDef {
  id: string;
  title: string;
  content: ReactNode;
  isGradeHeader?: boolean;
  parentGrade?: number;
  isPartBHeader?: boolean;
  importance?: SectionImportance;
}

function sectionWrapperClass(sec: SectionDef): string {
  return cn(
    "report-section",
    sec.importance === "primary" &&
      "bg-[var(--surface-primary)] shadow-sm rounded-xl p-6",
    sec.importance === "secondary" &&
      "bg-[var(--surface-primary)] rounded-lg p-4",
    sec.importance === "tertiary" && "p-4 opacity-90",
    !sec.importance && "p-4",
  );
}

export function ReportClient({ studentId }: ReportClientProps) {
  const { data, isLoading, error } = useQuery(reportDataQueryOptions(studentId));
  const contentRef = useRef<HTMLDivElement>(null);
  const [coverVariant, setCoverVariant] = useState<"A" | "B" | "C" | "D" | "E">("A");
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [activeSection, setActiveSection] = useState<string>("cover");
  const { showError } = useToast();

  // 학년 접힘 상태 — prospective 학년은 기본 접힘, 나머지는 펼침
  // data 없을 때는 빈 Set으로 초기화 후 data 로드 후 effect로 갱신
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());

  async function handleExport(format: "pdf" | "docx") {
    if (!data) return;
    setExporting(format);
    try {
      const { buildReportExportData, exportReportAsPdf, exportReportAsDocx } = await import(
        "@/lib/domains/student-record/export/report-export"
      );
      const exportData = buildReportExportData(data);
      if (format === "pdf") {
        await exportReportAsPdf(exportData);
      } else {
        await exportReportAsDocx(exportData);
      }
    } catch {
      showError("내보내기에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setExporting(null);
    }
  }

  const scrollToSection = (sectionId: string) => {
    const el = contentRef.current?.querySelector(`[data-section-id="${sectionId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Hook은 early return 전에 호출해야 함 (Rules of Hooks)
  const currentSchoolYear = calculateSchoolYear();
  const studentGrade = data?.student.grade ?? 1;

  const yearGradePairs = useMemo(() => {
    if (!data) return [];
    const pairs: Array<{ grade: number; schoolYear: number }> = [];
    const maxGrade = data.pipelineMeta?.mode === "prospective" ? 3 : studentGrade;
    for (let g = 1; g <= maxGrade; g++) {
      pairs.push({ grade: g, schoolYear: currentSchoolYear - studentGrade + g });
    }
    return pairs;
  }, [data, studentGrade, currentSchoolYear]);

  const gradeStages = useMemo(() => {
    if (!data) return {} as Record<number, GradeStage>;
    const stages: Record<number, GradeStage> = {};
    for (const { grade } of yearGradePairs) {
      stages[grade] = computeGradeStage(data.recordDataByGrade[grade]);
    }
    return stages;
  }, [data, yearGradePairs]);

  // gradeStages 확정 후 expandedGrades 초기화 (prospective 아닌 학년만 기본 펼침)
  useEffect(() => {
    if (!data || yearGradePairs.length === 0) return;
    const expanded = new Set<number>();
    for (const { grade } of yearGradePairs) {
      if (gradeStages[grade] !== "prospective") expanded.add(grade);
    }
    // 모두 prospective이면 첫 학년은 펼침
    if (expanded.size === 0) expanded.add(yearGradePairs[0].grade);
    setExpandedGrades(expanded);
  // 의존성: data 변경 시에만 재설정 (gradeStages는 data에 종속)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function toggleGrade(grade: number) {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  // P1-2: TOC 활성 섹션 스크롤 추적
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-section-id");
          if (id) setActiveSection(id);
        }
      },
      { root: container, rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    const els = container.querySelectorAll("[data-section-id]");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [data]);

  if (isLoading) return <ReportSkeleton />;
  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-red-600">{error?.message ?? "데이터를 불러올 수 없습니다."}</p>
      </div>
    );
  }

  const totalActivityCount = Object.values(data.recordDataByGrade).reduce((sum, d) => {
    if (!d) return sum;
    return sum + (d.seteks?.length ?? 0) + (d.personalSeteks?.length ?? 0) +
      (d.changche?.length ?? 0) + (d.readings?.length ?? 0) + (d.haengteuk ? 1 : 0);
  }, 0);

  const sections: SectionDef[] = [
    // ── 표지 + 요약 ──
    {
      id: "cover",
      title: "표지",
      content: (
        <CoverSection
          studentName={data.student.name}
          schoolName={data.student.schoolName}
          grade={data.student.grade}
          className={data.student.className}
          targetMajor={data.student.targetMajor}
          consultantName={data.consultantName}
          generatedAt={data.generatedAt}
          variant={coverVariant}
        />
      ),
    },
    { id: "toc", title: "섹션 목록", content: <TableOfContents /> },
    {
      id: "exec",
      title: "엑서큐티브 요약",
      content: (
        <ExecutiveSummarySection
          studentName={data.student.name}
          targetMajor={data.student.targetMajor}
          internalAnalysis={data.internalAnalysis}
          diagnosisData={data.diagnosisData}
          mockAnalysis={data.mockAnalysis}
          edgeCount={data.edges.length}
          storylineCount={data.storylineData.storylines.length}
          totalActivityCount={totalActivityCount}
          guideAssignmentCount={data.guideAssignmentCount}
          gradeStages={gradeStages}
          strategies={data.diagnosisData.strategies.map((s) => ({
            target_area: s.target_area,
            strategy_content: s.strategy_content,
            priority: s.priority ?? "medium",
            status: s.status,
          }))}
          studentGrade={studentGrade}
          cohortPercentile={data.cohortBenchmark?.percentile ?? null}
        />
      ),
    },
    // ── 점검 사항 (분석 전 리스크 조기 인지) ──
    {
      id: "warning",
      title: "점검 사항",
      content: (
        <WarningSection
          recordDataByGrade={data.recordDataByGrade}
          storylineData={data.storylineData}
          diagnosisData={data.diagnosisData}
          strategyData={data.strategyData}
          studentGrade={data.student.grade}
        />
      ),
      importance: "secondary" as SectionImportance,
    },
    { id: "activity", title: "활동 요약서", content: <ActivitySummaryReportSection summaries={data.activitySummaries} /> },

    // ── Part A: 학년별 상세 ──
    ...yearGradePairs.flatMap(({ grade, schoolYear }) => {
      const gradeRecords = data.recordDataByGrade[grade];
      const stage = gradeStages[grade] ?? "prospective";
      const gradePlans = data.coursePlans.filter((p) => p.grade === grade);
      const gradeSetekGuides = data.setekGuides.filter(() => {
        // setekGuides에는 school_year가 없고 subject_id 기반이므로 전체 표시
        // schoolYear 필터는 changche/haengteuk에서만 적용
        return true;
      });
      const gradeChangcheGuides = data.changcheGuides.filter(
        (g) => g.school_year === schoolYear,
      );
      const gradeHaengteukGuide =
        data.haengteukGuides.find((g) => g.school_year === schoolYear) ?? null;
      const gradeRoadmap = data.storylineData.roadmapItems.filter(
        (r) => r.grade === grade,
      );
      const gradeReadings = gradeRecords?.readings ?? [];

      const isExpanded = expandedGrades.has(grade);

      return [
        {
          id: `grade-${grade}`,
          title: `${grade}학년 (${schoolYear})`,
          content: (
            <GradeHeaderSection
              grade={grade}
              schoolYear={schoolYear}
              stage={stage}
              expanded={isExpanded}
              onToggle={() => toggleGrade(grade)}
            />
          ),
          isGradeHeader: true,
        },
        {
          id: `grade-${grade}-plan`,
          title: "수강 계획",
          content: isExpanded ? <CoursePlanSection grade={grade} plans={gradePlans} /> : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-setek-guide`,
          title: "세특 방향",
          content: isExpanded ? (
            <SetekGuideSection
              guides={gradeSetekGuides}
              stage={stage}
              seteks={gradeRecords?.seteks}
            />
          ) : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-changche-guide`,
          title: "창체 방향",
          content: isExpanded ? (
            <ChangcheGuideSection
              guides={gradeChangcheGuides}
              stage={stage}
              changche={gradeRecords?.changche}
            />
          ) : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-haengteuk-guide`,
          title: "행특 방향",
          content: isExpanded ? (
            <HaengteukGuideSection
              guide={gradeHaengteukGuide}
              stage={stage}
              haengteuk={gradeRecords?.haengteuk}
            />
          ) : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-reading`,
          title: "독서 활동",
          content: isExpanded ? (
            <ReadingSection
              readings={gradeReadings}
              stage={stage}
              roadmapItems={gradeRoadmap}
            />
          ) : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-roadmap`,
          title: "로드맵",
          content: isExpanded ? <RoadmapSection items={gradeRoadmap} grade={grade} stage={stage} /> : null,
          parentGrade: grade,
        },
        {
          id: `grade-${grade}-progress`,
          title: "달성도",
          content: isExpanded ? (
            <ProgressSection
              grade={grade}
              roadmapItems={gradeRoadmap}
              coursePlans={gradePlans}
              setekCount={gradeRecords?.seteks?.length ?? 0}
              changcheCount={gradeRecords?.changche?.length ?? 0}
              hasHaengteuk={!!gradeRecords?.haengteuk}
              stage={stage}
            />
          ) : null,
          parentGrade: grade,
        },
      ] satisfies SectionDef[];
    }),

    // ── Part B: 전체 분석 ──
    { id: "part-b-header", title: "전체 분석", content: null, isPartBHeader: true },
    {
      id: "score",
      title: "교과 성적 분석",
      content: <ScoreSection internalAnalysis={data.internalAnalysis} internalScores={data.internalScores} />,
      importance: "tertiary" as SectionImportance,
    },
    {
      id: "competency",
      title: "역량 분석",
      content: <CompetencySection diagnosisData={data.diagnosisData} recordDataByGrade={data.recordDataByGrade} />,
      importance: "primary" as SectionImportance,
    },
    {
      id: "trajectory",
      title: "3년 성장 궤적",
      content: (
        <GrowthTrajectorySection
          competencyScores={data.diagnosisData.competencyScores}
          activityTags={data.diagnosisData.activityTags}
          recordDataByGrade={data.recordDataByGrade}
          gradeStages={gradeStages}
          studentGrade={studentGrade}
        />
      ),
      importance: "secondary" as SectionImportance,
    },
    {
      id: "cohort",
      title: "코호트 벤치마크",
      content: (
        <CohortBenchmarkSection
          percentile={data.cohortBenchmark?.percentile ?? null}
          cohortStats={data.cohortBenchmark?.cohortStats ?? null}
          targetMajor={data.student.targetMajor}
          coursePlans={data.coursePlans.map((p) => ({
            subject: p.subject ? { name: p.subject.name } : null,
            plan_status: p.plan_status,
          }))}
        />
      ),
      importance: "secondary" as SectionImportance,
    },
    {
      id: "diagnosis",
      title: "종합 진단",
      content: <DiagnosisSection diagnosisData={data.diagnosisData} plannedSubjects={data.plannedSubjects} />,
      importance: "primary" as SectionImportance,
    },
    {
      id: "storyline",
      title: "스토리라인",
      content: (
        <StorylineSection
          storylineData={data.storylineData}
          studentGrade={data.student.grade}
          recordDataByGrade={data.recordDataByGrade}
        />
      ),
      importance: "primary" as SectionImportance,
    },
    {
      id: "edge",
      title: "활동 연결 분석",
      content: <EdgeSummarySection edges={data.edges} />,
      importance: "secondary" as SectionImportance,
    },
    {
      id: "causal",
      title: "약점→전략→실행",
      content: (
        <CausalFlowSection
          diagnosisData={data.diagnosisData}
          setekGuides={data.setekGuides}
          roadmapItems={data.storylineData.roadmapItems}
          strategies={data.diagnosisData.strategies.map((s) => ({
            target_area: s.target_area ?? "general",
            strategy_content: s.strategy_content,
            priority: s.priority ?? "low",
            status: s.status,
          }))}
        />
      ),
      importance: "secondary" as SectionImportance,
    },
    {
      id: "strategy",
      title: "보완 전략",
      content: <StrategySection diagnosisData={data.diagnosisData} />,
      importance: "primary" as SectionImportance,
    },
    {
      id: "action",
      title: "이번 달 액션",
      content: (
        <ActionItemsSection
          roadmapItems={data.storylineData.roadmapItems}
          studentGrade={studentGrade}
        />
      ),
      importance: "primary" as SectionImportance,
    },
    {
      id: "univ",
      title: "대학별 지원 전략",
      content: (
        <UnivStrategySection
          strategies={data.univStrategies}
          competencyScores={
            (data.diagnosisData.competencyScores.ai.length > 0
              ? data.diagnosisData.competencyScores.ai
              : data.diagnosisData.competencyScores.consultant
            ).map((s) => ({
              area: s.competency_area ?? "",
              label: s.competency_item ?? "",
              grade: String(s.grade ?? ""),
            }))
          }
        />
      ),
      importance: "secondary" as SectionImportance,
    },
    {
      id: "interview",
      title: "면접 예상 질문",
      content: <InterviewSection questions={data.interviewQuestions} />,
      importance: "secondary" as SectionImportance,
    },
    {
      id: "bypass",
      title: "우회학과 분석",
      content: (
        <BypassMajorSummarySection
          candidates={data.bypassCandidates}
          targetMajor={data.student.targetMajor}
        />
      ),
      importance: "tertiary" as SectionImportance,
    },
    {
      id: "mock",
      title: "모의고사 분석",
      content: <MockSection mockAnalysis={data.mockAnalysis} />,
      importance: "tertiary" as SectionImportance,
    },
    {
      id: "application",
      title: "지원 현황",
      content: <ApplicationSection strategyData={data.strategyData} />,
      importance: "tertiary" as SectionImportance,
    },
    // ── 종합 결론 (모든 분석 후 마지막 — 근거 기반 종합) ──
    {
      id: "conclusion",
      title: "종합 결론",
      content: (
        <ConclusionSection
          diagnosisData={data.diagnosisData}
          strategies={data.diagnosisData.strategies.map((s) => ({
            target_area: s.target_area,
            strategy_content: s.strategy_content,
            priority: s.priority,
            status: s.status,
          }))}
          roadmapItems={data.storylineData.roadmapItems}
          gradeStages={gradeStages}
          studentGrade={studentGrade}
          targetMajor={data.student.targetMajor}
        />
      ),
      importance: "primary" as SectionImportance,
    },
  ];

  // TOC 렌더링용: isPartBHeader인 더미 섹션은 콘텐츠 페이지에서 제외
  const renderableSections = sections.filter((s) => !s.isPartBHeader);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:flex-row print:-mt-16">
      {/* ═══ 좌측 TOC 사이드바 ═══ */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50/80 print:hidden">
        <div className="px-3 py-4">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Report</p>
            {data.pipelineMeta?.hasStaleEdges && (
              <div className="mt-1.5 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700 border border-amber-200">
                <span className="shrink-0">⚠</span>
                <span>분석 후 기록이 수정되었습니다. 재분석을 권장합니다.</span>
              </div>
            )}
          </div>

          <nav aria-label="리포트 목차" className="flex flex-col gap-0.5">
            {sections.map((sec) => {
              if (sec.isPartBHeader) {
                return (
                  <div key={sec.id} className="mt-3 mb-1 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      전체 분석
                    </p>
                  </div>
                );
              }
              if (sec.isGradeHeader) {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "mt-2 rounded-lg px-3 py-1.5 text-left text-sm font-bold transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-800 hover:bg-gray-100",
                    )}
                  >
                    {sec.title}
                  </button>
                );
              }
              if (sec.parentGrade != null) {
                const isActive = activeSection === sec.id;
                const parentActive = activeSection === `grade-${sec.parentGrade}`;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "rounded-lg py-1.5 pl-6 pr-3 text-left text-xs transition-colors",
                      isActive
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : parentActive
                          ? "text-gray-600 hover:bg-gray-100"
                          : "text-gray-500 hover:bg-gray-100",
                    )}
                  >
                    {sec.title}
                  </button>
                );
              }
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100",
                  )}
                >
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </nav>

          {/* 표지 디자인 선택 */}
          <div className="mt-4 border-t border-gray-200 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-500">표지 스타일</p>
            <div className="grid grid-cols-5 gap-1">
              {(["A", "B", "C", "D", "E"] as const).map((v) => {
                const labels = { A: "등고선", B: "플로우", C: "격자", D: "도형", E: "호" };
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCoverVariant(v)}
                    className={`rounded px-1.5 py-1.5 text-[10px] font-medium transition-colors ${
                      coverVariant === v
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {labels[v]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" />
              인쇄
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-red-500" />}
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={() => handleExport("docx")}
              disabled={exporting !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />}
              Word 다운로드
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ 모바일 TOC (lg 미만) ═══ */}
      <div className="lg:hidden sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-4 py-2 print:hidden">
        <select
          value={activeSection}
          onChange={(e) => scrollToSection(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          aria-label="섹션으로 이동"
        >
          {sections
            .filter((s) => !s.isPartBHeader)
            .map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.parentGrade != null ? `\u00A0\u00A0${sec.title}` : sec.title}
              </option>
            ))}
        </select>
      </div>

      {/* ═══ 메인: A4 폭 스크롤 문서 ═══ */}
      <main role="main" className="flex-1 overflow-y-auto bg-gray-200 print:bg-white print:overflow-visible">
        <div ref={contentRef} className="report-typography py-6 print:py-0">
          {/* 표지 — A4 페이지 */}
          <div className="report-page report-page--cover" data-section-id="cover">
            <CoverSection
              studentName={data.student.name}
              schoolName={data.student.schoolName}
              grade={data.student.grade}
              className={data.student.className}
              targetMajor={data.student.targetMajor}
              consultantName={data.consultantName}
              generatedAt={data.generatedAt}
              variant={coverVariant}
            />
          </div>

          {/* 나머지 섹션 — 각각 A4 페이지 */}
          {renderableSections.slice(1).map((sec) => (
            <div key={sec.id} className="report-page" data-section-id={sec.id}>
              <div className={sectionWrapperClass(sec)}>
                {sec.content}
              </div>
            </div>
          ))}

          {/* 푸터 */}
          <div className="report-page" data-section-id="footer">
            <div className="pt-4 text-xs text-gray-400">
              {data.pipelineMeta?.startedAt && (
                <p>AI 분석: {new Date(data.pipelineMeta.startedAt).toLocaleString("ko-KR")}</p>
              )}
              {data.pipelineMeta?.hasStaleEdges && (
                <p className="text-amber-600 font-medium">⚠ 분석 이후 기록이 수정됨 — 재분석 권장</p>
              )}
              <p>리포트 생성: {new Date(data.generatedAt).toLocaleString("ko-KR")}</p>
              <p className="mt-1">본 보고서는 컨설턴트 검토용이며, AI 분석 결과는 확정 전 초안 상태입니다.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
