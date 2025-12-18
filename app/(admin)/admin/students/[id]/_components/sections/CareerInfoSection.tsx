"use client";

import { useController } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolMultiSelect from "@/components/ui/SchoolMultiSelect";
import {
  CURRICULUM_REVISION_OPTIONS,
  CAREER_FIELD_OPTIONS,
} from "@/lib/utils/studentProfile";

type CareerInfoSectionProps = {
  control: any; // React Hook Form의 Control 타입
};

export default function CareerInfoSection({
  control,
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">진로 정보</h3>
        <div className="flex flex-col gap-4">
          <FormField
            {...examYearField.field}
            label="수능연도"
            type="number"
            placeholder="예: 2025"
            error={examYearField.fieldState.error?.message}
          />

          <FormSelect
            {...curriculumRevisionField.field}
            label="교육과정"
            options={[
              { value: "", label: "선택 안 함" },
              ...CURRICULUM_REVISION_OPTIONS.map((c) => ({
                value: c.value,
                label: c.label,
              })),
            ]}
            error={curriculumRevisionField.fieldState.error?.message}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              희망 대학교 (최대 3개)
            </label>
            <SchoolMultiSelect
              value={desiredUniversityIdsField.field.value || []}
              onChange={desiredUniversityIdsField.field.onChange}
              type="대학교"
              placeholder="대학교를 검색하세요"
              maxCount={3}
            />
            {desiredUniversityIdsField.fieldState.error && (
              <p className="text-body-2 text-error-600 dark:text-error-400 mt-1">
                {desiredUniversityIdsField.fieldState.error.message}
              </p>
            )}
          </div>

          <FormSelect
            {...desiredCareerFieldField.field}
            label="진로계열"
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
      </div>
    </div>
  );
}

