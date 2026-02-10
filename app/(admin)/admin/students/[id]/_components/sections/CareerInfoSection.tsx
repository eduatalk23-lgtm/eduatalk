"use client";

import { useCallback } from "react";
import { useController, type Control } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import {
  CURRICULUM_REVISION_OPTIONS,
  CAREER_FIELD_OPTIONS,
} from "@/lib/utils/studentProfile";
import type { AdminStudentFormData } from "../../_types/studentFormTypes";

type CareerInfoSectionProps = {
  control: Control<AdminStudentFormData>;
  disabled?: boolean;
};

const RANK_LABELS = ["1순위", "2순위", "3순위"] as const;

export default function CareerInfoSection({
  control,
  disabled,
}: CareerInfoSectionProps) {
  const examYearField = useController({
    name: "exam_year",
    control,
  });

  const curriculumRevisionField = useController({
    name: "curriculum_revision",
    control,
  });

  const desiredUniversityIdsField = useController({
    name: "desired_university_ids",
    control,
  });

  const desiredCareerFieldField = useController({
    name: "desired_career_field",
    control,
  });

  const ids = desiredUniversityIdsField.field.value || [];

  // 슬롯별 값 (배열 인덱스 = 순위 - 1)
  const slotValues = [ids[0] || "", ids[1] || "", ids[2] || ""];

  const handleSlotChange = useCallback(
    (slotIndex: number, newId: string) => {
      const slots = [ids[0] || "", ids[1] || "", ids[2] || ""];
      slots[slotIndex] = newId;
      // 빈 값 제거하여 저장 (앞으로 당김)
      desiredUniversityIdsField.field.onChange(slots.filter(Boolean));
    },
    [ids, desiredUniversityIdsField.field]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">진로 정보</h3>
        <div className="flex flex-col gap-4">
          {/* 교육과정 / 수능연도 / 진로계열 — 한 행 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormSelect
              {...curriculumRevisionField.field}
              label="교육과정"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...CURRICULUM_REVISION_OPTIONS.map((c) => ({
                  value: c.value,
                  label: c.label,
                })),
              ]}
              error={curriculumRevisionField.fieldState.error?.message}
            />
            <FormField
              {...examYearField.field}
              label="수능연도"
              type="number"
              placeholder="예: 2025"
              disabled={disabled}
              error={examYearField.fieldState.error?.message}
            />
            <FormSelect
              {...desiredCareerFieldField.field}
              label="진로계열"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...CAREER_FIELD_OPTIONS.map((c) => ({
                  value: c.value,
                  label: c.label,
                })),
              ]}
              error={desiredCareerFieldField.fieldState.error?.message}
            />
          </div>

          {/* 희망 대학교 — 3슬롯 한 행 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {RANK_LABELS.map((label, index) => (
              <div key={label}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  희망대학 {label}
                </label>
                <SchoolSelect
                  value={slotValues[index]}
                  onChange={(val) => handleSlotChange(index, val)}
                  type="대학교"
                  placeholder="대학교 검색"
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
          {desiredUniversityIdsField.fieldState.error && (
            <p className="text-body-2 text-error-600 dark:text-error-400 mt-1">
              {desiredUniversityIdsField.fieldState.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
