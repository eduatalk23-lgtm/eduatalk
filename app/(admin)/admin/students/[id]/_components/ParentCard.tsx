"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  updateLinkRelation,
  deleteParentStudentLink,
  type StudentParent,
  type ParentRelation,
} from "@/lib/domains/student";
import { ConfirmDialog } from "@/components/ui/Dialog";

type ParentCardProps = {
  parent: StudentParent;
  onRefresh?: () => void;
};

const relationLabels: Record<ParentRelation, string> = {
  father: "아버지",
  mother: "어머니",
  guardian: "보호자",
  other: "기타",
};

export function ParentCard({ parent, onRefresh }: ParentCardProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [relation, setRelation] = useState<ParentRelation>(
    (parent.relation as ParentRelation) || "other"
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  function handleUpdateRelation(newRelation: ParentRelation) {
    if (newRelation === relation) return;

    const previousRelation = relation; // 이전 값 저장
    setRelation(newRelation);
    startTransition(async () => {
      const result = await updateLinkRelation(parent.linkId, newRelation);

      if (result.success) {
        showSuccess("관계가 수정되었습니다.");
        onRefresh?.();
      } else {
        setRelation(previousRelation); // 이전 값으로 롤백
        showError(result.error || "관계 수정에 실패했습니다.");
      }
    });
  }

  function handleDeleteLink() {
    setIsDeleteDialogOpen(true);
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteParentStudentLink(parent.linkId);

      if (result.success) {
        showSuccess("연결이 해제되었습니다.");
        onRefresh?.();
        setIsDeleteDialogOpen(false);
      } else {
        showError(result.error || "연결 해제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex-1">
        <div className="text-base font-semibold text-gray-900">
          {parent.parentName || "이름 없음"}
        </div>
        <div className="text-sm text-gray-500">
          {parent.parentPhone || parent.parentEmail || "-"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={relation}
          onChange={(e) =>
            handleUpdateRelation(e.target.value as ParentRelation)
          }
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="father">아버지</option>
          <option value="mother">어머니</option>
          <option value="guardian">보호자</option>
          <option value="other">기타</option>
        </select>

        <button
          onClick={handleDeleteLink}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "처리 중..." : "연결 해제"}
        </button>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="연결 해제 확인"
        description="정말 연결을 해제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="연결 해제"
        cancelLabel="취소"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}

