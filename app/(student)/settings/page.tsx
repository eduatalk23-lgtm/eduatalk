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
  validatePhoneNumber,
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
import SchoolMultiSelect from "@/components/ui/SchoolMultiSelect";
import { SkeletonForm } from "@/components/ui/SkeletonForm";
import { SectionCard } from "@/components/ui/SectionCard";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import { getSchoolById } from "@/app/(student)/actions/schoolActions";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const { showSuccess, showError } = useToast();

  // 학교 타입 상태 (school_id로부터 조회)
  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | undefined
  >(undefined);

  // 폼 상태
  const [formData, setFormData] = useState<StudentFormData>({
    name: "",
    school_id: "",
    grade: "",
    birth_date: "",
    gender: "",
    phone: "",
    mother_phone: "",
    father_phone: "",
    exam_year: "",
    curriculum_revision: "",
    desired_university_ids: [],
    desired_career_field: "",
  });

  // 자동 계산 플래그
  const [autoCalculateExamYear, setAutoCalculateExamYear] = useState(true);
  const [autoCalculateCurriculum, setAutoCalculateCurriculum] = useState(true);

  // 저장 후 자동 계산 방지 플래그
  const isSavingRef = useRef(false);

  // 초기 폼 데이터 참조 (변경사항 추적용)
  const initialFormDataRef = useRef<StudentFormData | null>(null);

  // 초기 설정 모드 감지 (학생 정보가 없을 때)
  const isInitialSetup = useMemo(() => {
    return student === null;
  }, [student]);

  // Student 데이터를 FormData로 변환하는 헬퍼 함수
  const transformStudentToFormData = useCallback(
    async (studentData: Student & { desired_career_field?: string }): Promise<StudentFormData> => {
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
      const gradeNumber = parseGradeNumber(studentData.grade || "");

      return {
        name: displayName,
        school_id: studentData.school_id || "",
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
        desired_university_ids: studentData.desired_university_ids || [],
        desired_career_field: toFormDataValue(studentData.desired_career_field, isCareerField),
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

  // 학년 표시 형식 메모이제이션
  const gradeDisplay = useMemo(
    () => formatGradeDisplay(formData.grade, schoolType),
    [formData.grade, schoolType]
  );

  // school_id로부터 학교 타입 조회
  useEffect(() => {
    async function fetchSchoolType() {
      if (!formData.school_id) {
        setSchoolType(undefined);
        return;
      }

      try {
        const school = await getSchoolById(formData.school_id);
        if (school && (school.type === "중학교" || school.type === "고등학교")) {
          setSchoolType(school.type);
        } else {
          setSchoolType(undefined);
        }
      } catch (error) {
        console.error("학교 타입 조회 실패:", error);
        setSchoolType(undefined);
      }
    }

    fetchSchoolType();
  }, [formData.school_id]);

  useEffect(() => {
    async function loadStudent() {
      try {
        const supabase = (await import("@/lib/supabase/client")).supabase;
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const studentData = await getCurrentStudent();
        
        // 학생 정보가 없어도 마이페이지를 표시 (빈 폼으로 시작)
        if (studentData) {
          setStudent(studentData);
        } else {
          // 학생 정보가 없으면 빈 상태로 시작
          setStudent(null);
        }

        // Student 데이터를 FormData로 변환
        if (studentData) {
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
        } else {
          // 학생 정보가 없으면 빈 폼으로 시작
          // 이름은 user_metadata의 display_name을 기본값으로 사용
          const displayName = (user.user_metadata?.display_name as string | undefined) || "";
          const initialFormData: StudentFormData = {
            ...formData,
            name: displayName,
          };
          setFormData(initialFormData);
          initialFormDataRef.current = initialFormData;
        }
      } catch (err) {
        console.error("학생 정보 로드 실패:", err);
        showError("학생 정보를 불러오는데 실패했습니다.");
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

  // 연락처 필드 변경 핸들러 (자동 포맷팅 및 실시간 검증)
  const handlePhoneChange = useCallback(
    (field: "phone" | "mother_phone" | "father_phone") =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData((prev) => ({ ...prev, [field]: formatted }));
        
        // 실시간 검증 (입력 중일 때는 에러 표시하지 않음)
        if (formatted) {
          const validation = validatePhoneNumber(formatted);
          if (!validation.valid) {
            // 입력 중이 아닐 때만 에러 표시 (11자리 이상이거나 010으로 시작하지 않을 때)
            const digits = formatted.replace(/\D/g, "");
            if (digits.length >= 10 || !digits.startsWith("010")) {
              setErrors((prev) => ({ ...prev, [field]: validation.error }));
            } else {
              // 입력 중이면 에러 제거
              setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
              });
            }
          } else {
            // 유효하면 에러 제거
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field];
              return newErrors;
            });
          }
        } else {
          // 빈 값이면 에러 제거
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      },
    []
  );

  // 학교 선택 핸들러 (ID 저장)
  const handleSchoolSelect = useCallback(
    (school: { id: string; type: string }) => {
      // 학교 ID 저장
      setFormData((prev) => ({ ...prev, school_id: school.id }));
      
      // 학교 타입 설정 (useEffect에서 자동으로 조회되지만 즉시 반영)
      if (school.type === "중학교" || school.type === "고등학교") {
        setSchoolType(school.type);
      } else {
        setSchoolType(undefined);
      }
      
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



  const handleSave = useCallback(async () => {

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
      isSavingRef.current = true; // 저장 시작

      try {
        const formDataObj = new FormData();
        formDataObj.append("name", formData.name);
        formDataObj.append("school_id", formData.school_id);
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
        // desired_university_ids 배열을 FormData에 추가
        formData.desired_university_ids.forEach((id) => {
          formDataObj.append("desired_university_ids", id);
        });
        if (formData.desired_career_field) {
          formDataObj.append("desired_career_field", formData.desired_career_field);
        }

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

          // 학교 타입은 schoolTypeFilter에서 관리되므로 별도 감지 불필요
          // 필요시 school_id로 학교 정보 조회하여 타입 확인 가능

          // 저장 후 자동 계산 로직이 실행되지 않도록 충분한 시간 동안 플래그 유지
          // formData 업데이트가 완료된 후 플래그 해제
          setTimeout(() => {
            isSavingRef.current = false;
          }, 300);

          // 초기 설정 모드에서 저장 성공 시 대시보드로 리다이렉트
          if (isInitialSetup) {
            router.push("/dashboard");
            return;
          }

          // 성공 메시지 표시
          showSuccess("저장되었습니다.");
        } else {
          showError(result.error || "저장에 실패했습니다.");
          isSavingRef.current = false;
        }
      } catch (err: any) {
        showError(err.message || "저장 중 오류가 발생했습니다.");
        isSavingRef.current = false;
      } finally {
        setSaving(false);
      }
    },
    [formData, autoCalculateExamYear, autoCalculateCurriculum, schoolType, isInitialSetup, router, showSuccess, showError]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await handleSave();
    },
    [handleSave]
  );

  // 단계별 진행 상태 계산 (Hooks 규칙 준수를 위해 early return 전에 호출)
  const setupProgress = useMemo(() => {
    if (!isInitialSetup) return null;
    
    const steps = [
      { key: "basic", label: "기본 정보", completed: !!(formData.name && formData.grade && formData.birth_date) },
      { key: "exam", label: "시험 정보", completed: !!(formData.exam_year && formData.curriculum_revision) },
      { key: "career", label: "진로 정보", completed: !!(formData.desired_university_ids.length > 0 || formData.desired_career_field) },
    ];
    
    const completedCount = steps.filter(s => s.completed).length;
    const currentStep = steps.findIndex(s => !s.completed);
    
    return {
      steps,
      completedCount,
      totalSteps: steps.length,
      currentStep: currentStep === -1 ? steps.length : currentStep + 1,
    };
  }, [isInitialSetup, formData]);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <SkeletonForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col gap-6">
          <h1 className="text-h1">프로필</h1>

          {/* 초기 설정 모드: 환영 메시지 및 단계별 가이드 */}
          {isInitialSetup && setupProgress && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h2 className="text-h2 text-indigo-900">
                    환영합니다! 🎉
                  </h2>
                  <p className="text-sm text-indigo-700">
                    먼저 기본 정보를 입력해주세요. 단계별로 진행하시면 더 쉽게 설정하실 수 있습니다.
                  </p>
                </div>
              
              {/* 진행 단계 표시 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-indigo-900">
                    진행 단계: {setupProgress.currentStep}/{setupProgress.totalSteps}
                  </span>
                  <span className="text-indigo-600">
                    {setupProgress.completedCount}/{setupProgress.totalSteps} 완료
                  </span>
                </div>
                
                {/* 단계별 진행 바 */}
                <div className="w-full bg-indigo-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(setupProgress.completedCount / setupProgress.totalSteps) * 100}%` }}
                  />
                </div>
                
                {/* 단계별 체크리스트 */}
                <div className="flex flex-col gap-2">
                  {setupProgress.steps.map((step, index) => (
                    <div key={step.key} className="flex items-center gap-2 text-sm">
                      {step.completed ? (
                        <svg
                          className="h-5 w-5 text-green-600"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-indigo-300 flex items-center justify-center">
                          <span className="text-xs text-indigo-600 font-medium">
                            {index + 1}
                          </span>
                        </div>
                      )}
                      <span className={step.completed ? "text-green-700 line-through" : "text-indigo-700"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 기본 정보 섹션 */}
          <SectionCard
            title="기본 정보"
            description="학생의 기본 정보를 입력하세요"
          >
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
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
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
                <label className="text-sm font-medium text-gray-700">
                  학교
                </label>
                <SchoolSelect
                  value={formData.school_id}
                  onChange={() => {
                    // SchoolSelect는 학교명을 반환하지만, onSchoolSelect에서 ID를 저장
                    // 여기서는 빈 값으로 처리 (실제 ID는 onSchoolSelect에서 저장됨)
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
                    if (errors.grade) {
                      setErrors((prev) => ({ ...prev, grade: undefined }));
                    }
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
                    if (errors.birth_date) {
                      setErrors((prev) => ({ ...prev, birth_date: undefined }));
                    }
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
          </SectionCard>

          {/* 연락처 정보 섹션 */}
          <SectionCard
            title="연락처 정보"
            description="비상 연락을 위한 연락처 정보입니다"
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                본인 연락처
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
                className={cn(
                  "rounded-lg border px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2",
                  errors.phone
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-200"
                )}
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="010-1234-5678"
              />
            </div>
          </SectionCard>

          {/* 입시 정보 섹션 */}
          <SectionCard
            title="입시 정보"
            description="입시 정보는 학습 계획 수립에 활용됩니다"
          >
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
          </SectionCard>

          {/* 진로 정보 섹션 */}
          <SectionCard
            title="진로 정보"
            description="진로 정보는 맞춤형 학습 추천에 활용됩니다"
          >
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
                    setFormData((prev) => ({
                      ...prev,
                      desired_university_ids: ids,
                    }));
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
          </SectionCard>

          {/* 저장 버튼 */}
          <StickySaveButton
            hasChanges={hasChanges || isInitialSetup}
            isSaving={saving}
            onSubmit={handleSave}
            onCancel={async () => {
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

                  // Student 데이터를 FormData로 변환하여 초기값으로 리셋
                  const resetFormData = await transformStudentToFormData(
                    studentData
                  );
                  setFormData(resetFormData);
                  initialFormDataRef.current = resetFormData;
                }
              } catch (err) {
                console.error("데이터 다시 로드 실패:", err);
                showError("데이터를 다시 불러오는데 실패했습니다.");
              } finally {
                setLoading(false);
              }
            }}
            submitLabel={isInitialSetup ? "시작하기" : "저장하기"}
            disabled={!hasChanges && !isInitialSetup}
          />
          </form>
        </div>
      </div>
    </div>
  );
}
