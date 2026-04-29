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
import BasicInfoSection from "@/components/organisms/BasicInfoSection";
import ProfileInfoSection from "../[id]/_components/sections/ProfileInfoSection";
import CareerInfoSection from "@/components/organisms/CareerInfoSection";
import { Plus, Trash2, ExternalLink, CalendarDays, ClipboardList, Loader2, RotateCcw, Save, Wallet, Users, MessageSquare, BarChart3, Clock, Send, UserX, UserCheck } from "lucide-react";
import Link from "next/link";
import { WithdrawStudentModal } from "./WithdrawStudentModal";
import { ReEnrollStudentModal } from "./ReEnrollStudentModal";

type FormMode = "register" | "selected";

// ============================================
// 액션 버튼 색상 토큰 (Linear 스타일 절제)
// primary: 주 액션 / error: 파괴 / warning: 위험 상태 / success: 회복 / neutral: 그 외
// ============================================
const ACTION_BASE =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1";
const ACTION_PRIMARY = `${ACTION_BASE} bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50`;
const ACTION_DANGER = `${ACTION_BASE} border border-error-200 text-error-600 hover:bg-error-50 dark:border-error-800 dark:hover:bg-error-900/20`;
const ACTION_WARNING = `${ACTION_BASE} border border-warning-200 text-warning-600 hover:bg-warning-50 dark:border-warning-800 dark:hover:bg-warning-900/20`;
const ACTION_SUCCESS = `${ACTION_BASE} border border-success-200 text-success-600 hover:bg-success-50 dark:border-success-800 dark:hover:bg-success-900/20`;
const ACTION_NEUTRAL = `${ACTION_BASE} border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary`;

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
  onOpenEnrollment?: () => void;
  onOpenFamily?: () => void;
  onOpenConsultation?: () => void;
  onOpenScore?: () => void;
  onOpenTimeManagement?: () => void;
  onOpenSMS?: () => void;
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
  onOpenEnrollment,
  onOpenFamily,
  onOpenConsultation,
  onOpenScore,
  onOpenTimeManagement,
  onOpenSMS,
  isAdmin,
}: StudentFormPanelProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showReEnrollModal, setShowReEnrollModal] = useState(false);

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
          const result = await createStudent({
            basic: {
              name: formData.name || "",
              grade: formData.grade || "",
              class: formData.class || null,
              birth_date: formData.birth_date || "",
              school_id: formData.school_id || null,
              division: (formData.division as "고등부" | "중등부" | "졸업") || null,
              status: (formData.status as "enrolled" | "not_enrolled") || null,
            },
            profile: {
              gender: (formData.gender as "남" | "여") || null,
              phone: formData.phone || null,
              mother_phone: formData.mother_phone || null,
              father_phone: formData.father_phone || null,
              address: formData.address || null,
              emergency_contact: formData.emergency_contact || null,
              emergency_contact_phone: formData.emergency_contact_phone || null,
              medical_info: formData.medical_info || null,
            },
            career: {
              // exam_year, curriculum_revision은 createStudent 액션에서 학년 기반 자동 산출
              desired_university_ids: formData.desired_university_ids ?? null,
              desired_career_field: formData.desired_career_field || null,
            },
          });

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
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-white p-12 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4 shadow-sm sm:p-6">
      {/* 액션 바 — 색상 절제: primary(주 액션) / error(파괴) / warning(상태 위험) / success(상태 회복) / neutral(나머지) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {formMode === "selected" && (
          <>
            <button
              type="button"
              onClick={onNewStudent}
              className={ACTION_PRIMARY}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              신규등록
            </button>
            {isAdmin && studentData?.status === "enrolled" && (
              <button
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                className={ACTION_WARNING}
              >
                <UserX className="h-4 w-4" aria-hidden="true" />
                비재원 처리
              </button>
            )}
            {isAdmin && studentData?.status === "not_enrolled" && (
              <button
                type="button"
                onClick={() => setShowReEnrollModal(true)}
                className={ACTION_SUCCESS}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                재등록
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className={ACTION_DANGER}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                삭제
              </button>
            )}
            {selectedStudentId && (
              <div className="ml-auto flex items-center gap-2">
                {onOpenEnrollment && (
                  <button type="button" onClick={onOpenEnrollment} className={ACTION_NEUTRAL}>
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    수강/수납
                  </button>
                )}
                {onOpenFamily && (
                  <button type="button" onClick={onOpenFamily} className={ACTION_NEUTRAL}>
                    <Users className="h-4 w-4" aria-hidden="true" />
                    가족
                  </button>
                )}
                {onOpenConsultation && (
                  <button type="button" onClick={onOpenConsultation} className={ACTION_NEUTRAL}>
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    상담
                  </button>
                )}
                {onOpenScore && (
                  <button type="button" onClick={onOpenScore} className={ACTION_NEUTRAL}>
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    성적
                  </button>
                )}
                {onOpenTimeManagement && (
                  <button type="button" onClick={onOpenTimeManagement} className={ACTION_NEUTRAL}>
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    시간관리
                  </button>
                )}
                {onOpenSMS && (
                  <button type="button" onClick={onOpenSMS} className={ACTION_NEUTRAL}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    SMS
                  </button>
                )}
                <Link
                  href={`/admin/students/${selectedStudentId}/plans`}
                  className={ACTION_NEUTRAL}
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  플래너
                </Link>
                <Link
                  href={`/admin/students/${selectedStudentId}/record`}
                  className={ACTION_NEUTRAL}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  생기부
                </Link>
                <Link
                  href={`/admin/students/${selectedStudentId}`}
                  className={ACTION_NEUTRAL}
                >
                  상세보기
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
        {formMode === "register" && (
          <>
            <button type="button" onClick={onSubmit} disabled={isPending} className={ACTION_PRIMARY}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              저장
            </button>
            <button type="button" onClick={() => reset()} disabled={isPending} className={ACTION_NEUTRAL}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
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
        <div className="rounded-lg border border-border bg-bg-secondary/50 p-4">
          <BasicInfoSection
            control={control}
            schoolType={schoolType ?? derivedSchoolType}
            setSchoolType={setSchoolType}
          />
        </div>

        <div className="rounded-lg border border-border bg-bg-secondary/50 p-4">
          <CareerInfoSection control={control} config={{ showSchoolTier: true }} />
        </div>

        <div className="rounded-lg border border-border bg-bg-secondary/50 p-4">
          <ProfileInfoSection
            control={control}
            studentEmail={studentData?.email ?? null}
            authProvider={studentData?.authProvider}
            lastSignInAt={studentData?.lastSignInAt}
          />
        </div>
      </form>

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

      {/* 비재원 처리 모달 */}
      {selectedStudentId && studentData && (
        <WithdrawStudentModal
          open={showWithdrawModal}
          onOpenChange={setShowWithdrawModal}
          studentId={selectedStudentId}
          studentName={studentData.name ?? "학생"}
        />
      )}

      {/* 재등록 모달 */}
      {selectedStudentId && studentData && (
        <ReEnrollStudentModal
          open={showReEnrollModal}
          onOpenChange={setShowReEnrollModal}
          studentId={selectedStudentId}
          studentName={studentData.name ?? "학생"}
          previousReason={studentData.withdrawn_reason}
          previousDate={studentData.withdrawn_at}
        />
      )}
    </div>
  );
}
