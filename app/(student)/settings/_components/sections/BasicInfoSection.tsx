"use client";

import { memo, useMemo, useCallback } from "react";
import { useSettings } from "../../SettingsContext";
import { SectionCard } from "@/components/ui/SectionCard";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";
import { cn } from "@/lib/cn";
import { formatGradeDisplay } from "@/lib/utils/studentFormUtils";

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

  const handleSchoolSelect = useCallback(
    async (schoolId: string, schoolName: string) => {
      updateFormData({ school_id: schoolId });
      
      // 학교 타입 조회
      try {
        const { getSchoolById } = await import("@/app/(student)/actions/schoolActions");
        const school = await getSchoolById(schoolId);
        if (school && (school.type === "중학교" || school.type === "고등학교")) {
          setSchoolType(school.type);
        } else {
          setSchoolType(undefined);
        }
      } catch (error) {
        console.error("학교 타입 조회 실패:", error);
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
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            이름 <span className="text-red-500">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
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
            className={cn(
              "rounded-lg border px-3 py-2 focus:outline-none focus:ring-2",
              errors.name
                ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                : isInitialSetup && !formData.name
                ? "border-indigo-400 focus:border-indigo-500 focus:ring-indigo-200 bg-indigo-50"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
            )}
            required
            placeholder="이름을 입력하세요"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">학교</label>
          <SchoolSelect
            value={formData.school_id}
            onChange={() => {
              // SchoolSelect는 학교명을 반환하지만, onSchoolSelect에서 ID를 저장
            }}
            onSchoolSelect={handleSchoolSelect}
            placeholder="학교를 검색하세요"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            학년 <span className="text-red-500">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                필수
              </span>
            )}
          </label>
          <select
            value={formData.grade}
            onChange={(e) => {
              handleFieldChange("grade")(e.target.value);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 focus:outline-none focus:ring-2",
              errors.grade
                ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                : isInitialSetup && !formData.grade
                ? "border-indigo-400 focus:border-indigo-500 focus:ring-indigo-200 bg-indigo-50"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
            )}
            required
          >
            <option value="">학년 선택</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          {errors.grade && (
            <p className="text-sm text-red-500">{errors.grade}</p>
          )}
          {gradeDisplay && (
            <p className="text-xs text-gray-500">표시: {gradeDisplay}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            생년월일 <span className="text-red-500">*</span>
            {isInitialSetup && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
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
            className={cn(
              "rounded-lg border px-3 py-2 focus:outline-none focus:ring-2",
              errors.birth_date
                ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                : isInitialSetup && !formData.birth_date
                ? "border-indigo-400 focus:border-indigo-500 focus:ring-indigo-200 bg-indigo-50"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
            )}
            required
          />
          {errors.birth_date && (
            <p className="text-sm text-red-500">{errors.birth_date}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">성별</label>
          <select
            value={formData.gender}
            onChange={(e) => handleFieldChange("gender")(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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

