/**
 * RequiredSubjectsSection
 * 필수 교과 설정 섹션 컴포넌트
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { WizardData } from "../../PlanGroupWizard";
import RequiredSubjectItem from "./RequiredSubjectItem";
import { getCurriculumRevisionsAction } from "@/app/(student)/actions/contentMetadataActions";
import { getCurrentStudent } from "@/app/(student)/actions/studentActions";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type RequiredSubjectsSectionProps = {
  data: WizardData;
  availableSubjects: string[];
  detailSubjects: Map<string, string[]>;
  loadingDetailSubjects: Set<string>;
  onUpdate: (updates: Partial<WizardData>) => void;
  onLoadDetailSubjects: (category: string, curriculumRevisionId?: string) => void;
  onAddRequiredSubject: () => void;
  onUpdateRequiredSubject: (
    index: number,
    updated: Partial<{
      subject_category: string;
      subject?: string;
      min_count: number;
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
  availableSubjects,
  detailSubjects,
  loadingDetailSubjects,
  onLoadDetailSubjects,
  onAddRequiredSubject,
  onUpdateRequiredSubject,
  onRemoveRequiredSubject,
  onConstraintHandlingChange,
  isTemplateMode = false,
  isCampMode = false,
  studentId,
}: RequiredSubjectsSectionProps) {
  const [curriculumRevisions, setCurriculumRevisions] = useState<CurriculumRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [studentCurriculumRevision, setStudentCurriculumRevision] = useState<string | null>(null);
  const [loadingStudentCurriculum, setLoadingStudentCurriculum] = useState(false);

  // 개정교육과정 목록 조회 (템플릿 모드 또는 캠프 모드일 때)
  useEffect(() => {
    if (isTemplateMode || isCampMode) {
      setLoadingRevisions(true);
      getCurriculumRevisionsAction()
        .then((revisions) => {
          setCurriculumRevisions(revisions || []);
        })
        .catch((error) => {
          console.error("개정교육과정 조회 실패:", error);
        })
        .finally(() => {
          setLoadingRevisions(false);
        });
    }
  }, [isTemplateMode, isCampMode]);

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

  const currentCurriculumRevisionId = data.subject_constraints?.curriculum_revision_id;

  // 템플릿의 개정교육과정과 학생의 개정교육과정 비교
  const curriculumMismatch = useMemo(() => {
    if (!isCampMode || !currentCurriculumRevisionId || !studentCurriculumRevision) {
      return null;
    }

    const templateRevision = curriculumRevisions.find(
      (r) => r.id === currentCurriculumRevisionId
    );

    if (!templateRevision) {
      return null;
    }

    // 학생의 curriculum_revision 텍스트와 템플릿의 name 비교
    // 예: "2022 개정" vs "2022개정교육과정"
    const templateNameNormalized = templateRevision.name.replace(/교육과정/g, "").trim();
    const studentRevisionNormalized = studentCurriculumRevision.trim();

    // 연도 추출하여 비교
    const templateYear = templateRevision.year;
    const studentYear = studentRevisionNormalized.match(/\d{4}/)?.[0];

    if (templateYear && studentYear) {
      return templateYear.toString() !== studentYear;
    }

    // 연도가 없으면 이름으로 비교
    return !templateNameNormalized.includes(studentRevisionNormalized) &&
           !studentRevisionNormalized.includes(templateNameNormalized);
  }, [isCampMode, currentCurriculumRevisionId, studentCurriculumRevision, curriculumRevisions]);

  const handleCurriculumRevisionChange = (revisionId: string) => {
    // 개정교육과정 변경 시 세부 과목 목록 초기화를 위해 subject_constraints 업데이트
    onUpdate({
      subject_constraints: {
        ...data.subject_constraints,
        curriculum_revision_id: revisionId || undefined,
        // 개정교육과정이 변경되면 기존 세부 과목 정보는 무효하므로 초기화
        required_subjects: data.subject_constraints?.required_subjects?.map((req) => ({
          ...req,
          subject: undefined, // 세부 과목 초기화
        })),
      },
    });
  };

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 mb-6 shadow-md">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            필수 교과 설정
          </h2>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            필수
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. (예: 국어, 수학,
          영어)
        </p>
      </div>

      <div className="space-y-4">
        {/* 개정교육과정 선택 (템플릿 모드일 때만) */}
        {isTemplateMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              개정교육과정 <span className="text-red-500">*</span>
            </label>
            {loadingRevisions ? (
              <p className="text-xs text-gray-500">개정교육과정 불러오는 중...</p>
            ) : (
              <select
                value={currentCurriculumRevisionId || ""}
                onChange={(e) => handleCurriculumRevisionChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                required={isTemplateMode}
              >
                <option value="">개정교육과정 선택</option>
                {curriculumRevisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {revision.name} {revision.year ? `(${revision.year})` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500">
              세부 과목을 지정하려면 개정교육과정을 먼저 선택하세요.
            </p>
          </div>
        )}

        {/* 학생 개정교육과정 불일치 경고 (캠프 모드일 때만) */}
        {isCampMode && curriculumMismatch && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-600">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  개정교육과정 불일치
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  템플릿의 개정교육과정과 학생의 개정교육과정이 다릅니다.{" "}
                  {studentCurriculumRevision && (
                    <>
                      학생: {studentCurriculumRevision}, 템플릿:{" "}
                      {curriculumRevisions.find(
                        (r) => r.id === currentCurriculumRevisionId
                      )?.name || "알 수 없음"}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600">
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. 세부 과목까지
          지정하여 더 정확한 제약 조건을 설정할 수 있습니다.
        </p>

        {/* 필수 교과 목록 */}
        {(data.subject_constraints?.required_subjects || []).length > 0 && (
          <div className="space-y-3">
            {(data.subject_constraints?.required_subjects || []).map(
              (req, index) => (
                <RequiredSubjectItem
                  key={index}
                  requirement={req}
                  index={index}
                  availableSubjects={availableSubjects}
                  availableDetailSubjects={
                    detailSubjects.get(req.subject_category) || []
                  }
                  loadingDetailSubjects={loadingDetailSubjects.has(
                    req.subject_category
                  )}
                  onUpdate={(updated) =>
                    onUpdateRequiredSubject(index, updated)
                  }
                  onRemove={() => onRemoveRequiredSubject(index)}
                  onLoadDetailSubjects={(category) =>
                    onLoadDetailSubjects(category, currentCurriculumRevisionId)
                  }
                />
              )
            )}
          </div>
        )}

        {/* 교과 추가 버튼 */}
        <button
          type="button"
          onClick={onAddRequiredSubject}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          + 필수 교과 추가
        </button>

        {/* 제약 조건 처리 방식 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <p className="mt-1 text-xs text-gray-500">
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

