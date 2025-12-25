import React from "react";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup } from "@/lib/data/subjects";
import RequiredSubjectItem from "./RequiredSubjectItem";

interface RequiredSubjectConstraint {
  subject_group_id: string;
  subject_category: string;
  min_count: number;
  subjects_by_curriculum?: Array<{
    curriculum_revision_id: string;
    subject_id?: string;
    subject_name?: string;
  }>;
}

interface SubjectConstraints {
  enable_required_subjects_validation?: boolean;
  required_subjects?: RequiredSubjectConstraint[];
  excluded_subjects?: string[];
  constraint_handling?: "strict" | "warning" | "auto_fix";
}

interface RequiredSubjectsSectionProps {
  subjectConstraints?: SubjectConstraints;
  availableSubjectGroups: SubjectGroup[];
  curriculumRevisions: CurriculumRevision[];
  editable: boolean;
  onLoadSubjects: (
    subjectGroupId: string,
    curriculumRevisionId: string
  ) => Promise<Array<{ id: string; name: string }>>;
  onAddRequiredSubject: () => void;
  onRequiredSubjectUpdate: (
    index: number,
    updated: Partial<RequiredSubjectConstraint>
  ) => void;
  onRequiredSubjectRemove: (index: number) => void;
  onConstraintHandlingChange: (handling: "strict" | "warning" | "auto_fix") => void;
}

/**
 * 필수 교과 설정 섹션 컴포넌트
 *
 * 템플릿 모드에서 플랜 생성 시 필수로 포함되어야 하는 교과를 설정
 */
export function RequiredSubjectsSection({
  subjectConstraints,
  availableSubjectGroups,
  curriculumRevisions,
  editable,
  onLoadSubjects,
  onAddRequiredSubject,
  onRequiredSubjectUpdate,
  onRequiredSubjectRemove,
  onConstraintHandlingChange,
}: RequiredSubjectsSectionProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-blue-300 bg-blue-50 p-6 shadow-md">
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
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다. (예: 국어,
          수학, 영어)
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          플랜 생성 시 반드시 포함되어야 하는 교과를 설정합니다.
          개정교육과정별로 세부 과목을 지정하여 더 정확한 제약 조건을 설정할
          수 있습니다.
        </p>

        {/* 필수 교과 목록 */}
        {(subjectConstraints?.required_subjects || []).length > 0 && (
          <div className="flex flex-col gap-3">
            {(subjectConstraints?.required_subjects || []).map(
              (req, index) => (
                <RequiredSubjectItem
                  key={index}
                  requirement={req}
                  index={index}
                  availableSubjectGroups={availableSubjectGroups}
                  curriculumRevisions={curriculumRevisions}
                  onLoadSubjects={onLoadSubjects}
                  onUpdate={(updated) => onRequiredSubjectUpdate(index, updated)}
                  onRemove={() => onRequiredSubjectRemove(index)}
                />
              )
            )}
          </div>
        )}

        {/* 교과 추가 버튼 */}
        <button
          type="button"
          onClick={onAddRequiredSubject}
          disabled={!editable}
          className={`w-full rounded-lg border-2 border-dashed p-3 text-sm transition-colors ${
            !editable
              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
              : "border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-600"
          }`}
        >
          + 필수 교과 추가
        </button>

        {/* 제약 조건 처리 방식 */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">
            제약 조건 처리 방식
          </label>
          <select
            value={subjectConstraints?.constraint_handling || "warning"}
            onChange={(e) =>
              onConstraintHandlingChange(
                e.target.value as "strict" | "warning" | "auto_fix"
              )
            }
            disabled={!editable}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
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
          <p className="text-xs text-gray-600">
            {subjectConstraints?.constraint_handling === "warning" &&
              "조건 미충족 시 경고를 표시하지만 다음 단계로 진행할 수 있습니다."}
            {subjectConstraints?.constraint_handling === "strict" &&
              "조건을 반드시 충족해야 다음 단계로 진행할 수 있습니다."}
            {subjectConstraints?.constraint_handling === "auto_fix" &&
              "시스템이 자동으로 필요한 콘텐츠를 추천합니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
