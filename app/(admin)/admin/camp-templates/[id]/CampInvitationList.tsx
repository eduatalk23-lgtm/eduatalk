"use client";

import { useState, useTransition } from "react";
import { CampInvitation } from "@/lib/types/plan";
import { deleteCampInvitationAction, deleteCampInvitationsAction, resendCampInvitationsAction, updateCampInvitationStatusAction } from "@/app/(admin)/actions/campTemplateActions";
import { useToast } from "@/components/ui/ToastProvider";
import { Pagination } from "@/components/organisms/Pagination";

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
}: CampInvitationListProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Optimistic update를 위한 상태 관리
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, string>>(new Map());
  
  const totalPages = total ? Math.ceil(total / pageSize) : 0;
  
  // Optimistic update가 적용된 초대 목록 생성
  const invitationsWithOptimistic = invitations.map((inv) => {
    const optimisticStatus = optimisticUpdates.get(inv.id);
    if (optimisticStatus) {
      return { ...inv, status: optimisticStatus as "pending" | "accepted" | "declined" };
    }
    return inv;
  });
  
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
        toast.showError("초대 삭제에 실패했습니다.");
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

  return (
    <div className="flex flex-col gap-4">
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
                        
                        const getStatusLabel = (status: string) => {
                          switch (status) {
                            case "pending": return "대기중";
                            case "accepted": return "수락";
                            case "declined": return "거절";
                            default: return status;
                          }
                        };
                        
                        if (requiresConfirmation) {
                          const confirmed = confirm(
                            `초대 상태를 "${getStatusLabel(newStatus)}"로 변경하시겠습니까?`
                          );
                          if (!confirmed) {
                            // 확인 취소 시 select 값을 원래대로 복원
                            e.target.value = oldStatus;
                            return;
                          }
                        }
                        
                        // Optimistic update
                        setOptimisticUpdates((prev) => new Map(prev).set(invitation.id, newStatus));
                        
                        startTransition(async () => {
                          try {
                            const result = await updateCampInvitationStatusAction(invitation.id, newStatus);
                            if (!result.success) {
                              // 롤백
                              setOptimisticUpdates((prev) => {
                                const next = new Map(prev);
                                next.delete(invitation.id);
                                return next;
                              });
                              toast.showError(result.error || "초대 상태 변경에 실패했습니다.");
                              // 실패 시 select 값을 원래대로 복원
                              e.target.value = oldStatus;
                            } else {
                              // 성공 시 optimistic update 제거 및 새로고침
                              setOptimisticUpdates((prev) => {
                                const next = new Map(prev);
                                next.delete(invitation.id);
                                return next;
                              });
                              toast.showSuccess("초대 상태가 변경되었습니다.");
                              onRefresh?.();
                            }
                          } catch (error) {
                            // 롤백
                            setOptimisticUpdates((prev) => {
                              const next = new Map(prev);
                              next.delete(invitation.id);
                              return next;
                            });
                            console.error("초대 상태 변경 실패:", error);
                            toast.showError("초대 상태 변경에 실패했습니다.");
                            // 실패 시 select 값을 원래대로 복원
                            e.target.value = oldStatus;
                          }
                        });
                      }
                    }}
                    disabled={isPending}
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
    </div>
  );
}

