"use client";

// ============================================
// 7번 교과학습 통합 섹션 (성적→세특 연속 배치)
// ============================================

import { useMemo } from "react";
import type { RecordSetek, RecordPersonalSetek } from "@/lib/domains/student-record";
import { RecordGradesDisplay } from "../../RecordGradesDisplay";
import { SetekEditor } from "./SetekEditor";
import { PersonalSetekEditor } from "../../PersonalSetekEditor";
import { SubHeader, SectionSkeleton } from "../../StudentRecordHelpers";
import type { SetekLayerTab } from "./SetekEditor";

type Subject = {
  id: string;
  name: string;
  subject_group?: { name: string } | null;
  subject_type?: { name: string; is_achievement_only: boolean } | null;
};

const PE_ART_GROUPS = new Set(["체육", "예술"]);
const ELECTIVE_TYPES = new Set(["진로선택", "진로 선택", "융합선택", "융합 선택"]);

export function classifySubjectId(subjectId: string, subjects: Subject[]): "general" | "elective" | "pe_art" | "liberal" {
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

export function GradesAndSetekSection({
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
  layer,
  perspective,
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
  guideAssignments?: Array<{
    id: string;
    guide_id: string;
    status: string;
    ai_recommendation_reason?: string | null;
    student_notes?: string | null;
    target_subject_id?: string | null;
    target_activity_type?: string | null;
    school_year?: number;
    exploration_guides?: { id: string; title: string; guide_type?: string };
  }>;
  confirmedPlansForGrade?: Array<{ subjectId: string; subjectName: string; semester: number; subjectGroupName: string; subjectTypeName: string }>;
  studentClassificationId?: number | null;
  studentClassificationName?: string | null;
  schoolName?: string | null;
  courseAdequacy?: import("@/lib/domains/student-record").CourseAdequacyResult | null;
  activeSetekTab?: SetekLayerTab;
  onSetekTabChange?: (tab: SetekLayerTab) => void;
  /** Phase 2.1: 글로벌 9 레이어 (생기부 모형 유지, 미지원 레이어는 셀 단위 stub) */
  layer?: import("@/lib/domains/student-record/layer-view").LayerKey;
  /** Phase 2.1: 글로벌 관점 (분석 레이어 source 필터 등) */
  perspective?: import("@/lib/domains/student-record/layer-view").LayerPerspective | null;
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
            layer={layer}
            perspective={perspective}
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
            layer={layer}
            perspective={perspective}
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
            layer={layer}
            perspective={perspective}
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
