"use client";

import { memo, useMemo, useCallback } from "react";
import { useSettings } from "../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";
import { cn } from "@/lib/cn";
import { formatGradeDisplay } from "@/lib/utils/studentFormUtils";
import {
  getFormLabelClasses,
  getFormInputClasses,
  getFormErrorClasses,
  textPrimaryVar,
} from "@/lib/utils/darkMode";

function BasicInfoSection() {
  const {
    formData,
    errors,
    isInitialSetup,
    schoolType,
    updateFormData,
    setErrors,
    setSchoolType,
  } = useSettings();

  const handleFieldChange = useCallback(
    (field: keyof typeof formData) => (value: string) => {
      updateFormData({ [field]: value });
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [updateFormData, errors, setErrors]
  );

  // SchoolSelect의 onChange 핸들러 - ID 또는 이름을 받아서 school_id 업데이트
  const handleSchoolChange = useCallback(
    (value: string) => {
      // SchoolSelect는 school.id 또는 school.name을 전달
      // ID 형식인지 확인 (SCHOOL_123 또는 UNIV_456)
      const isUnifiedId = /^(SCHOOL_|UNIV_)\d+$/.test(value);
      const schoolId = isUnifiedId ? value : "";
      
      updateFormData({ school_id: schoolId });
      
      // 에러가 있으면 제거
      if (errors.school_id) {
        setErrors((prev) => ({ ...prev, school_id: undefined }));
      }
    },
    [updateFormData, errors, setErrors]
  );

  // SchoolSelect의 onSchoolSelect 핸들러 - 학교 선택 시 추가 처리
  const handleSchoolSelect = useCallback(
    async (school: { id: string; name: string; type?: "중학교" | "고등학교" | "대학교" | null }) => {
      // school_id 업데이트 (이미 handleSchoolChange에서 처리되지만, 확실히 하기 위해)
      updateFormData({ school_id: school.id || "" });
      
      // 학교 타입 조회 및 설정
      if (school.type === "중학교" || school.type === "고등학교") {
        setSchoolType(school.type);
      } else {
        setSchoolType(undefined);
      }
    },
    [updateFormData, setSchoolType]
  );

  const gradeDisplay = useMemo(
    () => formatGradeDisplay(formData.grade, schoolType),
    [formData.grade, schoolType]
  );

  return (
    <SectionCard
      title="기본 정보"
      description="학생의 기본 정보를 입력하세요"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={cn(getFormLabelClasses(), "flex items-center gap-2")}>
            이름 <span className="text-red-500 dark:text-red-400">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                필수
              </span>
            )}
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              handleFieldChange("name")(e.target.value);
            }}
            className={getFormInputClasses(
              !!errors.name,
              isInitialSetup && !formData.name,
              false
            )}
            required
            placeholder="이름을 입력하세요"
          />
          {errors.name && (
            <p className={getFormErrorClasses()}>{errors.name}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={getFormLabelClasses()}>학교</label>
          <SchoolSelect
            value={formData.school_id}
            onChange={handleSchoolChange}
            onSchoolSelect={handleSchoolSelect}
            placeholder="학교를 검색하세요"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn(getFormLabelClasses(), "flex items-center gap-2")}>
            학년 <span className="text-red-500 dark:text-red-400">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                필수
              </span>
            )}
          </label>
          <select
            value={formData.grade}
            onChange={(e) => {
              handleFieldChange("grade")(e.target.value);
            }}
            className={getFormInputClasses(
              !!errors.grade,
              isInitialSetup && !formData.grade,
              false
            )}
            required
          >
            <option value="">학년 선택</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          {errors.grade && (
            <p className={getFormErrorClasses()}>{errors.grade}</p>
          )}
          {gradeDisplay && (
            <p className="text-xs text-gray-500 dark:text-gray-400">표시: {gradeDisplay}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn(getFormLabelClasses(), "flex items-center gap-2")}>
            생년월일 <span className="text-red-500 dark:text-red-400">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                필수
              </span>
            )}
          </label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={(e) => {
              handleFieldChange("birth_date")(e.target.value);
            }}
            className={getFormInputClasses(
              !!errors.birth_date,
              isInitialSetup && !formData.birth_date,
              false
            )}
            required
          />
          {errors.birth_date && (
            <p className={getFormErrorClasses()}>{errors.birth_date}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={getFormLabelClasses()}>성별</label>
          <select
            value={formData.gender}
            onChange={(e) => handleFieldChange("gender")(e.target.value)}
            className={getFormInputClasses(false, false, false)}
          >
            <option value="">선택하세요</option>
            {GENDER_OPTIONS.map((option) => (
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

export default memo(BasicInfoSection);

