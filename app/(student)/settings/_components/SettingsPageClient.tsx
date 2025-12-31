"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SettingsContext } from "./SettingsContext";
import type { SettingsContextType } from "./SettingsContext";
import type { StudentData } from "../types";
import { updateStudentProfile } from "@/lib/domains/student";
import { transformStudentToFormData } from "../_utils/dataTransform";
import { useSettingsForm } from "../_hooks/useSettingsForm";
import { useAutoCalculation } from "../_hooks/useAutoCalculation";
import { validateFormField, type ValidationErrors } from "@/lib/utils/studentFormUtils";
import { calculateExamYear, calculateCurriculumRevision } from "@/lib/utils/studentProfile";
import { SkeletonForm } from "@/components/ui/SkeletonForm";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { useToast } from "@/components/ui/ToastProvider";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { InitialSetupBanner } from "./InitialSetupBanner";
import BasicInfoSection from "./sections/BasicInfoSection";
import ContactInfoSection from "./sections/ContactInfoSection";
import ExamInfoSection from "./sections/ExamInfoSection";
import CareerInfoSection from "./sections/CareerInfoSection";
import type { StudentFormData } from "../types";
import { getSchoolById } from "@/lib/domains/school";
import { useAuth } from "@/lib/contexts/AuthContext";

type SettingsPageClientProps = {
  initialData: StudentData | null;
  initialSchoolType?: "중학교" | "고등학교" | undefined;
};

export default function SettingsPageClient({
  initialData,
  initialSchoolType,
}: SettingsPageClientProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | undefined
  >(initialSchoolType);
  const [autoCalculateFlags, setAutoCalculateFlags] = useState({
    examYear: !initialData?.exam_year,
    curriculum: !initialData?.curriculum_revision,
  });
  const [modalStates, setModalStates] = useState({
    examYear: false,
    curriculum: false,
  });
  const isSavingRef = useRef(false);
  const previousSchoolIdRef = useRef<string | undefined>(undefined);

  // 초기 폼 데이터 변환
  const [resolvedInitialFormData, setResolvedInitialFormData] = useState<StudentFormData | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  useEffect(() => {
    async function loadInitialFormData() {
      // 사용자 정보가 로딩 중이면 대기
      if (isAuthLoading) {
        return;
      }

      try {
        // useAuth에서 가져온 사용자 정보 사용
        // user?.email은 CurrentUser 타입에 포함되어 있지만, display_name은 user_metadata에 있음
        // display_name은 서버에서 가져온 initialData나 별도로 조회해야 할 수 있음
        // 일단 email을 사용하거나, initialData가 있으면 그대로 사용
        const userDisplayName = user?.email || undefined;
        
        if (initialData) {
          const formData = await transformStudentToFormData(initialData, userDisplayName);
          setResolvedInitialFormData(formData);
        } else {
          const formData = await transformStudentToFormData(null, userDisplayName);
          setResolvedInitialFormData(formData);
        }
      } catch (error) {
        console.error("초기 폼 데이터 로드 실패:", error);
        // 기본값으로 설정
        setResolvedInitialFormData({
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
      } finally {
        setIsLoadingInitialData(false);
      }
    }

    loadInitialFormData();
  }, [initialData, user, isAuthLoading]);

  const isInitialSetup = !initialData;

  // 기본 폼 데이터를 useMemo로 안정화하여 매번 새로운 객체 생성 방지
  const defaultFormData = useMemo<StudentFormData>(() => ({
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
  }), []);

  const {
    formData,
    errors,
    setFormData,
    updateFormData,
    setErrors,
    hasChanges,
    initialFormData: contextInitialFormData,
    setInitialFormData,
    resetForm,
  } = useSettingsForm({
    initialFormData: resolvedInitialFormData ?? defaultFormData,
    isInitialSetup,
  });

  // school_id로부터 학교 타입 조회
  useEffect(() => {
    if (formData.school_id === previousSchoolIdRef.current) {
      return;
    }

    previousSchoolIdRef.current = formData.school_id;

    if (!formData.school_id) {
      setSchoolType(undefined);
      return;
    }

    const timeoutId = setTimeout(async () => {
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
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.school_id]);

  // 자동 계산 훅
  useAutoCalculation({
    formData,
    schoolType,
    autoCalculateFlags,
    initialFormData: contextInitialFormData,
    updateFormData,
    setInitialFormData,
    isSaving: saving,
  });

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    // 유효성 검증
    const newErrors: ValidationErrors = {};
    const requiredFields: (keyof StudentFormData)[] = [
      "name",
      "birth_date",
      "grade",
    ];

    for (const field of requiredFields) {
      const error = validateFormField(field, formData[field] as string);
      if (error) {
        newErrors[field] = error;
      }
    }

    // 선택 필드 검증
    (["phone", "mother_phone", "father_phone"] as const).forEach((field) => {
      const error = validateFormField(
        field,
        formData[field] as string
      );
      if (error) {
        newErrors[field] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    isSavingRef.current = true;

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
      formData.desired_university_ids.forEach((id) => {
        formDataObj.append("desired_university_ids", id);
      });
      if (formData.desired_career_field) {
        formDataObj.append("desired_career_field", formData.desired_career_field);
      }

      const result = await updateStudentProfile(formDataObj);

      if (result.success) {
        const savedFormData = JSON.parse(JSON.stringify(formData));

        // 자동 계산된 값이 있다면 포함
        if (autoCalculateFlags.examYear && formData.grade) {
          const calculatedYear = calculateExamYear(
            formData.grade,
            schoolType || undefined
          );
          savedFormData.exam_year = calculatedYear.toString();
        }

        if (autoCalculateFlags.curriculum && formData.grade) {
          const calculated = calculateCurriculumRevision(
            formData.grade,
            formData.birth_date || null,
            schoolType || undefined
          );
          savedFormData.curriculum_revision = calculated;
        }

        setInitialFormData(savedFormData);
        setFormData(savedFormData);

        setTimeout(() => {
          isSavingRef.current = false;
        }, 300);

        if (isInitialSetup) {
          showSuccess("프로필이 저장되었습니다. 대시보드로 이동합니다.");
          setTimeout(() => {
            router.push("/dashboard");
          }, 1000);
          return;
        }

        showSuccess("저장되었습니다.");
      } else {
        showError(result.error || "저장에 실패했습니다.");
        isSavingRef.current = false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      showError(errorMessage);
      isSavingRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [
    formData,
    autoCalculateFlags,
    schoolType,
    isInitialSetup,
    router,
    showSuccess,
    showError,
    setErrors,
    setFormData,
    setInitialFormData,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await handleSave();
    },
    [handleSave]
  );

  const contextValue: SettingsContextType = {
    formData,
    errors,
    loading,
    saving,
    schoolType,
    autoCalculateFlags,
    isInitialSetup,
    modalStates,
    initialFormData: contextInitialFormData,
    updateFormData,
    setFormData,
    setErrors,
    setLoading,
    setSaving,
    setSchoolType,
    setAutoCalculateFlags: (flags) => {
      setAutoCalculateFlags((prev) => ({ ...prev, ...flags }));
    },
    setModalState: (modal, open) => {
      setModalStates((prev) => ({ ...prev, [modal]: open }));
    },
    setInitialFormData,
    hasChanges,
    resetForm,
  };

  if (isAuthLoading || isLoadingInitialData || !resolvedInitialFormData) {
    return (
      <PageContainer widthType="FORM">
        <div className="flex flex-col gap-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <SkeletonForm />
        </div>
      </PageContainer>
    );
  }

  return (
    <SettingsContext.Provider value={contextValue}>
      <PageContainer widthType="FORM">
        <div className="flex flex-col gap-6 pb-24">
          <PageHeader title="프로필" />

          {isInitialSetup && (
            <InitialSetupBanner formData={formData} />
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <BasicInfoSection />
            <ContactInfoSection />
            <ExamInfoSection />
            <CareerInfoSection />
          </form>
        </div>
      </PageContainer>

      <StickySaveButton
        hasChanges={hasChanges}
        isSaving={saving}
        onSubmit={handleSave}
      />
    </SettingsContext.Provider>
  );
}

