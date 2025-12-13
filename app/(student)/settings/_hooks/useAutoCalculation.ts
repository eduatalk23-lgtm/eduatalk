/**
 * 자동 계산 훅
 */

import { useEffect, useRef } from "react";
import type { StudentFormData } from "../types";
import {
  calculateExamYearValue,
  calculateCurriculumRevisionValue,
} from "../_utils/autoCalculation";

type UseAutoCalculationProps = {
  formData: StudentFormData;
  schoolType: "중학교" | "고등학교" | undefined;
  autoCalculateFlags: { examYear: boolean; curriculum: boolean };
  initialFormData: StudentFormData | null;
  updateFormData: (updates: Partial<StudentFormData>) => void;
  setInitialFormData: (data: StudentFormData | null) => void;
  isSaving: boolean;
};

export function useAutoCalculation({
  formData,
  schoolType,
  autoCalculateFlags,
  initialFormData,
  updateFormData,
  setInitialFormData,
  isSaving,
}: UseAutoCalculationProps) {
  const isSavingRef = useRef(false);

  // isSaving 변경 시 ref 업데이트
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  // 입시년도 자동 계산
  useEffect(() => {
    if (isSavingRef.current) return; // 저장 중에는 자동 계산하지 않음

    if (
      autoCalculateFlags.examYear &&
      formData.grade &&
      initialFormData
    ) {
      const calculatedYear = calculateExamYearValue(
        formData.grade,
        schoolType || undefined
      );

      // 현재 값과 계산된 값이 같으면 업데이트하지 않음
      if (formData.exam_year === calculatedYear.toString()) {
        // 초기값과도 동일한지 확인하고, 다르면 초기값만 업데이트
        if (
          initialFormData &&
          initialFormData.exam_year !== calculatedYear.toString()
        ) {
          setInitialFormData({
            ...initialFormData,
            exam_year: calculatedYear.toString(),
          });
        }
        return;
      }

      updateFormData({
        exam_year: calculatedYear.toString(),
      });

      // 자동 계산된 값도 초기값으로 업데이트 (변경사항으로 간주하지 않음)
      if (initialFormData) {
        setInitialFormData({
          ...initialFormData,
          exam_year: calculatedYear.toString(),
        });
      }
    }
  }, [
    formData.grade,
    schoolType,
    autoCalculateFlags.examYear,
    initialFormData,
    updateFormData,
    setInitialFormData,
  ]);

  // 개정교육과정 자동 계산
  useEffect(() => {
    if (isSavingRef.current) return; // 저장 중에는 자동 계산하지 않음

    if (
      autoCalculateFlags.curriculum &&
      formData.grade &&
      initialFormData
    ) {
      const calculated = calculateCurriculumRevisionValue(
        formData.grade,
        formData.birth_date || null,
        schoolType || undefined
      );

      // 현재 값과 계산된 값이 같으면 업데이트하지 않음
      if (formData.curriculum_revision === calculated) {
        // 초기값과도 동일한지 확인하고, 다르면 초기값 업데이트
        if (
          initialFormData &&
          initialFormData.curriculum_revision !== calculated
        ) {
          setInitialFormData({
            ...initialFormData,
            curriculum_revision: calculated,
          });
        }
        return;
      }

      updateFormData({
        curriculum_revision: calculated,
      });

      // 자동 계산된 값도 초기값으로 업데이트 (변경사항으로 간주하지 않음)
      if (initialFormData) {
        setInitialFormData({
          ...initialFormData,
          curriculum_revision: calculated,
        });
      }
    }
  }, [
    formData.grade,
    formData.birth_date,
    schoolType,
    autoCalculateFlags.curriculum,
    initialFormData,
    updateFormData,
    setInitialFormData,
  ]);
}

