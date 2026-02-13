"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { StudentData, StudentFormData } from "../types";
import { updateStudentProfile } from "@/lib/domains/student";
import { transformStudentToFormData } from "../_utils/dataTransform";
import { useStudentSettingsForm } from "../_hooks/useStudentSettingsForm";
import { useAutoCalculation } from "../_hooks/useAutoCalculation";
import { SkeletonForm } from "@/components/ui/SkeletonForm";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { useToast } from "@/components/ui/ToastProvider";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { InitialSetupBanner } from "./InitialSetupBanner";
import BasicInfoSection from "./sections/BasicInfoSection";
import CareerInfoSection from "./sections/CareerInfoSection";
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
  const [saving, setSaving] = useState(false);
  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | undefined
  >(initialSchoolType);
  const [autoCalculateFlags, setAutoCalculateFlagsState] = useState({
    examYear: !initialData?.exam_year,
    curriculum: !initialData?.curriculum_revision,
  });
  const [modalStates, setModalStates] = useState({
    examYear: false,
    curriculum: false,
  });
  const previousSchoolIdRef = useRef<string | undefined>(undefined);

  const isInitialSetup = !initialData;

  // 초기 폼 데이터 변환
  const [resolvedInitialFormData, setResolvedInitialFormData] =
    useState<StudentFormData | null>(null);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  useEffect(() => {
    async function loadInitialFormData() {
      if (isAuthLoading) return;

      try {
        const userDisplayName = user?.email || undefined;
        const formData = await transformStudentToFormData(
          initialData,
          userDisplayName
        );
        setResolvedInitialFormData(formData);
      } catch (error) {
        console.error("초기 폼 데이터 로드 실패:", error);
        setResolvedInitialFormData({
          name: "",
          school_id: "",
          grade: "",
          class: "",
          birth_date: "",
          gender: "",
          phone: "",
          mother_phone: "",
          father_phone: "",
          address: "",
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

  // react-hook-form 기반 폼 훅
  const {
    control,
    watch,
    setValue,
    isDirty,
    handleSubmit,
    reset,
  } = useStudentSettingsForm({
    initialData: resolvedInitialFormData,
  });

  // school_id 변경 시 학교 타입 조회
  const schoolId = watch("school_id");
  useEffect(() => {
    if (schoolId === previousSchoolIdRef.current) return;
    previousSchoolIdRef.current = schoolId;

    if (!schoolId) {
      setSchoolType(undefined);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const school = await getSchoolById(schoolId);
        if (
          school &&
          (school.type === "중학교" || school.type === "고등학교")
        ) {
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
  }, [schoolId]);

  // 자동 계산 훅
  useAutoCalculation({
    watch,
    setValue,
    schoolType,
    autoCalculateFlags,
    isSaving: saving,
  });

  const setAutoCalculateFlags = useCallback(
    (flags: Partial<typeof autoCalculateFlags>) => {
      setAutoCalculateFlagsState((prev) => ({ ...prev, ...flags }));
    },
    []
  );

  const setModalState = useCallback(
    (modal: keyof typeof modalStates, open: boolean) => {
      setModalStates((prev) => ({ ...prev, [modal]: open }));
    },
    []
  );

  // 저장 핸들러
  const onSubmit = useCallback(
    async (formData: StudentFormData) => {
      setSaving(true);

      try {
        const formDataObj = new FormData();
        formDataObj.append("name", formData.name);
        formDataObj.append("school_id", formData.school_id);
        formDataObj.append("grade", formData.grade);
        formDataObj.append("class", formData.class);
        formDataObj.append("birth_date", formData.birth_date);
        if (formData.gender) formDataObj.append("gender", formData.gender);
        formDataObj.append("phone", formData.phone);
        formDataObj.append("mother_phone", formData.mother_phone);
        formDataObj.append("father_phone", formData.father_phone);
        if (formData.address)
          formDataObj.append("address", formData.address);
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
          formDataObj.append(
            "desired_career_field",
            formData.desired_career_field
          );
        }

        const result = await updateStudentProfile(formDataObj);

        if (result.success) {
          // 저장된 값으로 폼 리셋 (isDirty를 false로 만듦)
          reset(formData);

          if (isInitialSetup) {
            showSuccess(
              "프로필이 저장되었습니다. 대시보드로 이동합니다."
            );
            setTimeout(() => {
              router.push("/dashboard");
            }, 1000);
            return;
          }

          showSuccess("저장되었습니다.");
        } else {
          showError(result.error || "저장에 실패했습니다.");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "저장 중 오류가 발생했습니다.";
        showError(errorMessage);
      } finally {
        setSaving(false);
      }
    },
    [isInitialSetup, router, showSuccess, showError, reset]
  );

  const handleSave = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

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
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6 pb-24">
        <PageHeader title="프로필" />

        {isInitialSetup && (
          <InitialSetupBanner formData={watch()} />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-6"
        >
          <BasicInfoSection
            control={control}
            schoolType={schoolType}
            setSchoolType={setSchoolType}
            disabled={saving}
          />
          <CareerInfoSection
            control={control}
            disabled={saving}
            autoCalculateFlags={autoCalculateFlags}
            setAutoCalculateFlags={setAutoCalculateFlags}
            schoolType={schoolType}
            modalStates={modalStates}
            setModalState={setModalState}
          />
        </form>
      </div>

      <StickySaveButton
        hasChanges={isDirty}
        isSaving={saving}
        onSubmit={handleSave}
      />
    </PageContainer>
  );
}
