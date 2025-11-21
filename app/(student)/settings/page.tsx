"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateStudentProfile,
  getCurrentStudent,
} from "@/app/(student)/actions/studentActions";
import {
  calculateExamYear,
  calculateCurriculumRevision,
  GRADE_OPTIONS,
  GENDER_OPTIONS,
  CURRICULUM_REVISION_OPTIONS,
  CAREER_FIELD_OPTIONS,
} from "@/lib/utils/studentProfile";
import {
  detectSchoolType,
  parseGradeNumber,
  formatGradeDisplay,
  formatPhoneNumber,
  validateFormField,
  type ValidationErrors,
} from "@/lib/utils/studentFormUtils";
import type { Student } from "@/lib/data/students";
import {
  type StudentFormData,
  isGender,
  isCurriculumRevision,
  isCareerField,
  toFormDataValue,
} from "./types";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { SettingsTabs } from "./_components/SettingsTabs";
import { SkeletonForm } from "@/components/ui/SkeletonForm";
import { cn } from "@/lib/cn";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"basic" | "exam" | "career">(
    "basic"
  );

  // 학교 구분 상태 (기본 정보 탭용)
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<
    "중학교" | "고등학교" | ""
  >("");

  // 폼 상태
  const [formData, setFormData] = useState<StudentFormData>({
    name: "",
    school: "",
    grade: "",
    birth_date: "",
    gender: "",
    phone: "",
    mother_phone: "",
    father_phone: "",
    exam_year: "",
    curriculum_revision: "",
    desired_university_1: "",
    desired_university_2: "",
    desired_university_3: "",
    desired_career_field: "",
  });

  // 자동 계산 플래그
  const [autoCalculateExamYear, setAutoCalculateExamYear] = useState(true);
  const [autoCalculateCurriculum, setAutoCalculateCurriculum] = useState(true);

  // 저장 후 자동 계산 방지 플래그
  const isSavingRef = useRef(false);

  // 초기 폼 데이터 참조 (변경사항 추적용)
  const initialFormDataRef = useRef<StudentFormData | null>(null);

  // Student 데이터를 FormData로 변환하는 헬퍼 함수
  const transformStudentToFormData = useCallback(
    async (studentData: Student): Promise<StudentFormData> => {
      const supabase = (await import("@/lib/supabase/client")).supabase;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 이름은 students 테이블에서 가져오고, 없으면 user_metadata에서 가져오기
      const displayName =
        studentData.name ||
        (user?.user_metadata?.display_name as string | undefined) ||
        "";

      // 학년을 숫자 형식으로 변환 (중3/고1 -> 3/1)
      const gradeNumber = parseGradeNumber(studentData.grade);

      return {
        name: displayName,
        school: studentData.school || "",
        grade: gradeNumber,
        birth_date: studentData.birth_date || "",
        gender: toFormDataValue(studentData.gender, isGender),
        phone: studentData.phone || "",
        mother_phone: studentData.mother_phone || "",
        father_phone: studentData.father_phone || "",
        exam_year: studentData.exam_year?.toString() || "",
        curriculum_revision: toFormDataValue(
          studentData.curriculum_revision,
          isCurriculumRevision
        ),
        desired_university_1: studentData.desired_university_1 || "",
        desired_university_2: studentData.desired_university_2 || "",
        desired_university_3: studentData.desired_university_3 || "",
        desired_career_field: toFormDataValue(
          studentData.desired_career_field,
          isCareerField
        ),
      };
    },
    []
  );

  // 변경사항 추적
  const hasChanges = useMemo(() => {
    if (!initialFormDataRef.current) return false;
    return (
      JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current)
    );
  }, [formData]);

  // 탭 변경 핸들러 (변경사항 확인)
  const handleTabChange = useCallback(
    (tab: "basic" | "exam" | "career") => {
      // 같은 탭을 클릭한 경우 아무것도 하지 않음
      if (activeTab === tab) {
        return;
      }

      // 변경사항이 있는 경우 확인 다이얼로그 표시
      if (hasChanges) {
        if (
          !confirm(
            "변경사항이 있습니다. 탭을 이동하면 저장하지 않은 변경사항이 사라집니다. 계속하시겠습니까?"
          )
        ) {
          return;
        }
      }

      // 탭 변경
      setActiveTab(tab);
    },
    [activeTab, hasChanges]
  );

  // 학교 타입 메모이제이션
  const schoolType = useMemo(
    () => detectSchoolType(formData.school),
    [formData.school]
  );

  // 학년 표시 형식 메모이제이션
  const gradeDisplay = useMemo(
    () => formatGradeDisplay(formData.grade, schoolType),
    [formData.grade, schoolType]
  );

  useEffect(() => {
    async function loadStudent() {
      try {
        const supabase = (await import("@/lib/supabase/client")).supabase;
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const studentData = await getCurrentStudent();
        if (!studentData) {
          router.push("/login");
          return;
        }

        setStudent(studentData);

        // 학교 타입 자동 감지
        const detectedSchoolType = detectSchoolType(studentData.school);
        setSchoolTypeFilter(detectedSchoolType);

        // Student 데이터를 FormData로 변환
        const initialFormData = await transformStudentToFormData(studentData);
        setFormData(initialFormData);
        initialFormDataRef.current = initialFormData;

        // 자동 계산 값이 없으면 자동 계산 활성화
        if (!studentData.exam_year) {
          setAutoCalculateExamYear(true);
        }
        if (!studentData.curriculum_revision) {
          setAutoCalculateCurriculum(true);
        }
      } catch (err) {
        console.error("학생 정보 로드 실패:", err);
        setError("학생 정보를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadStudent();
  }, [router]);

  // 학년이나 생년월일이 변경되면 자동 계산
  useEffect(() => {
    if (isSavingRef.current) return; // 저장 중에는 자동 계산하지 않음

    if (autoCalculateExamYear && formData.grade && initialFormDataRef.current) {
      const calculatedYear = calculateExamYear(
        formData.grade,
        schoolType || undefined
      );

      // 현재 값과 계산된 값이 같으면 업데이트하지 않음
      // 단, initialFormDataRef와도 동기화 확인
      if (formData.exam_year === calculatedYear.toString()) {
        // 초기값과도 동일한지 확인하고, 다르면 초기값만 업데이트
        if (
          initialFormDataRef.current &&
          initialFormDataRef.current.exam_year !== calculatedYear.toString()
        ) {
          initialFormDataRef.current = JSON.parse(
            JSON.stringify({
              ...initialFormDataRef.current,
              exam_year: calculatedYear.toString(),
            })
          );
        }
        return;
      }

      setFormData((prev) => {
        const updated = {
          ...prev,
          exam_year: calculatedYear.toString(),
        };
        // 자동 계산된 값도 초기값으로 업데이트 (변경사항으로 간주하지 않음)
        if (initialFormDataRef.current) {
          initialFormDataRef.current = JSON.parse(
            JSON.stringify({
              ...initialFormDataRef.current,
              exam_year: calculatedYear.toString(),
            })
          );
        }
        return updated;
      });
    }
  }, [formData.grade, formData.exam_year, schoolType, autoCalculateExamYear]);

  useEffect(() => {
    if (isSavingRef.current) return; // 저장 중에는 자동 계산하지 않음

    if (
      autoCalculateCurriculum &&
      formData.grade &&
      formData.birth_date &&
      initialFormDataRef.current
    ) {
      const calculated = calculateCurriculumRevision(
        formData.grade,
        formData.birth_date,
        schoolType || undefined
      );

      // 현재 값과 계산된 값이 같으면 업데이트하지 않음
      if (formData.curriculum_revision === calculated) {
        // 초기값과도 동일한지 확인하고, 다르면 초기값 업데이트
        if (
          initialFormDataRef.current &&
          initialFormDataRef.current.curriculum_revision !== calculated
        ) {
          initialFormDataRef.current = JSON.parse(
            JSON.stringify({
              ...initialFormDataRef.current,
              curriculum_revision: calculated,
            })
          );
        }
        return;
      }

      setFormData((prev) => {
        const updated = {
          ...prev,
          curriculum_revision: calculated,
        };
        // 자동 계산된 값도 초기값으로 업데이트 (변경사항으로 간주하지 않음)
        if (initialFormDataRef.current) {
          initialFormDataRef.current = JSON.parse(
            JSON.stringify({
              ...initialFormDataRef.current,
              curriculum_revision: calculated,
            })
          );
        }
        return updated;
      });
    }
  }, [
    formData.grade,
    formData.birth_date,
    formData.curriculum_revision,
    schoolType,
    autoCalculateCurriculum,
  ]);

  // 페이지 이탈 시 변경사항 확인
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // 필드 변경 핸들러 메모이제이션
  const handleFieldChange = useCallback(
    (field: keyof StudentFormData) => (value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // 연락처 필드 변경 핸들러 (자동 포맷팅)
  const handlePhoneChange = useCallback(
    (field: "phone" | "mother_phone" | "father_phone") =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData((prev) => ({ ...prev, [field]: formatted }));
      },
    []
  );

  // 학교 타입 변경 핸들러
  const handleSchoolTypeChange = useCallback(
    (schoolType: "중학교" | "고등학교" | "") => {
      setSchoolTypeFilter(schoolType);
      if (schoolType) {
        setFormData((prev) => ({ ...prev, school: "" }));
      }
    },
    []
  );

  // 학교 선택 핸들러
  const handleSchoolSelect = useCallback(
    (school: { type: string }) => {
      // 학교 선택 시 타입에 따라 학년 자동 설정 (숫자만)
      if (
        school.type === "중학교" &&
        (!formData.grade || formData.grade !== "3")
      ) {
        setFormData((prev) => ({ ...prev, grade: "3" }));
      } else if (
        school.type === "고등학교" &&
        (!formData.grade || formData.grade === "3")
      ) {
        setFormData((prev) => ({ ...prev, grade: "1" }));
      }
    },
    [formData.grade]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // 유효성 검증
      const newErrors: ValidationErrors = {};
      const requiredFields: (keyof StudentFormData)[] = [
        "name",
        "birth_date",
        "grade",
      ];

      for (const field of requiredFields) {
        const error = validateFormField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
        }
      }

      // 선택 필드 검증
      ["phone", "mother_phone", "father_phone"].forEach((field) => {
        const error = validateFormField(
          field,
          formData[field as keyof StudentFormData]
        );
        if (error) {
          newErrors[field as keyof StudentFormData] = error;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      setSaving(true);
      setError(null);
      setSuccess(false);
      isSavingRef.current = true; // 저장 시작

      try {
        const formDataObj = new FormData();
        formDataObj.append("name", formData.name);
        formDataObj.append("school", formData.school);
        formDataObj.append("grade", formData.grade);
        formDataObj.append("birth_date", formData.birth_date);
        if (formData.gender) formDataObj.append("gender", formData.gender);
        formDataObj.append("phone", formData.phone);
        formDataObj.append("mother_phone", formData.mother_phone);
        formDataObj.append("father_phone", formData.father_phone);
        if (formData.exam_year)
          formDataObj.append("exam_year", formData.exam_year);
        if (formData.curriculum_revision)
          formDataObj.append(
            "curriculum_revision",
            formData.curriculum_revision
          );
        formDataObj.append(
          "desired_university_1",
          formData.desired_university_1
        );
        formDataObj.append(
          "desired_university_2",
          formData.desired_university_2
        );
        formDataObj.append(
          "desired_university_3",
          formData.desired_university_3
        );
        if (formData.desired_career_field)
          formDataObj.append(
            "desired_career_field",
            formData.desired_career_field
          );

        const result = await updateStudentProfile(formDataObj);

        if (result.success) {
          // 저장 성공 시 자동 계산된 값도 포함하여 초기값 업데이트
          // 자동 계산 로직이 실행되기 전에 초기값을 설정해야 함
          const savedFormData = JSON.parse(JSON.stringify(formData));

          // 자동 계산된 값이 있다면 포함
          if (autoCalculateExamYear && formData.grade) {
            const calculatedYear = calculateExamYear(
              formData.grade,
              schoolType || undefined
            );
            savedFormData.exam_year = calculatedYear.toString();
          }

          if (
            autoCalculateCurriculum &&
            formData.grade &&
            formData.birth_date
          ) {
            const calculated = calculateCurriculumRevision(
              formData.grade,
              formData.birth_date,
              schoolType || undefined
            );
            savedFormData.curriculum_revision = calculated;
          }

          // 깊은 복사로 초기값 업데이트
          initialFormDataRef.current = savedFormData;

          // formData도 업데이트하여 hasChanges가 false가 되도록 함
          // 저장 후 자동 계산 로직이 실행되어 formData가 변경되는 것을 방지
          setFormData(savedFormData);

          // 학교 타입이 변경되었을 수 있으므로 다시 감지
          const detectedSchoolType = detectSchoolType(formData.school);
          setSchoolTypeFilter(detectedSchoolType);

          // 저장 후 자동 계산 로직이 실행되지 않도록 충분한 시간 동안 플래그 유지
          // formData 업데이트가 완료된 후 플래그 해제
          setTimeout(() => {
            isSavingRef.current = false;
          }, 300);
        } else {
          setError(result.error || "저장에 실패했습니다.");
          isSavingRef.current = false;
        }
      } catch (err: any) {
        setError(err.message || "저장 중 오류가 발생했습니다.");
        isSavingRef.current = false;
      } finally {
        setSaving(false);
      }
    },
    [formData]
  );

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <SkeletonForm />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-semibold">마이페이지</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 탭 네비게이션 */}
          <SettingsTabs activeTab={activeTab} onTabChange={handleTabChange} />

          {/* 기본 정보 탭 */}
          {activeTab === "basic" && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    handleFieldChange("name")(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.name
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
                  }`}
                  required
                  placeholder="이름을 입력하세요"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  학교
                </label>
                <div className="flex gap-2">
                  <select
                    value={schoolTypeFilter}
                    onChange={(e) =>
                      handleSchoolTypeChange(
                        e.target.value as "중학교" | "고등학교" | ""
                      )
                    }
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">학교 구분</option>
                    <option value="중학교">중학교</option>
                    <option value="고등학교">고등학교</option>
                  </select>
                  <div className="flex-1">
                    <SchoolSelect
                      value={formData.school}
                      onChange={handleFieldChange("school")}
                      onSchoolSelect={handleSchoolSelect}
                      // 학교 구분 선택에 따라 타입 제한
                      type={schoolTypeFilter || undefined}
                      placeholder={
                        schoolTypeFilter
                          ? `${schoolTypeFilter}를 검색하세요`
                          : "먼저 학교 구분을 선택하세요"
                      }
                      disabled={!schoolTypeFilter}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  먼저 학교 구분을 선택한 후 학교를 검색하세요.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  학년
                </label>
                <div className="flex gap-2">
                  <select
                    value={schoolType}
                    onChange={(e) => {
                      const newSchoolType = e.target.value as
                        | "중학교"
                        | "고등학교"
                        | "";
                      if (newSchoolType) {
                        // 학교 타입에 따라 기본 학년 설정
                        const defaultGrade =
                          newSchoolType === "중학교" ? "3" : "1";
                        setFormData((prev) => ({
                          ...prev,
                          grade: defaultGrade,
                        }));
                      }
                    }}
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">학교 구분</option>
                    <option value="중학교">중학교</option>
                    <option value="고등학교">고등학교</option>
                  </select>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() =>
                          handleFieldChange("grade")(grade.toString())
                        }
                        className={cn(
                          "flex-1 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
                          formData.grade === grade.toString()
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                        )}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
                {formData.grade && (
                  <p className="text-xs text-gray-500">{gradeDisplay}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  생년월일
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => {
                    handleFieldChange("birth_date")(e.target.value);
                    if (errors.birth_date) {
                      setErrors((prev) => ({ ...prev, birth_date: undefined }));
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.birth_date
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
                  }`}
                  required
                />
                {errors.birth_date && (
                  <p className="text-sm text-red-500">{errors.birth_date}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  성별
                </label>
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

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  연락처 (본인)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    handlePhoneChange("phone")(e);
                    if (errors.phone) {
                      setErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.phone
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
                  }`}
                  placeholder="010-1234-5678"
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  모 연락처
                </label>
                <input
                  type="tel"
                  value={formData.mother_phone}
                  onChange={handlePhoneChange("mother_phone")}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="010-1234-5678"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  부 연락처
                </label>
                <input
                  type="tel"
                  value={formData.father_phone}
                  onChange={handlePhoneChange("father_phone")}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="010-1234-5678"
                />
              </div>
            </section>
          )}

          {/* 입시 정보 탭 */}
          {activeTab === "exam" && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    입시년도
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={autoCalculateExamYear}
                      onChange={(e) =>
                        setAutoCalculateExamYear(e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    <span>자동 계산</span>
                  </label>
                </div>
                <input
                  type="number"
                  value={formData.exam_year}
                  onChange={(e) => {
                    setFormData({ ...formData, exam_year: e.target.value });
                    setAutoCalculateExamYear(false);
                  }}
                  disabled={autoCalculateExamYear}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="2025"
                  min="2020"
                  max="2030"
                />
                {autoCalculateExamYear && formData.grade && (
                  <p className="text-xs text-gray-500">
                    자동 계산:{" "}
                    {calculateExamYear(formData.grade, schoolType || undefined)}
                    년
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    개정교육과정
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={autoCalculateCurriculum}
                      onChange={(e) =>
                        setAutoCalculateCurriculum(e.target.checked)
                      }
                      className="rounded border-gray-300"
                    />
                    <span>자동 계산</span>
                  </label>
                </div>
                <select
                  value={formData.curriculum_revision}
                  onChange={(e) => {
                    handleFieldChange("curriculum_revision")(e.target.value);
                    setAutoCalculateCurriculum(false);
                  }}
                  disabled={autoCalculateCurriculum}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">선택하세요</option>
                  {CURRICULUM_REVISION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {autoCalculateCurriculum &&
                  formData.grade &&
                  formData.birth_date && (
                    <p className="text-xs text-gray-500">
                      자동 계산:{" "}
                      {calculateCurriculumRevision(
                        formData.grade,
                        formData.birth_date,
                        schoolType || undefined
                      )}
                    </p>
                  )}
              </div>
            </section>
          )}

          {/* 진로 정보 탭 */}
          {activeTab === "career" && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  진학 희망 대학교 1순위
                </label>
                <SchoolSelect
                  value={formData.desired_university_1}
                  onChange={handleFieldChange("desired_university_1")}
                  type="대학교"
                  placeholder="대학교를 검색하세요"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  진학 희망 대학교 2순위
                </label>
                <SchoolSelect
                  value={formData.desired_university_2}
                  onChange={handleFieldChange("desired_university_2")}
                  type="대학교"
                  placeholder="대학교를 검색하세요"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  진학 희망 대학교 3순위
                </label>
                <SchoolSelect
                  value={formData.desired_university_3}
                  onChange={handleFieldChange("desired_university_3")}
                  type="대학교"
                  placeholder="대학교를 검색하세요"
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
            </section>
          )}

          {/* 저장 버튼 */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            {hasChanges && (
              <p className="text-sm text-gray-500">
                변경사항이 있습니다. 저장하지 않으면 변경사항이 사라집니다.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (hasChanges) {
                    if (
                      !confirm("변경사항이 있습니다. 정말 취소하시겠습니까?")
                    ) {
                      return;
                    }
                  }

                  // 변경사항 취소: 초기 데이터 다시 로드
                  try {
                    setLoading(true);
                    const studentData = await getCurrentStudent();
                    if (studentData) {
                      const supabase = (await import("@/lib/supabase/client"))
                        .supabase;
                      const {
                        data: { user },
                      } = await supabase.auth.getUser();

                      setStudent(studentData);

                      // 학교 타입 자동 감지
                      const detectedSchoolType = detectSchoolType(
                        studentData.school
                      );
                      setSchoolTypeFilter(detectedSchoolType);

                      // Student 데이터를 FormData로 변환하여 초기값으로 리셋
                      const resetFormData = await transformStudentToFormData(
                        studentData
                      );
                      setFormData(resetFormData);
                      initialFormDataRef.current = resetFormData;
                    }
                  } catch (err) {
                    console.error("데이터 다시 로드 실패:", err);
                    setError("데이터를 다시 불러오는데 실패했습니다.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
