"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  approveLinkRequest,
  rejectLinkRequest,
  type PendingLinkRequest,
} from "@/app/(admin)/actions/parentStudentLinkActions";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { ConfirmDialog } from "@/components/ui/Dialog";

type PendingLinkRequestCardProps = {
  request: PendingLinkRequest;
  onRefresh: () => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function PendingLinkRequestCard({
  request,
  onRefresh,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: PendingLinkRequestCardProps) {
  const { showSuccess, showError } = useToast();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const { execute: executeApprove, isPending: isApprovePending } = useServerAction(approveLinkRequest, {
    onSuccess: () => {
      showSuccess("연결 요청이 승인되었습니다.");
      onRefresh();
    },
    onError: (error) => {
      showError(error);
    },
  });

  const { execute: executeReject, isPending: isRejectPending } = useServerAction(rejectLinkRequest, {
    onSuccess: () => {
      showSuccess("연결 요청이 거부되었습니다.");
      onRefresh();
      setIsRejectDialogOpen(false);
    },
    onError: (error) => {
      showError(error);
    },
  });

  const isPending = isApprovePending || isRejectPending;

  function handleApprove() {
    executeApprove(request.id);
  }

  function handleReject() {
    setIsRejectDialogOpen(true);
  }

  function handleConfirmReject() {
    executeReject(request.id);
  }

  function getRelationText(relation: string) {
    switch (relation) {
      case "father":
        return "아버지";
      case "mother":
        return "어머니";
      case "guardian":
        return "보호자";
      case "other":
        return "기타";
      default:
        return relation;
    }
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-4 transition ${
        isSelected
          ? "border-indigo-500 bg-indigo-50 hover:bg-indigo-100"
          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      {isSelectMode && (
        <div>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>
      )}
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold text-gray-900">
            {request.studentName || "이름 없음"}
          </div>
          {request.studentGrade && request.studentClass && (
            <div className="text-sm text-gray-500">
              {request.studentGrade}학년 {request.studentClass}반
            </div>
          )}
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">학부모:</span> {request.parentName || "이름 없음"}
          {request.parentEmail && (
            <span className="text-gray-500">{" "}({request.parentEmail})</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>관계: {getRelationText(request.relation)}</span>
          <span>
            요청일: {new Date(request.created_at).toLocaleDateString("ko-KR")}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          승인
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          거부
        </button>
      </div>

      <ConfirmDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        title="연결 요청 거부 확인"
        description="연결 요청을 거부하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="거부"
        cancelLabel="취소"
        onConfirm={handleConfirmReject}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}

