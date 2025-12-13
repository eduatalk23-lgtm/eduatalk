"use client";

import { memo, useCallback } from "react";
import { useSettings } from "../../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import SchoolMultiSelect from "@/components/ui/SchoolMultiSelect";
import { CAREER_FIELD_OPTIONS } from "@/lib/utils/studentProfile";

function CareerInfoSection() {
  const { formData, updateFormData } = useSettings();

  const handleFieldChange = useCallback(
    (field: keyof typeof formData) => (value: string) => {
      updateFormData({ [field]: value });
    },
    [updateFormData]
  );

  return (
    <SectionCard
      title="진로 정보"
      description="진로 정보는 맞춤형 학습 추천에 활용됩니다"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            진학 희망 대학교 (1순위, 2순위, 3순위)
          </label>
          <p className="text-xs text-gray-500">
            최대 3개까지 선택 가능하며, 선택한 순서대로 1순위, 2순위, 3순위로 표시됩니다.
          </p>
          <SchoolMultiSelect
            value={formData.desired_university_ids}
            onChange={(ids) => {
              updateFormData({ desired_university_ids: ids });
            }}
            type="대학교"
            placeholder="대학교를 검색하세요"
            maxCount={3}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            희망 진로 계열
          </label>
          <select
            value={formData.desired_career_field}
            onChange={(e) =>
              handleFieldChange("desired_career_field")(e.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">선택하세요</option>
            {CAREER_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SectionCard>
  );
}

export default memo(CareerInfoSection);

