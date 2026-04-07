"use client";

import type { RecordTabData, RecordReading, ActivityTag, DiagnosisTabData } from "@/lib/domains/student-record";
import type { CoursePlanTabData } from "@/lib/domains/student-record/course-plan/types";
import type { SetekLayerTab } from "./SetekEditor";
import { useStudentRecordContext } from "./StudentRecordContext";
import { DocSection, GradeLabel, SectionSkeleton, EmptyTable, InfoRow } from "./StudentRecordHelpers";
import { AttendanceEditor, AttendanceTableHeader } from "./AttendanceEditor";
import { ChangcheEditor } from "./ChangcheEditor";
import { SupplementaryEditor } from "./SupplementaryEditor";
import { ReadingEditor } from "./ReadingEditor";
import { HaengteukEditor } from "./HaengteukEditor";
import { GradesAndSetekSection } from "./GradesAndSetekSection";

// ─── Types ────────────────────────────────────────────

type GradeYearPair = { grade: number; schoolYear: number };

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
};

type GuideAssignment = {
  id: string;
  guide_id: string;
  status: string;
  exploration_guides?: { id: string; title: string; guide_type?: string };
};

type SetekGuideItem = {
  subjectName: string;
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus: string;
  cautions?: string;
  teacherPoints: string;
  guideMode: "retrospective" | "prospective";
};

type ChangcheGuideItem = {
  activityType: string;
  activityLabel: string;
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus: string;
  cautions?: string;
  teacherPoints: string;
  guideMode: "retrospective" | "prospective";
};

type HaengteukGuideItem = {
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus: string;
  cautions?: string;
  teacherPoints: string;
  evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
  guideMode: "retrospective" | "prospective";
};

type MergedSupplementary = {
  awards: Array<Record<string, unknown>>;
  volunteer: Array<Record<string, unknown>>;
  disciplinary: Array<Record<string, unknown>>;
};

export type RecordStageContentProps = {
  subjects: Subject[];
  visiblePairs: GradeYearPair[];
  recordByGrade: Map<number, { grade: number; schoolYear: number; data: RecordTabData }>;
  anyRecordLoading: boolean;
  anySuppLoading: boolean;
  mergedSupplementary: MergedSupplementary;
  mergedReadings: RecordReading[];
  diagnosisData: DiagnosisTabData | null;
  coursePlanData: CoursePlanTabData | null | undefined;
  globalSetekTab: SetekLayerTab;
  onSetekTabChange: (tab: SetekLayerTab) => void;
  guideAssignments?: GuideAssignment[];
  setekGuideItems?: SetekGuideItem[];
  changcheGuideItems?: ChangcheGuideItem[];
  haengteukGuideItems?: HaengteukGuideItem[];
};

// ─── Component ────────────────────────────────────────

export function RecordStageContent({
  subjects,
  visiblePairs,
  recordByGrade,
  anyRecordLoading,
  anySuppLoading,
  mergedSupplementary,
  mergedReadings,
  diagnosisData,
  coursePlanData,
  globalSetekTab,
  onSetekTabChange,
  guideAssignments,
  setekGuideItems,
  changcheGuideItems,
  haengteukGuideItems,
}: RecordStageContentProps) {
  const { studentId, tenantId, studentName, schoolName, studentGrade, initialSchoolYear } = useStudentRecordContext();

  return (
    <>
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
            awards={mergedSupplementary.awards as never[]}
            volunteer={[]}
            disciplinary={mergedSupplementary.disciplinary as never[]}
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
                    guideAssignments={guideAssignments}
                    changcheGuideItems={changcheGuideItems}
                    activeTab={globalSetekTab}
                    onTabChange={onSetekTabChange}
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
              volunteer={mergedSupplementary.volunteer as never[]}
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
                setekGuideItems={setekGuideItems}
                guideAssignments={guideAssignments}
                confirmedPlansForGrade={confirmedForGrade}
                studentClassificationId={diagnosisData?.targetSubClassificationId}
                studentClassificationName={diagnosisData?.targetSubClassificationName}
                schoolName={schoolName}
                courseAdequacy={diagnosisData?.courseAdequacy}
                activeSetekTab={globalSetekTab}
                onSetekTabChange={onSetekTabChange}
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
                    guideAssignments={guideAssignments}
                    haengteukGuideItem={haengteukGuideItems?.find((g) => g.schoolYear === p.schoolYear)}
                    activeTab={globalSetekTab}
                    onTabChange={onSetekTabChange}
                  />
                </div>
              );
            })}
          </div>
        )}
      </DocSection>
    </>
  );
}
