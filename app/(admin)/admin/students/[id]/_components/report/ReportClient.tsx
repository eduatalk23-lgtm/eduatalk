"use client";

import { useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportDataQueryOptions } from "@/lib/query-options/studentRecord";
import { ReportSkeleton } from "./ReportSkeleton";
import { Printer } from "lucide-react";
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

interface ReportClientProps {
  studentId: string;
}

interface SectionDef {
  id: string;
  title: string;
  content: ReactNode;
}

export function ReportClient({ studentId }: ReportClientProps) {
  const { data, isLoading, error } = useQuery(reportDataQueryOptions(studentId));
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (sectionId: string) => {
    const el = contentRef.current?.querySelector(`[data-section-id="${sectionId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    { id: "cover", title: "표지", content: <CoverSection studentName={data.student.name} schoolName={data.student.schoolName} grade={data.student.grade} className={data.student.className} targetMajor={data.student.targetMajor} consultantName={data.consultantName} generatedAt={data.generatedAt} /> },
    { id: "toc", title: "섹션 목록", content: <TableOfContents /> },
    { id: "exec", title: "엑서큐티브 요약", content: <ExecutiveSummarySection studentName={data.student.name} targetMajor={data.student.targetMajor} internalAnalysis={data.internalAnalysis} diagnosisData={data.diagnosisData} mockAnalysis={data.mockAnalysis} edgeCount={data.edges.length} storylineCount={data.storylineData.storylines.length} totalActivityCount={totalActivityCount} guideAssignmentCount={data.guideAssignmentCount} /> },
    { id: "activity", title: "활동 요약서", content: <ActivitySummaryReportSection summaries={data.activitySummaries} /> },
    { id: "score", title: "교과 성적 분석", content: <ScoreSection internalAnalysis={data.internalAnalysis} internalScores={data.internalScores} /> },
    { id: "competency", title: "역량 분석", content: <CompetencySection diagnosisData={data.diagnosisData} recordDataByGrade={data.recordDataByGrade} /> },
    { id: "diagnosis", title: "종합 진단", content: <DiagnosisSection diagnosisData={data.diagnosisData} plannedSubjects={data.plannedSubjects} /> },
    { id: "storyline", title: "스토리라인", content: <StorylineSection storylineData={data.storylineData} studentGrade={data.student.grade} recordDataByGrade={data.recordDataByGrade} /> },
    { id: "edge", title: "활동 연결 분석", content: <EdgeSummarySection edges={data.edges} /> },
    { id: "mock", title: "모의고사 분석", content: <MockSection mockAnalysis={data.mockAnalysis} /> },
    { id: "application", title: "지원 현황", content: <ApplicationSection strategyData={data.strategyData} /> },
    { id: "causal", title: "진단→설계→전략", content: <CausalFlowSection diagnosisData={data.diagnosisData} setekGuides={data.setekGuides} /> },
    { id: "strategy", title: "보완 전략", content: <StrategySection diagnosisData={data.diagnosisData} /> },
    { id: "guide", title: "세특 방향 가이드", content: <SetekGuideSection guides={data.setekGuides} /> },
    { id: "interview", title: "면접 예상 질문", content: <InterviewSection questions={data.interviewQuestions} /> },
    { id: "bypass", title: "우회학과 분석", content: <BypassMajorSummarySection candidates={data.bypassCandidates} targetMajor={data.student.targetMajor} /> },
    { id: "warning", title: "점검 사항", content: <WarningSection recordDataByGrade={data.recordDataByGrade} storylineData={data.storylineData} diagnosisData={data.diagnosisData} strategyData={data.strategyData} studentGrade={data.student.grade} /> },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ═══ 좌측 TOC 사이드바 ═══ */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50/80 print:hidden">
        <div className="px-3 py-4">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Report</p>
          </div>
          <nav className="flex flex-col gap-0.5">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className="rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-100"
              >
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </nav>

          <div className="mt-4 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" />
              PDF 내보내기
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ 메인: A4 폭 스크롤 문서 ═══ */}
      <main className="flex-1 overflow-y-auto bg-gray-200 print:bg-white print:overflow-visible">
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
            />
          </div>

          {/* 나머지 섹션 — 각각 A4 페이지 */}
          {sections.slice(1).map((sec) => (
            <div key={sec.id} className="report-page" data-section-id={sec.id}>
              {sec.content}
            </div>
          ))}

          {/* 푸터 */}
          <div className="report-page" data-section-id="footer">
            <div className="pt-4 text-xs text-gray-400">
              {data.pipelineMeta?.startedAt && (
                <p>AI 분석: {new Date(data.pipelineMeta.startedAt).toLocaleString("ko-KR")}</p>
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
