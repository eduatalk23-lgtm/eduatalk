"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { useStudentInfoForm } from "../[id]/_hooks/useStudentInfoForm";
import { transformFormDataToUpdatePayload } from "../[id]/_utils/studentFormTransform";
import { updateStudentInfo, createStudent, deleteStudent } from "@/lib/domains/student";
import type { StudentInfoData, AdminStudentFormData } from "../[id]/_types/studentFormTypes";
import BasicInfoSection from "../[id]/_components/sections/BasicInfoSection";
import ProfileInfoSection from "../[id]/_components/sections/ProfileInfoSection";
import CareerInfoSection from "../[id]/_components/sections/CareerInfoSection";
import { Plus, Trash2, ExternalLink, CalendarDays, Loader2, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { ConnectionSection } from "../[id]/_components/ConnectionSection";

type FormMode = "register" | "selected";

type StudentFormPanelProps = {
  selectedStudentId: string | null;
  studentData: (StudentInfoData & {
    email: string | null;
    authProvider: string;
    lastSignInAt: string | null;
  }) | null;
  isLoading: boolean;
  formMode: FormMode;
  onNewStudent: () => void;
  onStudentSaved: (studentId: string) => void;
  onStudentDeleted: () => void;
  isAdmin: boolean;
};

export function StudentFormPanel({
  selectedStudentId,
  studentData,
  isLoading,
  formMode,
  onNewStudent,
  onStudentSaved,
  onStudentDeleted,
  isAdmin,
}: StudentFormPanelProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [schoolType, setSchoolType] = useState<
    "중학교" | "고등학교" | undefined
  >(undefined);

  // 폼 초기 데이터 (register 모드에서는 null)
  const initialData = formMode === "register" ? null : studentData;

  const { control, isDirty, dirtyFields, handleSubmit, reset } =
    useStudentInfoForm({ initialData });

  // 학교 타입 감지 (파생값)
  const derivedSchoolType = useMemo(() => {
    if (studentData?.school_id) {
      if (studentData.school_type === "MIDDLE") return "중학교" as const;
      if (studentData.school_type === "HIGH") return "고등학교" as const;
    }
    return undefined;
  }, [studentData]);

  // 저장 핸들러 (수정)
  const handleUpdate = useCallback(
    async (formData: AdminStudentFormData) => {
      if (!selectedStudentId) return;
      startTransition(async () => {
        try {
          const payload = transformFormDataToUpdatePayload(
            formData,
            dirtyFields
          );
          const result = await updateStudentInfo(selectedStudentId, payload);

          if (result.success) {
            showSuccess("학생 정보가 저장되었습니다.");
            await queryClient.invalidateQueries({
              queryKey: ["studentDetail", selectedStudentId],
            });
            await queryClient.invalidateQueries({
              queryKey: ["studentSearch"],
            });
            onStudentSaved(selectedStudentId);
          } else {
            showError(result.error || "저장에 실패했습니다.");
          }
        } catch (error) {
          showError(
            error instanceof Error
              ? error.message
              : "저장 중 오류가 발생했습니다."
          );
        }
      });
    },
    [
      selectedStudentId,
      dirtyFields,
      queryClient,
      onStudentSaved,
      showSuccess,
      showError,
    ]
  );

  // 저장 핸들러 (신규 등록)
  const handleCreate = useCallback(
    async (formData: AdminStudentFormData) => {
      startTransition(async () => {
        try {
          const fd = new FormData();
          const fields: Array<[string, string | undefined]> = [
            ["name", formData.name],
            ["phone", formData.phone],
            ["grade", formData.grade],
            ["class", formData.class],
            ["birth_date", formData.birth_date],
            ["school_id", formData.school_id],
            ["division", formData.division],
            ["gender", formData.gender],
            ["memo", formData.memo],
            ["status", formData.status],
            ["address", formData.address],
            ["emergency_contact", formData.emergency_contact],
            ["emergency_contact_phone", formData.emergency_contact_phone],
            ["medical_info", formData.medical_info],
          ];
          for (const [key, value] of fields) {
            if (value != null && value !== "") fd.append(key, value);
          }

          const result = await createStudent(fd);

          if (result.success && result.studentId) {
            showSuccess("학생이 등록되었습니다.");
            await queryClient.invalidateQueries({
              queryKey: ["studentSearch"],
            });
            onStudentSaved(result.studentId);
          } else {
            showError(result.error || "학생 등록에 실패했습니다.");
          }
        } catch (error) {
          showError(
            error instanceof Error
              ? error.message
              : "등록 중 오류가 발생했습니다."
          );
        }
      });
    },
    [queryClient, onStudentSaved, showSuccess, showError]
  );

  // 삭제 핸들러
  const handleDeleteConfirm = useCallback(() => {
    if (!selectedStudentId) return;
    startTransition(async () => {
      const result = await deleteStudent(selectedStudentId);
      if (result.success) {
        showSuccess("학생이 삭제되었습니다.");
        await queryClient.invalidateQueries({ queryKey: ["studentSearch"] });
        onStudentDeleted();
      } else {
        showError(result.error || "삭제에 실패했습니다.");
      }
      setShowDeleteConfirm(false);
    });
  }, [
    selectedStudentId,
    queryClient,
    onStudentDeleted,
    showSuccess,
    showError,
  ]);

  // 취소 핸들러
  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  // 폼 제출 핸들러
  const onSubmit = formMode === "register"
    ? handleSubmit(handleCreate)
    : handleSubmit(handleUpdate);

  // 로딩 상태
  if (isLoading && selectedStudentId) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white p-12 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
        {formMode === "selected" && (
          <>
            <button
              type="button"
              onClick={onNewStudent}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              신규등록
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            )}
            {selectedStudentId && (
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href={`/admin/students/${selectedStudentId}/plans`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                >
                  <CalendarDays className="h-4 w-4" />
                  플래너
                </Link>
                <Link
                  href={`/admin/students/${selectedStudentId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  상세보기
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}
        {formMode === "register" && (
          <>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              저장
            </button>
            <button
              type="button"
              onClick={() => reset()}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              초기화
            </button>
          </>
        )}
      </div>

      {/* 폼 섹션 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-6"
      >
        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <BasicInfoSection
            control={control}
            schoolType={schoolType ?? derivedSchoolType}
            setSchoolType={setSchoolType}
          />
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <CareerInfoSection control={control} />
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <ProfileInfoSection
            control={control}
            studentEmail={studentData?.email ?? null}
            authProvider={studentData?.authProvider}
            lastSignInAt={studentData?.lastSignInAt}
          />
        </div>
      </form>

      {/* 연결 관리 (학부모, 형제/자매, 초대 코드) */}
      {formMode === "selected" && selectedStudentId && (
        <ConnectionSection studentId={selectedStudentId} />
      )}

      {/* 변경사항 감지 시 하단 sticky 저장 버튼 (상세보기와 동일 패턴) */}
      {formMode === "selected" && (
        <StickySaveButton
          hasChanges={isDirty}
          isSaving={isPending}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          submitLabel="저장하기"
          cancelLabel="취소"
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="학생 삭제"
        description={`정말 ${studentData?.name ?? "이 학생"}을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 모든 데이터가 삭제됩니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
