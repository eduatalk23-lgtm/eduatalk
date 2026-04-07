"use client";

import { lazy, Suspense, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StrategyTabData } from "@/lib/domains/student-record";
import { useStudentRecordContext } from "./StudentRecordContext";
import { StageDivider, StrategySection, SectionSkeleton } from "./StudentRecordHelpers";
import { ApplicationBoard } from "./ApplicationBoard";
import { MinScorePanel } from "./MinScorePanel";
import { PlacementDashboard } from "./PlacementDashboard";
import { AllocationSimulator } from "./AllocationSimulator";
import { InterviewQuestionPanel } from "./InterviewQuestionPanel";
import { AlumniSearch } from "./AlumniSearch";

const MockScoreInput = lazy(() => import("@/app/(student)/scores/input/_components/MockScoreInput"));

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
};

// ─── Component ────────────────────────────────────────

export function StrategyStageContent({
  strategyData,
  strategyLoading,
  anySuppLoading,
  mergedApplications,
  allRecordSummaries,
}: StrategyStageContentProps) {
  const { studentId, tenantId, initialSchoolYear } = useStudentRecordContext();
  const queryClient = useQueryClient();
  const [showMockInput, setShowMockInput] = useState(false);

  // 모의고사 입력에 필요한 교과 계층 데이터
  const { data: scorePanelData, isLoading: scorePanelLoading } = useQuery({
    queryKey: ["scorePanelData", studentId],
    queryFn: async () => {
      const { fetchScorePanelData } = await import("@/lib/domains/score/actions/fetchScoreData");
      return fetchScorePanelData(studentId);
    },
    staleTime: 5 * 60_000,
    enabled: showMockInput,
  });

  const handleMockSaveSuccess = useCallback(() => {
    // 모의고사 관련 쿼리 모두 갱신
    queryClient.invalidateQueries({ queryKey: ["mockScores"] });
    queryClient.invalidateQueries({ queryKey: ["scoreTrends"] });
    queryClient.invalidateQueries({ queryKey: ["scorePanelData"] });
    setShowMockInput(false);
  }, [queryClient]);

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

      {/* ─── 모의고사 입력 ────────────────── */}
      <StrategySection id="sec-mock-input" title="모의고사 성적 입력">
        {showMockInput ? (
          <Suspense fallback={<SectionSkeleton />}>
            {scorePanelLoading || !scorePanelData ? (
              <SectionSkeleton />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMockInput(false)}
                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  >
                    접기
                  </button>
                </div>
                <MockScoreInput
                  studentId={studentId}
                  tenantId={tenantId}
                  subjectGroups={scorePanelData.curriculumOptions?.[0]?.subjectGroups ?? scorePanelData.subjectGroups ?? []}
                  onSuccess={handleMockSaveSuccess}
                />
              </div>
            )}
          </Suspense>
        ) : (
          <button
            type="button"
            onClick={() => setShowMockInput(true)}
            className="w-full rounded-lg border border-dashed border-gray-300 p-4 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600"
          >
            + 모의고사 성적 입력
          </button>
        )}
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
