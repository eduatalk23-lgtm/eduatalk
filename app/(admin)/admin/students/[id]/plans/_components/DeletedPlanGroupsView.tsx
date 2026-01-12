"use client";

/**
 * 삭제된 플랜 그룹 목록 뷰 (관리자용)
 * 삭제된 플랜 그룹을 복원하거나 영구 삭제할 수 있습니다.
 */

import { useState, useEffect, useTransition, useCallback } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Trash2,
  Loader2,
  FolderArchive,
  Calendar,
  FileText,
} from "lucide-react";
import {
  getDeletedPlanGroupsAdmin,
  restorePlanGroupAdmin,
  permanentlyDeletePlanGroupBackup,
  type DeletedPlanGroupsResult,
} from "@/lib/domains/admin-plan/actions/deletedPlanGroups";
import type { DeletedPlanGroupInfo } from "@/lib/data/planGroups/types";

const PAGE_SIZE = 20;

interface DeletedPlanGroupsViewProps {
  studentId: string;
  onRefresh: () => void;
}

/**
 * 상대 시간 표시 (예: "3시간 전", "2일 전")
 */
function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

/**
 * 플랜 목적 레이블
 */
function getPlanPurposeLabel(purpose: string | null): string {
  const labels: Record<string, string> = {
    내신대비: "내신",
    모의고사: "모의",
    수능: "수능",
    기타: "기타",
  };
  return labels[purpose || ""] || purpose || "기타";
}

export function DeletedPlanGroupsView({ studentId, onRefresh }: DeletedPlanGroupsViewProps) {
  const [deletedGroups, setDeletedGroups] = useState<DeletedPlanGroupInfo[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showSuccess, showError } = useToast();

  // 삭제된 플랜 그룹 목록 초기 로드
  const loadDeletedGroups = useCallback(async () => {
    setIsLoading(true);
    const result = await getDeletedPlanGroupsAdmin(studentId, {
      offset: 0,
      limit: PAGE_SIZE,
    });
    if (result.success && result.data) {
      setDeletedGroups(result.data.planGroups);
      setHasMore(result.data.hasMore);
    }
    setIsLoading(false);
  }, [studentId]);

  // 더보기 로드
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const result = await getDeletedPlanGroupsAdmin(studentId, {
      offset: deletedGroups.length,
      limit: PAGE_SIZE,
    });
    if (result.success && result.data) {
      setDeletedGroups((prev) => [...prev, ...result.data!.planGroups]);
      setHasMore(result.data.hasMore);
    }
    setIsLoadingMore(false);
  }, [studentId, deletedGroups.length, isLoadingMore, hasMore]);

  useEffect(() => {
    loadDeletedGroups();
  }, [loadDeletedGroups]);

  const handleToggleSelect = (backupId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(backupId)) {
        next.delete(backupId);
      } else {
        next.add(backupId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === deletedGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletedGroups.map((g) => g.id)));
    }
  };

  const handleRestore = () => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const backupId of selectedIds) {
        const result = await restorePlanGroupAdmin(backupId, studentId);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        showSuccess(`${successCount}개 플랜 그룹이 복원되었습니다.`);
        setSelectedIds(new Set());
        await loadDeletedGroups();
        onRefresh();
      }
      if (failCount > 0) {
        showError(`${failCount}개 복원 실패`);
      }
    });
  };

  const handlePermanentDelete = () => {
    if (selectedIds.size === 0 || !confirmPermanentDelete) return;

    startTransition(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const backupId of selectedIds) {
        const result = await permanentlyDeletePlanGroupBackup(backupId, studentId);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        showSuccess(`${successCount}개 백업이 영구 삭제되었습니다.`);
        setSelectedIds(new Set());
        setConfirmPermanentDelete(false);
        await loadDeletedGroups();
      }
      if (failCount > 0) {
        showError(`${failCount}개 삭제 실패`);
      }
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    return `${startMonth}/${startDay} ~ ${endMonth}/${endDay}`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // 삭제된 플랜 그룹이 없으면 표시하지 않음
  if (!isLoading && deletedGroups.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-amber-200 rounded w-1/3" />
          <div className="h-12 bg-amber-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-amber-50 rounded-lg border border-amber-200 overflow-hidden",
        isPending && "opacity-50 pointer-events-none"
      )}
    >
      {/* 헤더 - 클릭하여 접기/펼치기 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-amber-200 bg-amber-100 hover:bg-amber-150 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-amber-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-600" />
          )}
          <FolderArchive className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-amber-800">삭제된 플랜 그룹</span>
          <span className="text-sm text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
            {deletedGroups.length}
          </span>
        </div>
        <span className="text-xs text-amber-600">
          {isExpanded ? "접기" : "펼쳐서 복원하기"}
        </span>
      </button>

      {/* 펼쳐진 경우에만 내용 표시 */}
      {isExpanded && (
        <>
          {/* 액션 버튼 */}
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-200 rounded"
              >
                {selectedIds.size === deletedGroups.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    복원 ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setConfirmPermanentDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    영구 삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 플랜 그룹 목록 */}
          <div className="p-4">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {deletedGroups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    "flex items-center gap-3 bg-white rounded-lg p-3 border transition-colors cursor-pointer",
                    selectedIds.has(group.id)
                      ? "border-green-400 bg-green-50"
                      : "border-amber-200 hover:border-amber-300"
                  )}
                  onClick={() => handleToggleSelect(group.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(group.id)}
                    onChange={() => handleToggleSelect(group.id)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate text-gray-700">
                        {group.name || "이름 없음"}
                      </span>
                      {group.planPurpose && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {getPlanPurposeLabel(group.planPurpose)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateRange(group.periodStart, group.periodEnd)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        플랜 {group.planCount}개
                      </span>
                      {group.contentCount > 0 && (
                        <span className="text-xs text-gray-400">
                          콘텐츠 {group.contentCount}개
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 text-right">
                    <div className="text-amber-600 font-medium">
                      {getRelativeTime(group.deletedAt)}
                    </div>
                    <div>{formatDateTime(group.deletedAt)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 더보기 버튼 */}
            {hasMore && (
              <div className="mt-3 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-4 py-2 text-sm text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    "더보기"
                  )}
                </button>
              </div>
            )}

            {/* 안내 문구 */}
            <p className="mt-3 text-xs text-amber-600 text-center">
              삭제된 플랜 그룹은 복원 시 모든 플랜이 함께 복원됩니다.
            </p>
          </div>
        </>
      )}

      {/* 영구 삭제 확인 모달 */}
      {confirmPermanentDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-red-700 mb-2">영구 삭제 확인</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{selectedIds.size}개</strong>의 플랜 그룹 백업을 영구 삭제하시겠습니까?
              <br />
              <span className="text-red-600">
                이 작업은 되돌릴 수 없으며, 복원이 불가능해집니다.
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPermanentDelete(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                취소
              </button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
