"use client";

import { Suspense, lazy } from "react";
import type { DiagnosisTabData, StorylineTabData } from "@/lib/domains/student-record";
import type { PipelineStatus } from "@/lib/domains/student-record/pipeline";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { StageDivider, StrategySection, SectionSkeleton } from "../../StudentRecordHelpers";
import { StorylineManager } from "./StorylineManager";
import { InquiryLinkSuggestions } from "./InquiryLinkSuggestions";
import { StorylineTimeline } from "./StorylineTimeline";
import { RoadmapEditor } from "./RoadmapEditor";
import { StrategyEditor as StrategyEditorPanel } from "./StrategyEditor";
import { DesignPipelineResultsPanel } from "./DesignPipelineResultsPanel";

const CoursePlanEditor = lazy(() => import("./CoursePlanEditor"));
const ActivitySummaryPanel = lazy(() => import("./ActivitySummaryPanel").then((m) => ({ default: m.ActivitySummaryPanel })));
const SetekGuidePanel = lazy(() => import("./SetekGuidePanel").then((m) => ({ default: m.SetekGuidePanel })));
const ExplorationGuidePanel = lazy(() => import("./ExplorationGuidePanel").then((m) => ({ default: m.ExplorationGuidePanel })));
const BypassMajorPanel = lazy(() => import("./BypassMajorPanel").then((m) => ({ default: m.BypassMajorPanel })));

// ─── Types ────────────────────────────────────────────

type RecordSummary = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

export type DesignStageContentProps = {
  diagnosisData: DiagnosisTabData | null;
  diagnosisLoading: boolean;
  storylineData: StorylineTabData | null | undefined;
  storylineLoading: boolean;
  allRecordSummaries: RecordSummary[];
  pipelineData: PipelineStatus | null | undefined;
};

// ─── Component ────────────────────────────────────────

export function DesignStageContent({
  diagnosisData,
  diagnosisLoading,
  storylineData,
  storylineLoading,
  allRecordSummaries,
  pipelineData,
}: DesignStageContentProps) {
  const { studentId, tenantId, studentGrade, studentName, schoolName, initialSchoolYear } = useStudentRecordContext();

  return (
    <>
      {/* ─── 📐 설계 스테이지 구분선 ──────────── */}
      <StageDivider emoji="📐" label="설계" hint="전체 학년 통합 뷰" />

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
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          학생의 3개년 성장 서사를 직접 구성합니다. AI가 감지한 활동 간 연결은 진단 탭의 &ldquo;교차 분석&rdquo;에서 확인할 수 있습니다.
        </p>
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
    </>
  );
}
