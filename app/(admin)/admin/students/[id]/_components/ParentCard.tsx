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

  const [isLastLink, setIsLastLink] = useState(false);

  function handleDeleteLink() {
    // 삭제 전 해당 학부모의 남은 링크 수를 확인하여 마지막 링크 경고 표시
    startTransition(async () => {
      try {
        const { checkIsLastParentLink } = await import("@/lib/domains/student/actions/parentLinks");
        const lastLink = await checkIsLastParentLink(parent.parentId);
        setIsLastLink(lastLink);
      } catch {
        setIsLastLink(false);
      }
      setIsDeleteDialogOpen(true);
    });
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteParentStudentLink(parent.linkId);

      if (result.success) {
        if (result.isLastLink) {
          showSuccess("연결이 해제되었습니다. 이 학부모는 더 이상 연결된 학생이 없습니다.");
        } else {
          showSuccess("연결이 해제되었습니다.");
        }
        onRefresh?.();
        setIsDeleteDialogOpen(false);
      } else {
        showError(result.error || "연결 해제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary p-4">
      <div className="flex-1">
        <div className="text-base font-semibold text-text-primary">
          {parent.parentName || "이름 없음"}
        </div>
        <div className="text-sm text-text-tertiary">
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
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-secondary disabled:bg-bg-tertiary disabled:cursor-not-allowed"
        >
          <option value="father">아버지</option>
          <option value="mother">어머니</option>
          <option value="guardian">보호자</option>
          <option value="other">기타</option>
        </select>

        <button
          onClick={handleDeleteLink}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-tertiary transition hover:text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "처리 중..." : "연결 해제"}
        </button>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="연결 해제 확인"
        description={
          isLastLink
            ? `정말 연결을 해제하시겠습니까? 이 학부모의 마지막 학생 연결입니다. 해제 후 학부모 계정으로 접근할 수 있는 학생이 없게 됩니다.`
            : "정말 연결을 해제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        }
        confirmLabel="연결 해제"
        cancelLabel="취소"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}

