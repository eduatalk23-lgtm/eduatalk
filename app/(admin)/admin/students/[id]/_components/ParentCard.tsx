"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  updateLinkRelation,
  deleteParentStudentLink,
  type StudentParent,
  type ParentRelation,
} from "@/app/(admin)/actions/parentStudentLinkActions";

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

  function handleUpdateRelation(newRelation: ParentRelation) {
    if (newRelation === relation) return;

    setRelation(newRelation);
    startTransition(async () => {
      const result = await updateLinkRelation(parent.linkId, newRelation);

      if (result.success) {
        showSuccess("관계가 수정되었습니다.");
        onRefresh?.();
      } else {
        setRelation(relation); // 롤백
        showError(result.error || "관계 수정에 실패했습니다.");
      }
    });
  }

  function handleDeleteLink() {
    if (!confirm("정말 연결을 해제하시겠습니까?")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteParentStudentLink(parent.linkId);

      if (result.success) {
        showSuccess("연결이 해제되었습니다.");
        onRefresh?.();
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
        <div className="text-sm text-gray-500">{parent.parentEmail || "-"}</div>
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
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {isPending ? "처리 중..." : "연결 해제"}
        </button>
      </div>
    </div>
  );
}

