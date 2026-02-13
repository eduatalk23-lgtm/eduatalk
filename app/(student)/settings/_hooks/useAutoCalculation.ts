/**
 * 자동 계산 훅 (react-hook-form watch/setValue 기반)
 */

import { useEffect, useRef } from "react";
import type { UseFormWatch, UseFormSetValue } from "react-hook-form";
import type { StudentFormData } from "../types";
import {
  calculateExamYearValue,
  calculateCurriculumRevisionValue,
} from "../_utils/autoCalculation";

type UseAutoCalculationProps = {
  watch: UseFormWatch<StudentFormData>;
  setValue: UseFormSetValue<StudentFormData>;
  schoolType: "중학교" | "고등학교" | undefined;
  autoCalculateFlags: { examYear: boolean; curriculum: boolean };
  isSaving: boolean;
};

export function useAutoCalculation({
  watch,
  setValue,
  schoolType,
  autoCalculateFlags,
  isSaving,
}: UseAutoCalculationProps) {
  const isSavingRef = useRef(false);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const grade = watch("grade");
  const birthDate = watch("birth_date");

  // 입시년도 자동 계산
  useEffect(() => {
    if (isSavingRef.current) return;
    if (!autoCalculateFlags.examYear || !grade) return;

    const calculatedYear = calculateExamYearValue(
      grade,
      schoolType || undefined
    );

    setValue("exam_year", calculatedYear.toString(), {
      shouldDirty: false,
    });
  }, [grade, schoolType, autoCalculateFlags.examYear, setValue]);

  // 개정교육과정 자동 계산
  useEffect(() => {
    if (isSavingRef.current) return;
    if (!autoCalculateFlags.curriculum || !grade) return;

    const calculated = calculateCurriculumRevisionValue(
      grade,
      birthDate || null,
      schoolType || undefined
    );

    setValue("curriculum_revision", calculated, {
      shouldDirty: false,
    });
  }, [
    grade,
    birthDate,
    schoolType,
    autoCalculateFlags.curriculum,
    setValue,
  ]);
}
