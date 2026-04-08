"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useController, useWatch, type Control, type FieldValues } from "react-hook-form";
import { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import ExamTimeline from "@/components/molecules/ExamTimeline";
import { CAREER_FIELD_OPTIONS } from "@/lib/utils/studentProfile";
import {
  TIER1_TO_MAJORS,
  type CareerTier1Code,
} from "@/lib/constants/career-classification";
import { SCHOOL_TIER_OPTIONS } from "@/lib/constants/school-tiers";
import {
  getSubClassifications,
  type SubClassificationOption,
} from "@/lib/domains/student/actions/classification";

type CareerInfoSectionProps = {
  control: Control<FieldValues>;
  disabled?: boolean;
  schoolType?: "중학교" | "고등학교";
  config?: {
    showSchoolTier?: boolean;
  };
};

const RANK_LABELS = ["1순위", "2순위", "3순위"] as const;

export default function CareerInfoSection({
  control,
  disabled,
  schoolType,
  config,
}: CareerInfoSectionProps) {
  // --- hooks (항상 호출, hooks 규칙 준수) ---
  const desiredUniversityIdsField = useController({ name: "desired_university_ids", control });
  const desiredCareerFieldField = useController({ name: "desired_career_field", control });
  const targetMajorField = useController({ name: "target_major", control });
  const subClassField = useController({ name: "target_sub_classification_id", control });
  const schoolTierField = useController({ name: "target_school_tier", control });

  const gradeValue = useWatch({ name: "grade", control });
  const divisionValue = useWatch({ name: "division", control });
  const careerFieldValue = useWatch({ name: "desired_career_field", control });
  const targetMajorValue = useWatch({ name: "target_major", control });

  // --- schoolType 결정: division > prop > 기본값 ---
  const resolvedSchoolType = useMemo(() => {
    if (divisionValue === "중등부") return "중학교" as const;
    if (divisionValue === "고등부") return "고등학교" as const;
    return schoolType ?? ("고등학교" as const);
  }, [divisionValue, schoolType]);

  // --- Tier 3 소분류 옵션 (비동기) ---
  const [subOptions, setSubOptions] = useState<SubClassificationOption[]>([]);

  // --- 희망대학 3슬롯 ---
  const ids: string[] = desiredUniversityIdsField.field.value || [];
  const slotValues = [ids[0] || "", ids[1] || "", ids[2] || ""];

  const handleSlotChange = useCallback(
    (slotIndex: number, newId: string) => {
      const slots = [ids[0] || "", ids[1] || "", ids[2] || ""];
      slots[slotIndex] = newId;
      desiredUniversityIdsField.field.onChange(slots.filter(Boolean));
    },
    [ids, desiredUniversityIdsField.field],
  );

  // --- Tier 1 → Tier 2 옵션 ---
  const majorOptions = useMemo(() => {
    if (!careerFieldValue) return [];
    const majors = TIER1_TO_MAJORS[careerFieldValue as CareerTier1Code] ?? [];
    return majors.map((m) => ({ value: m, label: m }));
  }, [careerFieldValue]);

  // --- Tier 2 변경 → Tier 3 비동기 로드 ---
  useEffect(() => {
    if (!targetMajorValue) {
      setSubOptions([]);
      return;
    }
    let cancelled = false;
    getSubClassifications(targetMajorValue).then((data) => {
      if (!cancelled) setSubOptions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [targetMajorValue]);

  // --- Tier 1 변경 → Tier 2, 3 초기화 ---
  const handleCareerFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      desiredCareerFieldField.field.onChange(e);
      targetMajorField.field.onChange("");
      subClassField.field.onChange("");
    },
    [desiredCareerFieldField.field, targetMajorField.field, subClassField.field],
  );

  // --- Tier 2 변경 → Tier 3 초기화 ---
  const handleTargetMajorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      targetMajorField.field.onChange(e);
      subClassField.field.onChange("");
    },
    [targetMajorField.field, subClassField.field],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">진로 정보</h3>
        <div className="flex flex-col gap-4">
          {/* 수능 타임라인 (학년 기반 자동 산출) */}
          <ExamTimeline grade={gradeValue} schoolType={resolvedSchoolType} />

          {/* 목표 학교권 (어드민 상세에서만 표시) */}
          {config?.showSchoolTier && (
            <FormSelect
              {...schoolTierField.field}
              label="목표 학교권"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...SCHOOL_TIER_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
              ]}
              error={schoolTierField.fieldState.error?.message}
            />
          )}

          {/* 진로계열 (Tier 1) + 전공방향 (Tier 2) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormSelect
              {...desiredCareerFieldField.field}
              onChange={handleCareerFieldChange}
              label="진로계열"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...CAREER_FIELD_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
              ]}
              error={desiredCareerFieldField.fieldState.error?.message}
            />
            <FormSelect
              {...targetMajorField.field}
              onChange={handleTargetMajorChange}
              label="전공방향"
              disabled={disabled || !careerFieldValue || majorOptions.length === 0}
              options={[
                { value: "", label: careerFieldValue ? "선택 안 함" : "계열을 먼저 선택하세요" },
                ...majorOptions,
              ]}
              error={targetMajorField.fieldState.error?.message}
            />
          </div>

          {/* 세부 전공 (Tier 3) — 전공방향 선택 시만 표시 */}
          {targetMajorValue && subOptions.length > 0 && (
            <FormSelect
              {...subClassField.field}
              label="세부 전공 (선택)"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...subOptions.map((s) => ({
                  value: String(s.id),
                  label: s.sub_name,
                })),
              ]}
              error={subClassField.fieldState.error?.message}
            />
          )}

          {/* 희망 대학교 — 3슬롯 */}
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
