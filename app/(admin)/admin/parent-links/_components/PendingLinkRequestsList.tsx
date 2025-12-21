"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getPendingLinkRequests,
  approveLinkRequests,
  rejectLinkRequests,
  type PendingLinkRequest,
} from "@/app/(admin)/actions/parentStudentLinkActions";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { PendingLinkRequestCard } from "./PendingLinkRequestCard";
import { ConfirmDialog } from "@/components/ui/Dialog";

type PendingLinkRequestsListProps = {
  initialRequests?: PendingLinkRequest[];
  tenantId?: string | null;
};

export function PendingLinkRequestsList({
  initialRequests,
  tenantId,
}: PendingLinkRequestsListProps) {
  const { showError, showSuccess } = useToast();
  const [requests, setRequests] = useState<PendingLinkRequest[]>(
    initialRequests || []
  );
  const [isLoading, setIsLoading] = useState(!initialRequests);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  const { execute: executeRefresh, isPending: isRefreshPending } = useServerAction(getPendingLinkRequests, {
    onSuccess: (data) => {
      if (data) {
        setRequests(data);
        setSelectedIds(new Set());
      }
    },
    onError: (error) => {
      showError(error);
    },
  });

  // approveLinkRequests는 ActionResponse를 반환하지 않으므로 래퍼 함수 생성
  const approveLinkRequestsWrapper = async (linkIds: string[]) => {
    const result = await approveLinkRequests(linkIds);
    if (result.success) {
      return {
        success: true as const,
        data: result,
      };
    }
    return {
      success: false as const,
      error: "승인 처리 중 오류가 발생했습니다.",
    };
  };

  const { execute: executeBatchApprove, isPending: isApprovePending } = useServerAction(approveLinkRequestsWrapper, {
    onSuccess: (data) => {
      if (data) {
        const successMessage = `${data.approvedCount || 0}개의 연결 요청이 승인되었습니다.`;
        showSuccess(successMessage);
        setSelectedIds(new Set());
        handleRefresh();
        setIsApproveDialogOpen(false);
      }
    },
    onError: (error) => {
      showError(error);
      // 부분 성공 시에도 새로고침
      handleRefresh();
    },
  });

  // rejectLinkRequests는 ActionResponse를 반환하지 않으므로 래퍼 함수 생성
  const rejectLinkRequestsWrapper = async (linkIds: string[]) => {
    const result = await rejectLinkRequests(linkIds);
    if (result.success) {
      return {
        success: true as const,
        data: result,
      };
    }
    return {
      success: false as const,
      error: "거부 처리 중 오류가 발생했습니다.",
    };
  };

  const { execute: executeBatchReject, isPending: isRejectPending } = useServerAction(rejectLinkRequestsWrapper, {
    onSuccess: (data) => {
      if (data) {
        const successMessage = `${data.rejectedCount || 0}개의 연결 요청이 거부되었습니다.`;
        showSuccess(successMessage);
        setSelectedIds(new Set());
        handleRefresh();
        setIsRejectDialogOpen(false);
      }
    },
    onError: (error) => {
      showError(error);
      // 부분 성공 시에도 새로고침
      handleRefresh();
    },
  });

  const isPending = isRefreshPending || isApprovePending || isRejectPending;

  // 초기 데이터가 없으면 로드
  useEffect(() => {
    if (!initialRequests) {
      loadRequests();
    }
  }, [initialRequests]);

  async function loadRequests() {
    setIsLoading(true);
    const result = await getPendingLinkRequests(tenantId || undefined);

    if (result.success && result.data) {
      setRequests(result.data);
    } else {
      if (result.error) {
        showError(result.error);
      }
      setRequests([]);
    }
    setIsLoading(false);
  }

  function handleRefresh() {
    executeRefresh(tenantId || undefined);
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  }

  function handleBatchApprove() {
    if (selectedIds.size === 0) return;
    setPendingAction("approve");
    setIsApproveDialogOpen(true);
  }

  function handleConfirmBatchApprove() {
    const linkIds = Array.from(selectedIds);
    setPendingAction("approve");
    executeBatchApprove(linkIds);
    setPendingAction(null);
  }

  function handleBatchReject() {
    if (selectedIds.size === 0) return;
    setPendingAction("reject");
    setIsRejectDialogOpen(true);
  }

  function handleConfirmBatchReject() {
    const linkIds = Array.from(selectedIds);
    setPendingAction("reject");
    executeBatchReject(linkIds);
    setPendingAction(null);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="text-center text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          승인 대기 중인 연결 요청
        </h2>
        <div className="py-8 text-center text-sm text-gray-500">
          승인 대기 중인 연결 요청이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            승인 대기 중인 연결 요청 ({requests.length}건)
          </h2>
          {isSelectMode && selectedIds.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedIds.size}개 선택됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <button
                onClick={handleSelectAll}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {selectedIds.size === requests.length ? "전체 해제" : "전체 선택"}
              </button>
              <button
                onClick={handleBatchApprove}
                disabled={isPending || selectedIds.size === 0}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 항목 승인 ({selectedIds.size})
              </button>
              <button
                onClick={handleBatchReject}
                disabled={isPending || selectedIds.size === 0}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 항목 거부 ({selectedIds.size})
              </button>
              <button
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 모드 종료
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsSelectMode(true)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 모드
              </button>
              <button
                onClick={handleRefresh}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                새로고침
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {requests.map((request) => (
          <PendingLinkRequestCard
            key={request.id}
            request={request}
            onRefresh={handleRefresh}
            isSelectMode={isSelectMode}
            isSelected={selectedIds.has(request.id)}
            onToggleSelect={() => handleToggleSelect(request.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
        title="일괄 승인 확인"
        description={`선택한 ${selectedIds.size}개의 연결 요청을 승인하시겠습니까?`}
        confirmLabel="승인"
        cancelLabel="취소"
        onConfirm={handleConfirmBatchApprove}
        variant="default"
        isLoading={isPending}
      />

      <ConfirmDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        title="일괄 거부 확인"
        description={`선택한 ${selectedIds.size}개의 연결 요청을 거부하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="거부"
        cancelLabel="취소"
        onConfirm={handleConfirmBatchReject}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}

