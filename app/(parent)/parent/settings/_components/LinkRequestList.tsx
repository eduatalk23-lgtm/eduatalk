"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { cancelLinkRequest, type LinkRequest } from "@/app/(parent)/actions/parentStudentLinkRequestActions";

type LinkRequestListProps = {
  requests: LinkRequest[];
  parentId: string;
  onCancel?: () => void;
};

export function LinkRequestList({
  requests,
  parentId,
  onCancel,
}: LinkRequestListProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleCancel(requestId: string) {
    startTransition(async () => {
      const result = await cancelLinkRequest(requestId, parentId);

      if (result.success) {
        showSuccess("연결 요청이 취소되었습니다.");
        onCancel?.();
      } else {
        showError(result.error || "요청 취소에 실패했습니다.");
      }
    });
  }

  function getStatusBadge(isApproved: boolean | null) {
    if (isApproved === true) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          승인됨
        </span>
      );
    }
    if (isApproved === false) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          거부됨
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
        대기 중
      </span>
    );
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

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        연결 요청 목록
      </h2>
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-gray-900">
                  {request.studentName || "이름 없음"}
                </div>
                {getStatusBadge(request.is_approved)}
              </div>
              {request.grade && request.class && (
                <div className="mt-1 text-sm text-gray-500">
                  {request.grade}학년 {request.class}반
                </div>
              )}
              <div className="mt-1 text-xs text-gray-400">
                관계: {getRelationText(request.relation)} · 요청일:{" "}
                {new Date(request.created_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
            {request.is_approved !== true && (
              <button
                onClick={() => handleCancel(request.id)}
                disabled={isPending}
                className="ml-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "취소 중..." : "요청 취소"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

