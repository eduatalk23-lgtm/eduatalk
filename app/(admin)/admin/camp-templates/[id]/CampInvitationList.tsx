"use client";

import { useState, useTransition, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CampInvitation } from "@/lib/types/plan";
import { deleteCampInvitationAction, deleteCampInvitationsAction, resendCampInvitationsAction, updateCampInvitationStatusAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { Pagination } from "@/components/organisms/Pagination";
import { ConfirmDialog } from "@/components/ui/Dialog";

type CampInvitationListProps = {
  invitations: Array<CampInvitation & { student_name?: string | null; student_grade?: string | null; student_class?: string | null }>;
  loading: boolean;
  templateId: string;
  onRefresh?: () => void;
  onDeleteInvitations?: (deletedCount: number) => void;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  filters?: {
    search?: string;
    status?: string;
  };
  onFilterChange?: (filters: { search?: string; status?: string }) => void;
};

export function CampInvitationList({ 
  invitations, 
  loading, 
  templateId, 
  onRefresh,
  onDeleteInvitations,
  total,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  filters = {},
  onFilterChange,
}: CampInvitationListProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [statusInput, setStatusInput] = useState(filters.status || "");
  
  // 상태 변경 확인 다이얼로그 상태
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    invitationId: string;
    oldStatus: "pending" | "accepted" | "declined";
    newStatus: "pending" | "accepted" | "declined";
  } | null>(null);
  
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  
  // TanStack Query를 사용한 Optimistic Update 패턴
  const statusChangeMutation = useMutation({
    mutationFn: async ({ invitationId, newStatus }: { invitationId: string; newStatus: "pending" | "accepted" | "declined" }) => {
      const result = await updateCampInvitationStatusAction(invitationId, newStatus);
      if (!result.success) {
        throw new Error(result.error || "상태 변경에 실패했습니다.");
      }
      return result;
    },
    onMutate: async ({ invitationId, newStatus }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ["camp-invitations", templateId] });
      
      // 이전 상태 스냅샷
      const previousInvitations = queryClient.getQueryData<typeof invitations>(["camp-invitations", templateId]);
      
      // Optimistic update
      queryClient.setQueryData<typeof invitations>(["camp-invitations", templateId], (old) => {
        if (!old) return old;
        return old.map((inv) => 
          inv.id === invitationId ? { ...inv, status: newStatus } : inv
        );
      });
      
      return { previousInvitations };
    },
    onError: (err, variables, context) => {
      // 롤백
      if (context?.previousInvitations) {
        queryClient.setQueryData(["camp-invitations", templateId], context.previousInvitations);
      }
      toast.showError(err.message || "상태 변경에 실패했습니다.");
    },
    onSuccess: () => {
      toast.showSuccess("초대 상태가 변경되었습니다.");
      onRefresh?.();
    },
    onSettled: () => {
      // 성공/실패 관계없이 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["camp-invitations", templateId] });
    },
  });
  
  // Optimistic update는 mutation의 onMutate에서 처리되므로
  // props로 받은 데이터를 그대로 사용 (상위 컴포넌트에서 useQuery 사용 시 자동 반영됨)
  const invitationsWithOptimistic = invitations;
  
  // 필터 변경 시 입력값 동기화 (모든 hooks는 early return 전에 선언되어야 함)
  useEffect(() => {
    setSearchInput(filters.search || "");
    setStatusInput(filters.status || "");
  }, [filters]);
  
  if (loading) {
    return <div className="text-sm text-gray-700">초대 목록을 불러오는 중...</div>;
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-700">발송된 초대가 없습니다.</p>
      </div>
    );
  }

  // 상태별 통계 (Optimistic update 반영)
  const stats = {
    pending: invitationsWithOptimistic.filter((inv) => inv.status === "pending").length,
    accepted: invitationsWithOptimistic.filter((inv) => inv.status === "accepted").length,
    declined: invitationsWithOptimistic.filter((inv) => inv.status === "declined").length,
  };

  const handleToggleSelect = (invitationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(invitationId)) {
        next.delete(invitationId);
      } else {
        next.add(invitationId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === invitations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invitations.map((inv) => inv.id)));
    }
  };

  const handleDelete = (invitationId: string) => {
    const invitation = invitations.find((inv) => inv.id === invitationId);
    const warningMessage =
      invitation?.status === "accepted"
        ? "이미 수락된 초대입니다. 정말 삭제하시겠습니까?"
        : "정말 이 초대를 삭제하시겠습니까?";

    if (!confirm(warningMessage)) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteCampInvitationAction(invitationId);
        if (result.success) {
          toast.showSuccess("초대가 삭제되었습니다.");
          onDeleteInvitations?.(1);
        } else {
          toast.showError(result.error || "초대 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("초대 삭제 실패:", error);
        toast.showError("초대 삭제에 실패했습니다.");
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.showError("삭제할 초대를 선택해주세요.");
      return;
    }

    const selectedInvitations = invitations.filter((inv) => selectedIds.has(inv.id));
    const hasAccepted = selectedInvitations.some((inv) => inv.status === "accepted");
    const warningMessage = hasAccepted
      ? `${selectedIds.size}개의 초대를 삭제합니다. 이미 수락된 초대가 포함되어 있습니다. 계속하시겠습니까?`
      : `${selectedIds.size}개의 초대를 삭제합니다. 계속하시겠습니까?`;

    if (!confirm(warningMessage)) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteCampInvitationsAction(Array.from(selectedIds));
        if (result.success) {
          const deletedCount = result.count || selectedIds.size;
          toast.showSuccess(`${deletedCount}개의 초대가 삭제되었습니다.`);
          setSelectedIds(new Set());
          onDeleteInvitations?.(deletedCount);
        } else {
          toast.showError(result.error || "초대 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("초대 일괄 삭제 실패:", error);
        // AppError의 메시지 추출
        const errorMessage =
          error instanceof Error
            ? error.message
            : "초대 삭제에 실패했습니다.";
        toast.showError(errorMessage);
      }
    });
  };

  const handleResend = () => {
    if (selectedIds.size === 0) {
      toast.showError("재발송할 초대를 선택해주세요.");
      return;
    }

    if (!confirm(`${selectedIds.size}개의 초대를 재발송합니다. 계속하시겠습니까?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await resendCampInvitationsAction(templateId, Array.from(selectedIds));
        if (result.success) {
          toast.showSuccess(`${result.count || selectedIds.size}개의 초대가 재발송되었습니다.`);
          setSelectedIds(new Set());
          onRefresh?.();
        } else {
          toast.showError(result.error || "초대 재발송에 실패했습니다.");
        }
      } catch (error) {
        console.error("초대 재발송 실패:", error);
        toast.showError("초대 재발송에 실패했습니다.");
      }
    });
  };

  // 필터 적용 핸들러
  const handleApplyFilters = () => {
    onFilterChange?.({
      search: searchInput.trim() || undefined,
      status: statusInput || undefined,
    });
  };

  // 필터 초기화 핸들러
  const handleResetFilters = () => {
    setSearchInput("");
    setStatusInput("");
    onFilterChange?.({});
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 UI */}
      {onFilterChange && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">필터</h3>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              초기화
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="filter-search" className="block text-xs font-medium text-gray-700 mb-1">
                학생명 검색
              </label>
              <input
                id="filter-search"
                type="text"
                placeholder="학생명 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyFilters();
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="filter-status" className="block text-xs font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                id="filter-status"
                value={statusInput}
                onChange={(e) => {
                  setStatusInput(e.target.value);
                  onFilterChange?.({
                    search: searchInput.trim() || undefined,
                    status: e.target.value || undefined,
                  });
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="pending">대기중</option>
                <option value="accepted">수락</option>
                <option value="declined">거절</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                검색
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-800">대기중</div>
          <div className="mt-1 text-2xl font-semibold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-800">수락</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">{stats.accepted}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-800">거절</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">{stats.declined}</div>
        </div>
      </div>

      {/* 액션 버튼 */}
      {invitations.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {selectedIds.size === invitations.length ? "전체 해제" : "전체 선택"}
            </button>
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  {isPending ? "처리 중..." : `재발송 (${selectedIds.size})`}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:bg-gray-100"
                >
                  {isPending ? "삭제 중..." : `삭제 (${selectedIds.size})`}
                </button>
              </>
            )}
          </div>
          {selectedIds.size > 0 && (
            <div className="text-sm text-gray-800">
              {selectedIds.size}개 선택됨
            </div>
          )}
        </div>
      )}

      {/* 초대 목록 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedIds.size === invitations.length && invitations.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                학생명
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                학년/반
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                상태
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                초대일
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                처리일
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {invitationsWithOptimistic.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-gray-50">
                <td className="border-b border-gray-100 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(invitation.id)}
                    onChange={() => handleToggleSelect(invitation.id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                  {invitation.student_name || "이름 없음"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-800">
                  {invitation.student_grade && invitation.student_class
                    ? `${invitation.student_grade}학년 ${invitation.student_class}반`
                    : "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm">
                  <select
                    value={invitation.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as "pending" | "accepted" | "declined";
                      const oldStatus = invitation.status;
                      
                      if (newStatus !== oldStatus) {
                        // accepted ↔ declined 변경 시 확인 필수
                        const requiresConfirmation = 
                          (oldStatus === "accepted" && newStatus === "declined") ||
                          (oldStatus === "declined" && newStatus === "accepted");
                        
                        if (requiresConfirmation) {
                          // 확인 다이얼로그 표시
                          setStatusChangeDialog({
                            open: true,
                            invitationId: invitation.id,
                            oldStatus,
                            newStatus,
                          });
                          // select 값을 원래대로 복원 (확인 후 변경)
                          e.target.value = oldStatus;
                        } else {
                          // 확인이 필요 없는 경우 바로 변경
                          statusChangeMutation.mutate({ invitationId: invitation.id, newStatus });
                        }
                      }
                    }}
                    disabled={isPending || statusChangeMutation.isPending}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="pending">대기중</option>
                    <option value="accepted">수락</option>
                    <option value="declined">거절</option>
                  </select>
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-800">
                  {invitation.invited_at
                    ? new Date(invitation.invited_at).toLocaleDateString("ko-KR")
                    : "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-800">
                  {invitation.accepted_at
                    ? new Date(invitation.accepted_at).toLocaleDateString("ko-KR")
                    : invitation.declined_at
                    ? new Date(invitation.declined_at).toLocaleDateString("ko-KR")
                    : "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => handleDelete(invitation.id)}
                    disabled={isPending}
                    className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(newPage) => {
              onPageChange?.(newPage);
            }}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">페이지 크기:</label>
            <select
              value={pageSize.toString()}
              onChange={(e) => {
                const newPageSize = parseInt(e.target.value, 10);
                onPageSizeChange?.(newPageSize);
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      )}

      {/* 상태 변경 확인 다이얼로그 */}
      {statusChangeDialog && (
        <ConfirmDialog
          open={statusChangeDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setStatusChangeDialog(null);
            }
          }}
          title="초대 상태 변경 확인"
          description={(() => {
            const getStatusLabel = (status: string) => {
              switch (status) {
                case "pending": return "대기중";
                case "accepted": return "수락";
                case "declined": return "거절";
                default: return status;
              }
            };
            return `초대 상태를 "${getStatusLabel(statusChangeDialog.newStatus)}"로 변경하시겠습니까?`;
          })()}
          confirmLabel="변경"
          cancelLabel="취소"
          variant="default"
          isLoading={statusChangeMutation.isPending}
          onConfirm={() => {
            if (statusChangeDialog) {
              statusChangeMutation.mutate({
                invitationId: statusChangeDialog.invitationId,
                newStatus: statusChangeDialog.newStatus,
              });
              setStatusChangeDialog(null);
            }
          }}
        />
      )}
    </div>
  );
}

