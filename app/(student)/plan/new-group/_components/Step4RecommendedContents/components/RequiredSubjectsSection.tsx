/**
 * RequiredSubjectsSection
 * 필수 교과 설정 섹션 컴포넌트
 */

"use client";

import { WizardData } from "../../PlanGroupWizard";
import RequiredSubjectItem from "./RequiredSubjectItem";

type RequiredSubjectsSectionProps = {
  data: WizardData;
  availableSubjects: string[];
  detailSubjects: Map<string, string[]>;
  loadingDetailSubjects: Set<string>;
  onUpdate: (updates: Partial<WizardData>) => void;
  onLoadDetailSubjects: (category: string) => void;
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
}: RequiredSubjectsSectionProps) {
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
                  onLoadDetailSubjects={onLoadDetailSubjects}
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

