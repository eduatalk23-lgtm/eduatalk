"use client";

import { memo, useMemo, useCallback } from "react";
import { useSettings } from "../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { CalculationInfoModal } from "../CalculationInfoModal";
import {
  calculateExamYearValue,
  calculateCurriculumRevisionValue,
} from "../../_utils/autoCalculation";
import { CURRICULUM_REVISION_OPTIONS } from "@/lib/utils/studentProfile";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getFormLabelClasses,
  getFormInputClasses,
} from "@/lib/utils/darkMode";

function ExamInfoSection() {
  const {
    formData,
    schoolType,
    autoCalculateFlags,
    modalStates,
    updateFormData,
    setAutoCalculateFlags,
    setModalState,
  } = useSettings();

  const handleFieldChange = useCallback(
    (field: keyof typeof formData) => (value: string) => {
      updateFormData({ [field]: value });
      if (field === "exam_year") {
        setAutoCalculateFlags({ examYear: false });
      } else if (field === "curriculum_revision") {
        setAutoCalculateFlags({ curriculum: false });
      }
    },
    [updateFormData, setAutoCalculateFlags]
  );

  const calculatedExamYear = useMemo(
    () =>
      formData.grade
        ? calculateExamYearValue(formData.grade, schoolType || undefined)
        : null,
    [formData.grade, schoolType]
  );

  const calculatedCurriculum = useMemo(
    () =>
      formData.grade && formData.birth_date
        ? calculateCurriculumRevisionValue(
            formData.grade,
            formData.birth_date,
            schoolType || undefined
          )
        : null,
    [formData.grade, formData.birth_date, schoolType]
  );

  return (
    <>
      <SectionCard
        title="입시 정보"
        description="입시 정보는 학습 계획 수립에 활용됩니다"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className={getFormLabelClasses()}>
                  입시년도
                </label>
                <button
                  type="button"
                  onClick={() => setModalState("examYear", true)}
                  className="text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  aria-label="입시년도 계산 방법 보기"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <label className={cn("flex items-center gap-2 text-xs", "text-gray-500 dark:text-gray-400")}>
                <input
                  type="checkbox"
                  checked={autoCalculateFlags.examYear}
                  onChange={(e) =>
                    setAutoCalculateFlags({ examYear: e.target.checked })
                  }
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span>자동 계산</span>
              </label>
            </div>
            <input
              type="number"
              value={formData.exam_year}
              onChange={(e) => {
                handleFieldChange("exam_year")(e.target.value);
              }}
              disabled={autoCalculateFlags.examYear}
              className={getFormInputClasses(false, false, autoCalculateFlags.examYear)}
              placeholder="2025"
              min="2020"
              max="2030"
            />
            {autoCalculateFlags.examYear && calculatedExamYear && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                자동 계산: {calculatedExamYear}년
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className={getFormLabelClasses()}>
                  개정교육과정
                </label>
                <button
                  type="button"
                  onClick={() => setModalState("curriculum", true)}
                  className="text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  aria-label="개정교육과정 계산 방법 보기"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <label className={cn("flex items-center gap-2 text-xs", "text-gray-500 dark:text-gray-400")}>
                <input
                  type="checkbox"
                  checked={autoCalculateFlags.curriculum}
                  onChange={(e) =>
                    setAutoCalculateFlags({ curriculum: e.target.checked })
                  }
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span>자동 계산</span>
              </label>
            </div>
            <select
              value={formData.curriculum_revision}
              onChange={(e) => {
                handleFieldChange("curriculum_revision")(e.target.value);
              }}
              disabled={autoCalculateFlags.curriculum}
              className={getFormInputClasses(false, false, autoCalculateFlags.curriculum)}
            >
              <option value="">선택하세요</option>
              {CURRICULUM_REVISION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {autoCalculateFlags.curriculum && calculatedCurriculum && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                자동 계산: {calculatedCurriculum}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

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

export default memo(ExamInfoSection);

