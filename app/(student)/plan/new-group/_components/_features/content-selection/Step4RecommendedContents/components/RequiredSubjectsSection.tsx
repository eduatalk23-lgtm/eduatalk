/**
 * RequiredSubjectsSection
 * 필수 교과 설정 섹션 컴포넌트
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import RequiredSubjectItem from "./RequiredSubjectItem";
import { getCurriculumRevisionsAction, getSubjectGroupsAction } from "@/lib/domains/content";
import { getCurrentStudent } from "@/app/(student)/actions/studentActions";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup } from "@/lib/data/subjects";

type RequiredSubjectsSectionProps = {
  data: WizardData;
  availableSubjectGroups: SubjectGroup[]; // subject_groups 테이블에서 조회
  curriculumRevisions: CurriculumRevision[]; // 개정교육과정 목록
  onUpdate: (updates: Partial<WizardData>) => void;
  onLoadSubjects: (subjectGroupId: string, curriculumRevisionId: string) => Promise<Array<{ id: string; name: string }>>;
  onAddRequiredSubject: () => void;
  onUpdateRequiredSubject: (
    index: number,
    updated: Partial<{
      subject_group_id: string;
      subject_category: string;
      min_count: number;
      subjects_by_curriculum?: Array<{
        curriculum_revision_id: string;
        subject_id?: string;
        subject_name?: string;
      }>;
    }>
  ) => void;
  onRemoveRequiredSubject: (index: number) => void;
  onConstraintHandlingChange: (handling: "strict" | "warning" | "auto_fix") => void;
  isTemplateMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
};

export default function RequiredSubjectsSection({
  data,
  availableSubjectGroups,
  curriculumRevisions,
  onLoadSubjects,
  onAddRequiredSubject,
  onUpdateRequiredSubject,
  onRemoveRequiredSubject,
  onConstraintHandlingChange,
  isTemplateMode = false,
  isCampMode = false,
  studentId,
}: RequiredSubjectsSectionProps) {
  const [studentCurriculumRevision, setStudentCurriculumRevision] = useState<string | null>(null);
  const [loadingStudentCurriculum, setLoadingStudentCurriculum] = useState(false);

  // 학생의 개정교육과정 확인 (캠프 모드일 때만)
  useEffect(() => {
    if (isCampMode && studentId) {
      setLoadingStudentCurriculum(true);
      getCurrentStudent()
        .then((student) => {
          if (student?.curriculum_revision) {
            setStudentCurriculumRevision(student.curriculum_revision);
          }
        })
        .catch((error) => {
          console.error("학생 개정교육과정 조회 실패:", error);
        })
        .finally(() => {
          setLoadingStudentCurriculum(false);
        });
    }
  }, [isCampMode, studentId]);

  // 템플릿의 개정교육과정과 학생의 개정교육과정 비교
  const curriculumMismatch = useMemo(() => {
    if (!isCampMode || !studentCurriculumRevision) {
      return null;
    }

    // required_subjects에서 사용 중인 개정교육과정 확인
    const usedCurriculumIds = new Set<string>();
    const requiredSubjects = data.subject_constraints?.required_subjects || [];
    requiredSubjects.forEach((req) => {
      req.subjects_by_curriculum?.forEach((subj) => {
        if (subj.curriculum_revision_id) {
          usedCurriculumIds.add(subj.curriculum_revision_id);
        }
      });
    });

    if (usedCurriculumIds.size === 0) {
      return null;
    }

    // 학생의 curriculum_revision 텍스트와 사용 중인 개정교육과정 비교
    const studentRevisionNormalized = studentCurriculumRevision.trim();
    const studentYear = studentRevisionNormalized.match(/\d{4}/)?.[0];

    // 사용 중인 개정교육과정 중 학생의 개정교육과정과 일치하는 것이 있는지 확인
    const hasMatchingCurriculum = Array.from(usedCurriculumIds).some((revisionId) => {
      const revision = curriculumRevisions.find((r) => r.id === revisionId);
      if (!revision) return false;

      const revisionYear = revision.year?.toString();
      if (revisionYear && studentYear) {
        return revisionYear === studentYear;
      }

      const revisionNameNormalized = revision.name.replace(/교육과정/g, "").trim();
      return (
        revisionNameNormalized.includes(studentRevisionNormalized) ||
        studentRevisionNormalized.includes(revisionNameNormalized)
      );
    });

    return !hasMatchingCurriculum;
  }, [isCampMode, studentCurriculumRevision, curriculumRevisions, data.subject_constraints]);

  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-blue-300 bg-blue-50 p-6 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            필수 교과 설정
          </h2>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            필수
          </span>
        </div>
        <p className="text-sm text-gray-600">
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. (예: 국어, 수학,
          영어)
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* 학생 개정교육과정 불일치 경고 (캠프 모드일 때만) */}
        {isCampMode && curriculumMismatch && (
          <div className="flex flex-col gap-1 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600">⚠️</span>
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-medium text-amber-800">
                  개정교육과정 불일치
                </p>
                <p className="text-xs text-amber-700">
                  템플릿에 설정된 개정교육과정과 학생의 개정교육과정이 다릅니다.{" "}
                  {studentCurriculumRevision && (
                    <>학생: {studentCurriculumRevision}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600">
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. 개정교육과정별로
          세부 과목을 지정하여 더 정확한 제약 조건을 설정할 수 있습니다.
        </p>

        {/* 필수 교과 목록 */}
        {(data.subject_constraints?.required_subjects || []).length > 0 && (
          <div className="flex flex-col gap-3">
            {(data.subject_constraints?.required_subjects || []).map(
              (req, index: number) => (
                <RequiredSubjectItem
                  key={index}
                  requirement={req}
                  index={index}
                  availableSubjectGroups={availableSubjectGroups}
                  curriculumRevisions={curriculumRevisions}
                  onLoadSubjects={onLoadSubjects}
                  onUpdate={(updated) =>
                    onUpdateRequiredSubject(index, updated)
                  }
                  onRemove={() => onRemoveRequiredSubject(index)}
                />
              )
            )}
          </div>
        )}

        {/* 교과 추가 버튼 */}
        <button
          type="button"
          onClick={onAddRequiredSubject}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          + 필수 교과 추가
        </button>

        {/* 제약 조건 처리 방식 */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-800">
            제약 조건 처리 방식
          </label>
          <select
            value={data.subject_constraints?.constraint_handling || "warning"}
            onChange={(e) =>
              onConstraintHandlingChange(
                e.target.value as "strict" | "warning" | "auto_fix"
              )
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="warning">
              경고 (권장) - 경고만 표시하고 진행
            </option>
            <option value="strict">
              엄격 (필수) - 조건 미충족 시 진행 불가
            </option>
            <option value="auto_fix">
              자동 보정 - 시스템이 자동으로 보정
            </option>
          </select>
          <p className="text-xs text-gray-500">
            {data.subject_constraints?.constraint_handling === "warning" &&
              "조건 미충족 시 경고를 표시하지만 다음 단계로 진행할 수 있습니다."}
            {data.subject_constraints?.constraint_handling === "strict" &&
              "조건을 반드시 충족해야 다음 단계로 진행할 수 있습니다."}
            {data.subject_constraints?.constraint_handling === "auto_fix" &&
              "시스템이 자동으로 필요한 콘텐츠를 추천합니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

