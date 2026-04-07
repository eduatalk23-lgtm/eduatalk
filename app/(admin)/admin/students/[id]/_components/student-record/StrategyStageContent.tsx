"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateMockScoreQueries } from "@/lib/query-options/scoreInvalidation";
import type { StrategyTabData } from "@/lib/domains/student-record";
import { useStudentRecordContext } from "./StudentRecordContext";
import { StageDivider, StrategySection, SectionSkeleton } from "./StudentRecordHelpers";
import { ApplicationBoard } from "./ApplicationBoard";
import { MinScorePanel } from "./MinScorePanel";
import { PlacementDashboard } from "./PlacementDashboard";
import { AllocationSimulator } from "./AllocationSimulator";
import { InterviewQuestionPanel } from "./InterviewQuestionPanel";
import { AlumniSearch } from "./AlumniSearch";
import { MockScoreSection } from "./MockScoreSection";

// ─── Types ────────────────────────────────────────────

type RecordSummary = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

type MergedApplications = {
  applications: Array<Record<string, unknown>>;
  interviewConflicts: Array<Record<string, unknown>>;
};

export type StrategyStageContentProps = {
  strategyData: StrategyTabData | null | undefined;
  strategyLoading: boolean;
  anySuppLoading: boolean;
  mergedApplications: MergedApplications;
  allRecordSummaries: RecordSummary[];
  scorePanelData?: import("@/lib/domains/score/actions/fetchScoreData").ScorePanelData | null;
  scorePanelLoading?: boolean;
};

// ─── Component ────────────────────────────────────────

export function StrategyStageContent({
  strategyData,
  strategyLoading,
  anySuppLoading,
  mergedApplications,
  allRecordSummaries,
  scorePanelData,
  scorePanelLoading = false,
}: StrategyStageContentProps) {
  const { studentId, tenantId, initialSchoolYear } = useStudentRecordContext();
  const queryClient = useQueryClient();
  const [showMockInput, setShowMockInput] = useState(false);

  const handleMockSaveSuccess = useCallback(() => {
    invalidateMockScoreQueries(queryClient, studentId, tenantId);
    setShowMockInput(false);
  }, [queryClient, studentId, tenantId]);

  return (
    <>
      {/* ─── 🎯 전략 스테이지 구분선 ──────────── */}
      <StageDivider emoji="🎯" label="전략" hint="전체 학년 통합 뷰" />

      {/* ─── 지원현황 ────────────────────────── */}
      <StrategySection id="sec-applications" title="지원현황">
        {anySuppLoading ? <SectionSkeleton /> : (
          <ApplicationBoard
            applications={mergedApplications.applications as never[]}
            interviewConflicts={mergedApplications.interviewConflicts as never[]}
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

      {/* ─── 모의고사 성적 관리 ────────────── */}
      <StrategySection id="sec-mock-scores" title="모의고사 성적">
        <MockScoreSection
          studentId={studentId}
          tenantId={tenantId}
          showInput={showMockInput}
          onToggleInput={() => setShowMockInput(!showMockInput)}
          scorePanelData={scorePanelData}
          scorePanelLoading={scorePanelLoading}
          onSaveSuccess={handleMockSaveSuccess}
        />
      </StrategySection>

      <StrategySection id="sec-placement" title="정시 배치 분석">
        <PlacementDashboard studentId={studentId} tenantId={tenantId} />
      </StrategySection>

      <StrategySection id="sec-allocation" title="수시 6장 배분 시뮬레이션">
        {anySuppLoading ? <SectionSkeleton /> : (
          <AllocationSimulator
            studentId={studentId}
            existingApplications={mergedApplications.applications as never[]}
          />
        )}
      </StrategySection>

      <StrategySection id="sec-interview" title="면접 예상 질문">
        <InterviewQuestionPanel records={allRecordSummaries} />
      </StrategySection>

      <StrategySection id="sec-alumni" title="졸업생 입시 DB 검색">
        <AlumniSearch />
      </StrategySection>
    </>
  );
}
