"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, CheckSquare, Square, Eye } from "lucide-react";
import { PlanGroup } from "@/lib/types/plan";
import { PlanStatus } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { updatePlanGroupStatus } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanGroupDeleteDialog } from "./PlanGroupDeleteDialog";
import { PlanGroupActiveToggleDialog } from "./PlanGroupActiveToggleDialog";
import { Badge } from "@/components/atoms/Badge";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  planPurposeLabels,
  schedulerTypeLabels,
} from "@/lib/constants/planLabels";

type PlanGroupListItemProps = {
  group: PlanGroup;
  planCount: number;
  hasPlans: boolean; // 플랜이 생성되었는지 여부
  completedCount?: number; // 완료된 플랜 개수
  totalCount?: number; // 전체 플랜 개수
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function PlanGroupListItem({
  group,
  planCount,
  hasPlans,
  completedCount = 0,
  totalCount = 0,
  isSelected = false,
  onToggleSelect,
}: PlanGroupListItemProps) {
  const router = useRouter();
  const toast = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isActive = group.status === "active";
  const isCompleted = group.status === "completed";

  // 캠프 플랜 여부 확인
  const isCampPlan = !!(group.plan_type === "camp" && group.camp_invitation_id);

  // 플랜이 생성되고, 완료 상태가 아닌 경우만 토글 가능
  const canToggle = hasPlans && planCount > 0 && !isCompleted;

  // 캠프 플랜은 삭제 불가 (제출 전까지는 수정 가능)
  const canDelete = !isCampPlan;

  const handleToggleActiveClick = () => {
    if (!canToggle) {
      if (!hasPlans || planCount === 0) {
        toast.showInfo("플랜이 생성된 후 활성화할 수 있습니다.");
      } else if (isCompleted) {
        toast.showInfo("완료된 플랜 그룹은 활성화할 수 없습니다.");
      }
      return;
    }

    // 확인 다이얼로그 열기
    setToggleDialogOpen(true);
  };

  const handleToggleActiveConfirm = () => {
    // 활성 상태면 일시정지로, 아니면 활성으로 변경
    const newStatus: PlanStatus = isActive ? "paused" : "active";

    // 상태 전이 가능 여부 확인
    const currentStatus = group.status as PlanStatus;
    if (!PlanStatusManager.canTransition(currentStatus, newStatus)) {
      // 저장됨이나 초안 상태에서 active로 직접 전이가 안 되는 경우
      if (currentStatus === "draft" || currentStatus === "saved") {
        // 저장됨이나 초안에서도 active로 전이 가능하도록 허용
        if (newStatus === "active") {
          // 허용
        } else {
          toast.showError("이 상태로 변경할 수 없습니다.");
          setToggleDialogOpen(false);
          return;
        }
      } else {
        toast.showError("이 상태로 변경할 수 없습니다.");
        setToggleDialogOpen(false);
        return;
      }
    }

    startTransition(async () => {
      try {
        await updatePlanGroupStatus(group.id, newStatus);
        toast.showSuccess(
          isActive
            ? "플랜 그룹이 비활성화되었습니다."
            : "플랜 그룹이 활성화되었습니다."
        );
        setToggleDialogOpen(false);
        router.refresh();
      } catch (error) {
        toast.showError(
          error instanceof Error ? error.message : "상태 변경에 실패했습니다."
        );
        setToggleDialogOpen(false);
      }
    });
  };

  // 상세보기 이동
  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/plan/group/${group.id}`, { scroll: true });
  };

  // 표시할 상태 결정 (완료 상태만)
  const displayStatus = isCompleted
    ? { label: "완료", variant: "success" as const }
    : null;

  return (
    <li
      className={cn(
        "group relative rounded-xl border bg-white dark:bg-gray-800 p-4 shadow-[var(--elevation-1)] transition-base",
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-[var(--elevation-4)] ring-2 ring-blue-200 dark:ring-blue-800"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-[var(--elevation-8)] hover:-translate-y-0.5"
      )}
    >
      <div className="flex flex-col gap-3">
        {/* 1줄: 체크박스 + 뱃지 (좌측) / 아이콘들 (우측) */}
        <div className="flex items-center justify-between gap-3">
          {/* 좌측: 체크박스 + 뱃지 */}
          <div className="flex items-center gap-2">
            {onToggleSelect && !isCampPlan && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleSelect();
                }}
                className="inline-flex items-center justify-center rounded-lg p-1 text-gray-700 dark:text-gray-300 transition-base hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 relative z-20"
                title={isSelected ? "선택 해제" : "선택"}
                aria-label={isSelected ? "선택 해제" : "선택"}
              >
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>
            )}
            {onToggleSelect && isCampPlan && (
              <div className="inline-flex items-center justify-center rounded-lg p-1 text-gray-300 cursor-not-allowed">
                <Square className="h-5 w-5" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* 캠프 플랜 뱃지 */}
              {isCampPlan && (
                <Badge variant="warning" size="sm">
                  캠프 프로그램
                </Badge>
              )}
              {/* 플랜 생성 완료 뱃지 */}
              {hasPlans && planCount > 0 && (
                <Badge variant="info" size="sm">
                  플랜 생성 완료
                </Badge>
              )}
            </div>
          </div>

          {/* 우측: 버튼들 */}
          <div className="flex shrink-0 items-center gap-3 relative z-20">
            {/* 보기 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewClick}
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>보기</span>
              </div>
            </Button>

            {/* 삭제 버튼 */}
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteDialogOpen(true);
                }}
                className="text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                <div className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  <span>삭제</span>
                </div>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="text-gray-300 dark:text-gray-600 cursor-not-allowed"
                title="캠프 플랜은 삭제할 수 없습니다"
              >
                <div className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  <span>삭제</span>
                </div>
              </Button>
            )}

            {/* 활성/비활성 토글 스위치 */}
            <div className="group relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleToggleActiveClick();
                }}
                disabled={isPending || !canToggle}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-50",
                  isActive ? "bg-green-600 dark:bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                )}
                aria-label={isActive ? "비활성화" : "활성화"}
                title={
                  !canToggle
                    ? "플랜이 생성된 후 활성화할 수 있습니다"
                    : isActive
                    ? "비활성화"
                    : "활성화"
                }
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    isActive ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              
              {/* 비활성화 상태일 때 툴팁 표시 */}
              {!canToggle && (
                <div className="pointer-events-none absolute bottom-full right-0 hidden w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-[var(--elevation-8)] transition-opacity group-hover:block group-hover:opacity-100 z-50" style={{ marginBottom: '0.5rem' }}>
                  <div className="whitespace-normal break-words">
                    {!hasPlans || planCount === 0
                      ? "플랜이 생성된 후 활성화할 수 있습니다"
                      : isCompleted
                      ? "완료된 플랜 그룹은 활성화할 수 없습니다"
                      : "활성화할 수 없습니다"}
                  </div>
                  {/* 툴팁 화살표 */}
                  <div className="absolute bottom-0 right-4 translate-y-full">
                    <div className="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 제목 영역: 제목 (좌측) + 상태 뱃지 (우측) */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
            {group.name || "플랜 그룹"}
          </h3>
          {/* 상태 뱃지 (완료 또는 활성 상태만 표시) */}
          {displayStatus && (
            <Badge variant={displayStatus.variant} size="sm">
              {displayStatus.label}
            </Badge>
          )}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex flex-col gap-3">

          <div className="flex flex-col gap-3">
            {/* 진행률 */}
            {hasPlans && planCount > 0 && totalCount > 0 && (
              <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-2.5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      진행률
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {completedCount}/{totalCount}개 완료
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar
                        value={Math.round((completedCount / totalCount) * 100)}
                        size="sm"
                        variant={
                          completedCount === totalCount
                            ? "success"
                            : completedCount > 0
                            ? "default"
                            : "warning"
                        }
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {Math.round((completedCount / totalCount) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 목적 */}
            <div className="break-words text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-800 dark:text-gray-300">목적: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {group.plan_purpose
                  ? planPurposeLabels[group.plan_purpose] || group.plan_purpose
                  : "—"}
              </span>
            </div>

            {/* 스케줄러 */}
            <div className="break-words text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-800 dark:text-gray-300">스케줄러: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {group.scheduler_type
                  ? schedulerTypeLabels[group.scheduler_type] ||
                    group.scheduler_type
                  : "—"}
              </span>
            </div>

            {/* 기간 */}
            <div className="break-words text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-800 dark:text-gray-300">기간: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {group.period_start && group.period_end
                  ? `${new Date(group.period_start).toLocaleDateString(
                      "ko-KR",
                      { year: "numeric", month: "long", day: "numeric" }
                    )} ~ ${new Date(group.period_end).toLocaleDateString(
                      "ko-KR",
                      { year: "numeric", month: "long", day: "numeric" }
                    )}`
                  : "—"}
              </span>
            </div>

            {/* 하단 메타 정보 */}
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
              <p className="text-xs text-gray-800 dark:text-gray-300">
                {group.created_at
                  ? new Date(group.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </p>
              {hasPlans && planCount > 0 && totalCount === 0 && (
                <span className="text-xs text-gray-800 dark:text-gray-300">
                  {planCount}개 플랜
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <PlanGroupDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        groupId={group.id}
        groupName={group.name}
        groupStatus={group.status as any}
        isCampPlan={isCampPlan}
      />

      <PlanGroupActiveToggleDialog
        open={toggleDialogOpen}
        onOpenChange={setToggleDialogOpen}
        groupName={group.name}
        isActive={isActive}
        onConfirm={handleToggleActiveConfirm}
        isPending={isPending}
      />
    </li>
  );
}
