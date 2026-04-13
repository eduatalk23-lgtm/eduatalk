"use client";

import { Suspense, lazy, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RecordTabData, ActivityTag, DiagnosisTabData } from "@/lib/domains/student-record";
import type { RecordWarning } from "@/lib/domains/student-record/warnings/types";
import type { ExecutiveSummary } from "@/lib/domains/record-analysis/eval/executive-summary";
import type { UniversityMatchAnalysis } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import type { TimeSeriesAnalysis } from "@/lib/domains/record-analysis/eval/timeseries-analyzer";
import { computeWarningDiff } from "@/lib/domains/student-record/warnings/history";
import { warningSnapshotsQueryOptions } from "@/lib/query-options/studentRecord";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { StageDivider, StrategySection, SectionSkeleton } from "../../StudentRecordHelpers";
import { CompetencyAnalysisSection } from "./CompetencyAnalysisSection";
import { SameSchoolSetekInfo } from "./SameSchoolSetekInfo";
import { CrossReferenceChips } from "./CrossReferenceChips";
import { FourAxisDiagnosisCard } from "./FourAxisDiagnosisCard";
import { LevelingCard } from "./LevelingCard";
import { DiagnosisComparisonView } from "./DiagnosisComparisonView";
import { CourseAdequacyDisplay } from "./CourseAdequacyDisplay";
import { RecordWarningPanel } from "./RecordWarningPanel";
import { ExecutiveSummaryCard } from "./ExecutiveSummaryCard";
import { UniversityMatchCard } from "./UniversityMatchCard";
import { TimeSeriesCard } from "./TimeSeriesCard";

const ProjectedAnalysisSection = lazy(() =>
  import("../../../report/sections/ProjectedAnalysisSection").then((m) => ({ default: m.ProjectedAnalysisSection })),
);

// ─── Types ────────────────────────────────────────────

type RecordSummary = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

export type DiagnosisStageContentProps = {
  diagnosisData: DiagnosisTabData | null;
  diagnosisLoading: boolean;
  anyRecordLoading: boolean;
  filteredActivityTags: ActivityTag[];
  allRecordSummaries: RecordSummary[];
  currentYearTagIds: Set<string>;
  recordByGrade: Map<number, { grade: number; schoolYear: number; data: RecordTabData }>;
  isPipelineRunning: boolean;
  warnings: RecordWarning[];
  executiveSummary?: ExecutiveSummary | null;
  universityMatch?: UniversityMatchAnalysis | null;
  timeSeriesAnalysis?: TimeSeriesAnalysis | null;
};

// ─── Component ────────────────────────────────────────

export function DiagnosisStageContent({
  diagnosisData,
  diagnosisLoading,
  anyRecordLoading,
  filteredActivityTags,
  allRecordSummaries,
  currentYearTagIds,
  recordByGrade,
  isPipelineRunning,
  warnings,
  executiveSummary,
  universityMatch,
  timeSeriesAnalysis,
}: DiagnosisStageContentProps) {
  const { studentId, tenantId, studentGrade, initialSchoolYear, schoolName } = useStudentRecordContext();

  // E2: 경고 히스토리 — 이전 스냅샷과 비교
  const { data: snapshots } = useQuery(warningSnapshotsQueryOptions(studentId));
  const warningDiff = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    // snapshots[0] = 최신 (방금 완료), snapshots[1] = 이전
    return computeWarningDiff(warnings, snapshots[1]);
  }, [warnings, snapshots]);

  return (
    <>
      {/* ─── 🔍 진단 스테이지 구분선 ──────────── */}
      <StageDivider emoji="🔍" label="진단" />

      {/* F1: AI 종합 분석 (Synthesis 완료 시에만 표시) */}
      {executiveSummary && (
        <StrategySection id="sec-executive-summary" title="AI 종합 분석">
          <ExecutiveSummaryCard summary={executiveSummary} />
        </StrategySection>
      )}

      {/* F4: 역량 시계열 분석 (Synthesis 완료 시에만 표시) */}
      {timeSeriesAnalysis && (
        <StrategySection id="sec-timeseries" title="역량 성장 추이">
          <TimeSeriesCard analysis={timeSeriesAnalysis} />
        </StrategySection>
      )}

      <StrategySection id="sec-diagnosis-analysis" title="역량 분석">
        {diagnosisLoading || anyRecordLoading ? <SectionSkeleton /> : (
          <CompetencyAnalysisSection
            competencyScores={[...(diagnosisData?.competencyScores.ai ?? []), ...(diagnosisData?.competencyScores.consultant ?? [])]}
            activityTags={filteredActivityTags}
            allActivityTags={diagnosisData?.activityTags ?? []}
            records={allRecordSummaries}
            studentId={studentId}
            tenantId={tenantId}
            schoolYear={initialSchoolYear}
            isPipelineRunning={isPipelineRunning}
            targetMajor={diagnosisData?.targetMajor}
            takenSubjects={diagnosisData?.takenSubjects}
            qualityScores={diagnosisData?.qualityScores}
            scoreSemesterHints={diagnosisData?.scoreSemesterHints}
            recordByGrade={recordByGrade}
          />
        )}
      </StrategySection>

      {/* 동일과목 세특 비교 + 크로스레퍼런스 */}
      <StrategySection id="sec-diagnosis-crossref" title="교차 분석">
        <p className="mb-3 text-xs text-[var(--text-tertiary)]">
          AI가 세특·창체·행특 간 자동 감지한 연결입니다. 이를 바탕으로 설계 탭의 &ldquo;스토리라인&rdquo;을 구성할 수 있습니다.
        </p>
        {diagnosisLoading || anyRecordLoading ? <SectionSkeleton /> : (
          <div className="flex flex-col gap-4">
            {/* 같은 학교 동일 과목 세특 참고 */}
            {schoolName && allRecordSummaries.filter((r) => r.type === "setek").length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">같은 학교 동일 과목 세특</p>
                {[...new Set(allRecordSummaries.filter((r) => r.type === "setek").map((r) => r.subjectName))].map((subjectName) => {
                  const rec = allRecordSummaries.find((r) => r.type === "setek" && r.subjectName === subjectName);
                  if (!rec) return null;
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

      {/* 4축 합격 진단 프로필 */}
      {!diagnosisLoading && diagnosisData?.fourAxisDiagnosis && (
        <StrategySection id="sec-diagnosis-four-axis" title="4축 합격 진단">
          <FourAxisDiagnosisCard diagnosis={diagnosisData.fourAxisDiagnosis} />
        </StrategySection>
      )}

      {/* 레벨링 분석 (설계 모드 학생만) */}
      {!diagnosisLoading && diagnosisData?.projectedData?.leveling && (
        <StrategySection id="sec-leveling" title="레벨링 분석">
          <LevelingCard leveling={diagnosisData.projectedData.leveling} />
        </StrategySection>
      )}

      {/* 설계 모드 예상 분석 (P8 가안 + 레벨링) */}
      {!diagnosisLoading && diagnosisData?.projectedData && (
        <StrategySection id="sec-projected-analysis" title="설계 모드 예상 분석">
          <Suspense fallback={<SectionSkeleton />}>
            <ProjectedAnalysisSection
              projectedScores={diagnosisData.projectedData.competencyScores}
              projectedEdges={diagnosisData.projectedData.edges}
              leveling={diagnosisData.projectedData.leveling}
              designGrades={diagnosisData.projectedData.designGrades}
              contentQuality={diagnosisData.projectedData.contentQuality}
              narrativeContext={diagnosisData.projectedData.narrativeContext}
            />
          </Suspense>
        </StrategySection>
      )}

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

      {/* F2: 계열 적합도 (Synthesis 완료 시에만 표시) */}
      {universityMatch && (
        <StrategySection id="sec-university-match" title="계열 적합도">
          <UniversityMatchCard analysis={universityMatch} />
        </StrategySection>
      )}

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
        <RecordWarningPanel warnings={warnings} warningDiff={warningDiff} />
      </StrategySection>
    </>
  );
}
