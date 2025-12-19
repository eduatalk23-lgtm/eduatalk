"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { useStudentInfoForm } from "../_hooks/useStudentInfoForm";
import { transformFormDataToUpdatePayload } from "../_utils/studentFormTransform";
import { updateStudentInfo } from "@/app/(admin)/actions/studentManagementActions";
import type { StudentInfoData } from "../_types/studentFormTypes";
import BasicInfoSection from "./sections/BasicInfoSection";
import ProfileInfoSection from "./sections/ProfileInfoSection";
import CareerInfoSection from "./sections/CareerInfoSection";
import { StudentActions } from "../../_components/StudentActions";

type StudentInfoEditFormProps = {
  studentId: string;
  studentName: string | null;
  isActive: boolean | null;
  initialData: StudentInfoData | null;
  isAdmin: boolean;
  studentEmail: string | null;
};

export default function StudentInfoEditForm({
  studentId,
  studentName,
  isActive,
  initialData,
  isAdmin,
  studentEmail,
}: StudentInfoEditFormProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | undefined
  >(undefined);

  const {
    form,
    control,
    isDirty,
    dirtyFields,
    handleSubmit,
    reset,
  } = useStudentInfoForm({
    initialData,
  });

  // 저장 핸들러
  const onSubmit = useCallback(
    async (formData: any) => {
      startTransition(async () => {
        // 변경된 필드만 포함하는 페이로드 생성
        const payload = transformFormDataToUpdatePayload(
          formData,
          dirtyFields as any
        );

        const result = await updateStudentInfo(studentId, payload);

        if (result.success) {
          showSuccess("학생 정보가 업데이트되었습니다.");
          router.refresh();
          // 폼 리셋하여 dirty 상태 초기화
          reset();
        } else {
          showError(result.error || "학생 정보 업데이트에 실패했습니다.");
        }
      });
    },
    [studentId, dirtyFields, router, showSuccess, showError, reset]
  );

  // 취소 핸들러
  const handleCancel = useCallback(() => {
    reset();
    showSuccess("변경사항이 취소되었습니다.");
  }, [reset, showSuccess]);

  // 학교 타입 감지 (school_id에서)
  useMemo(() => {
    if (initialData?.school_id) {
      // school_id에서 타입 추론 (SCHOOL_는 중/고, UNIV_는 대학교)
      if (initialData.school_id.startsWith("UNIV_")) {
        setSchoolType(undefined);
      } else if (initialData.school_type === "MIDDLE") {
        setSchoolType("중학교");
      } else if (initialData.school_type === "HIGH") {
        setSchoolType("고등학교");
      }
    }
  }, [initialData]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">학생 정보 관리</h2>
        <StudentActions
          studentId={studentId}
          studentName={studentName ?? "이름 없음"}
          isActive={isActive !== false}
          isAdmin={isAdmin}
        />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%]">
          {/* 왼쪽: 기본 정보 + 진로 정보 */}
          <div className="flex flex-col gap-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <BasicInfoSection
                control={control}
                schoolType={schoolType}
                setSchoolType={setSchoolType}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <CareerInfoSection control={control} />
            </div>
          </div>

          {/* 오른쪽: 프로필 정보 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <ProfileInfoSection control={control} studentEmail={studentEmail} />
          </div>
        </div>
      </form>

      <StickySaveButton
        hasChanges={isDirty}
        isSaving={isPending}
        onSubmit={handleSubmit(onSubmit)}
        onCancel={handleCancel}
        submitLabel="저장하기"
        cancelLabel="취소"
      />
    </div>
  );
}

