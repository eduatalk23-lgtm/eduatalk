"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserX, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useState } from "react";
import { useParentInfoForm } from "../_hooks/useParentInfoForm";
import {
  updateParentInfoAction,
  toggleParentStatusAction,
  deleteParentAction,
} from "@/lib/domains/parent/actions/management";
import type { ParentDetailData } from "@/lib/domains/parent/actions/detail";
import { ParentLinkedStudentsSection } from "./ParentLinkedStudentsSection";

type ParentFormPanelProps = {
  selectedParentId: string | null;
  parentData: ParentDetailData | null;
  isLoading: boolean;
  formMode: "info" | "selected";
  onParentDeleted: () => void;
  isAdmin: boolean;
};

export function ParentFormPanel({
  selectedParentId,
  parentData,
  isLoading,
  formMode,
  onParentDeleted,
  isAdmin,
}: ParentFormPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const form = useParentInfoForm(parentData);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;

  // 안내 모드 (학부모 미선택)
  if (formMode === "info" || !selectedParentId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white p-8 shadow-sm min-h-[400px]">
        <Info className="h-12 w-12 text-gray-300" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            왼쪽에서 학부모를 선택하세요
          </p>
          <p className="mt-1 text-xs text-gray-400">
            학부모는 초대 코드로 가입하므로, 직접 등록보다는 조회/관리 중심으로 사용합니다.
          </p>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-8 shadow-sm min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // 데이터 없음
  if (!parentData) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-8 shadow-sm min-h-[400px]">
        <p className="text-sm text-gray-400">학부모 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const inputClass = cn(
    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm",
    "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200",
    isPending && "opacity-50 cursor-not-allowed"
  );

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await updateParentInfoAction(selectedParentId, {
        name: data.name,
        phone: data.phone,
        email: data.email,
      });

      if (result.success) {
        showSuccess("학부모 정보가 수정되었습니다.");
        queryClient.invalidateQueries({ queryKey: ["parentSearch"] });
        queryClient.invalidateQueries({ queryKey: ["parentDetail", selectedParentId] });
      } else {
        showError(result.error ?? "수정에 실패했습니다.");
      }
    });
  });

  const handleToggleStatus = () => {
    startTransition(async () => {
      const newStatus = !parentData.is_active;
      const result = await toggleParentStatusAction(selectedParentId, newStatus);

      if (result.success) {
        showSuccess(newStatus ? "계정이 활성화되었습니다." : "계정이 비활성화되었습니다.");
        queryClient.invalidateQueries({ queryKey: ["parentSearch"] });
        queryClient.invalidateQueries({ queryKey: ["parentDetail", selectedParentId] });
      } else {
        showError(result.error ?? "상태 변경에 실패했습니다.");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteParentAction(selectedParentId);

      if (result.success) {
        showSuccess("학부모가 삭제되었습니다.");
        setShowDeleteConfirm(false);
        queryClient.invalidateQueries({ queryKey: ["parentSearch"] });
        onParentDeleted();
      } else {
        showError(result.error ?? "삭제에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 기본 정보 편집 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">학부모 정보</h2>
          <div className="flex items-center gap-2">
            {!parentData.is_active && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600">
                비활성
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={isPending}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                parentData.is_active
                  ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                  : "bg-green-50 text-green-600 hover:bg-green-100",
                isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              {parentData.is_active ? "비활성화" : "활성화"}
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              {...register("name")}
              disabled={isPending}
              className={inputClass}
              placeholder="이름"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* 연락처 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">연락처</label>
            <input
              {...register("phone")}
              disabled={isPending}
              className={inputClass}
              placeholder="010-0000-0000"
            />
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* 이메일 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">이메일</label>
            <input
              {...register("email")}
              disabled={isPending}
              className={inputClass}
              placeholder="example@email.com"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* 등록일/수정일 */}
          <div className="flex gap-4 text-xs text-gray-400">
            {parentData.created_at && (
              <span>등록: {new Date(parentData.created_at).toLocaleDateString("ko-KR")}</span>
            )}
            {parentData.updated_at && (
              <span>수정: {new Date(parentData.updated_at).toLocaleDateString("ko-KR")}</span>
            )}
          </div>
        </form>

        {/* 저장 버튼 */}
        <StickySaveButton
          hasChanges={isDirty}
          isSaving={isPending}
          onSubmit={onSubmit}
          onCancel={() => form.reset()}
        />
      </div>

      {/* 연결 학생 섹션 */}
      <ParentLinkedStudentsSection parentId={selectedParentId} />

      {/* 삭제 영역 (admin만) */}
      {isAdmin && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">학부모 삭제</p>
              <p className="text-xs text-red-500">
                연결된 학생이 없는 경우에만 삭제할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <UserX className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="학부모 삭제"
        description="이 학부모를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}
