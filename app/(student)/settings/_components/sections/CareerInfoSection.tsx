"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useController, useWatch, type Control } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { CalculationInfoModal } from "../CalculationInfoModal";
import {
  CURRICULUM_REVISION_OPTIONS,
  CAREER_FIELD_OPTIONS,
} from "@/lib/utils/studentProfile";
import {
  TIER1_TO_MAJORS,
  type CareerTier1Code,
} from "@/lib/constants/career-classification";
import {
  getSubClassifications,
  type SubClassificationOption,
} from "@/lib/domains/student/actions/classification";
import {
  calculateExamYearValue,
  calculateCurriculumRevisionValue,
} from "../../_utils/autoCalculation";
import type { StudentFormData } from "../../types";
import { Info } from "lucide-react";

type AutoCalculateFlags = {
  examYear: boolean;
  curriculum: boolean;
};

type ModalStates = {
  examYear: boolean;
  curriculum: boolean;
};

type CareerInfoSectionProps = {
  control: Control<StudentFormData>;
  disabled?: boolean;
  autoCalculateFlags: AutoCalculateFlags;
  setAutoCalculateFlags: (flags: Partial<AutoCalculateFlags>) => void;
  schoolType?: "중학교" | "고등학교" | undefined;
  modalStates: ModalStates;
  setModalState: (modal: keyof ModalStates, open: boolean) => void;
};

const RANK_LABELS = ["1순위", "2순위", "3순위"] as const;

export default function CareerInfoSection({
  control,
  disabled,
  autoCalculateFlags,
  setAutoCalculateFlags,
  schoolType,
  modalStates,
  setModalState,
}: CareerInfoSectionProps) {
  const examYearField = useController({ name: "exam_year", control });
  const curriculumRevisionField = useController({ name: "curriculum_revision", control });
  const desiredUniversityIdsField = useController({ name: "desired_university_ids", control });
  const desiredCareerFieldField = useController({ name: "desired_career_field", control });
  const targetMajorField = useController({ name: "target_major", control });
  const subClassField = useController({ name: "target_sub_classification_id", control });

  const gradeValue = useWatch({ name: "grade", control });
  const birthDateValue = useWatch({ name: "birth_date", control });
  const careerFieldValue = useWatch({ name: "desired_career_field", control });
  const targetMajorValue = useWatch({ name: "target_major", control });

  // Tier 3 소분류 옵션 (서버에서 비동기 로드)
  const [subOptions, setSubOptions] = useState<SubClassificationOption[]>([]);

  const ids = desiredUniversityIdsField.field.value || [];
  const slotValues = [ids[0] || "", ids[1] || "", ids[2] || ""];

  const handleSlotChange = useCallback(
    (slotIndex: number, newId: string) => {
      const slots = [ids[0] || "", ids[1] || "", ids[2] || ""];
      slots[slotIndex] = newId;
      desiredUniversityIdsField.field.onChange(slots.filter(Boolean));
    },
    [ids, desiredUniversityIdsField.field]
  );

  // Tier 1 → Tier 2 옵션
  const majorOptions = useMemo(() => {
    if (!careerFieldValue) return [];
    const majors = TIER1_TO_MAJORS[careerFieldValue as CareerTier1Code] ?? [];
    return majors.map((m) => ({ value: m, label: m }));
  }, [careerFieldValue]);

  // Tier 2 변경 시 → Tier 3 비동기 로드
  useEffect(() => {
    if (!targetMajorValue) {
      setSubOptions([]);
      return;
    }
    let cancelled = false;
    getSubClassifications(targetMajorValue).then((data) => {
      if (!cancelled) setSubOptions(data);
    });
    return () => { cancelled = true; };
  }, [targetMajorValue]);

  // Tier 1 변경 시 Tier 2, Tier 3 초기화
  const handleCareerFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      desiredCareerFieldField.field.onChange(e);
      targetMajorField.field.onChange("");
      subClassField.field.onChange("");
    },
    [desiredCareerFieldField.field, targetMajorField.field, subClassField.field]
  );

  // Tier 2 변경 시 Tier 3 초기화
  const handleTargetMajorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      targetMajorField.field.onChange(e);
      subClassField.field.onChange("");
    },
    [targetMajorField.field, subClassField.field]
  );

  const calculatedExamYear = useMemo(
    () => gradeValue ? calculateExamYearValue(gradeValue, schoolType || undefined) : null,
    [gradeValue, schoolType]
  );

  const calculatedCurriculum = useMemo(
    () =>
      gradeValue && birthDateValue
        ? calculateCurriculumRevisionValue(gradeValue, birthDateValue, schoolType || undefined)
        : null,
    [gradeValue, birthDateValue, schoolType]
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            진로 정보
          </h3>
          <div className="flex flex-col gap-4">
            {/* 교육과정 / 수능연도 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 교육과정 + 자동계산 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-gray-700">교육과정</label>
                    <button
                      type="button"
                      onClick={() => setModalState("curriculum", true)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      aria-label="개정교육과정 계산 방법 보기"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={autoCalculateFlags.curriculum}
                      onChange={(e) => setAutoCalculateFlags({ curriculum: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span>자동</span>
                  </label>
                </div>
                <FormSelect
                  {...curriculumRevisionField.field}
                  label=""
                  disabled={disabled || autoCalculateFlags.curriculum}
                  options={[
                    { value: "", label: "선택 안 함" },
                    ...CURRICULUM_REVISION_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
                  ]}
                  className="[&>label]:hidden"
                  error={curriculumRevisionField.fieldState.error?.message}
                />
                {autoCalculateFlags.curriculum && calculatedCurriculum && (
                  <p className="text-xs text-gray-500">자동 계산: {calculatedCurriculum}</p>
                )}
              </div>

              {/* 수능연도 + 자동계산 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-gray-700">수능연도</label>
                    <button
                      type="button"
                      onClick={() => setModalState("examYear", true)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      aria-label="입시년도 계산 방법 보기"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={autoCalculateFlags.examYear}
                      onChange={(e) => setAutoCalculateFlags({ examYear: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span>자동</span>
                  </label>
                </div>
                <FormField
                  {...examYearField.field}
                  label=""
                  type="number"
                  placeholder="예: 2025"
                  disabled={disabled || autoCalculateFlags.examYear}
                  className="[&>label]:hidden"
                  error={examYearField.fieldState.error?.message}
                />
                {autoCalculateFlags.examYear && calculatedExamYear && (
                  <p className="text-xs text-gray-500">자동 계산: {calculatedExamYear}년</p>
                )}
              </div>
            </div>

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

      <CalculationInfoModal
        open={modalStates.examYear}
        onOpenChange={(open) => setModalState("examYear", open)}
        type="exam_year"
      />
      <CalculationInfoModal
        open={modalStates.curriculum}
        onOpenChange={(open) => setModalState("curriculum", open)}
        type="curriculum_revision"
      />
    </>
  );
}
