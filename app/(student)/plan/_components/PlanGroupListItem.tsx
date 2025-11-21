"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Eye, Power, PowerOff, CheckSquare, Square } from "lucide-react";
import { PlanGroup } from "@/lib/types/plan";
import { PlanStatus } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { updatePlanGroupStatus } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanGroupDeleteDialog } from "./PlanGroupDeleteDialog";
import { PlanGroupActiveToggleDialog } from "./PlanGroupActiveToggleDialog";

type PlanGroupListItemProps = {
  group: PlanGroup;
  planCount: number;
  hasPlans: boolean; // 플랜이 생성되었는지 여부
  completedCount?: number; // 완료된 플랜 개수
  totalCount?: number; // 전체 플랜 개수
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

const planPurposeLabels: Record<string, string> = {
  내신대비: "내신대비",
  모의고사: "모의고사",
  수능: "수능",
  기타: "기타",
};

const schedulerTypeLabels: Record<string, string> = {
  성적기반: "성적 기반",
  "1730_timetable": "1730 Timetable",
  전략취약과목: "전략/취약과목",
  커스텀: "커스텀",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  cancelled: "중단", // 기존 데이터 호환성을 위해 유지 (새로는 paused 사용)
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
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
  const isCancelled = group.status === "cancelled";
  
  // 플랜이 생성되고, 완료/중단 상태가 아닌 경우만 토글 가능
  const canToggle = hasPlans && planCount > 0 && !isCompleted && !isCancelled;

  const handleToggleActiveClick = () => {
    if (!canToggle) {
      if (!hasPlans || planCount === 0) {
        toast.showInfo("플랜이 생성된 후 활성화할 수 있습니다.");
      } else {
        toast.showInfo("완료 또는 중단된 플랜 그룹은 활성화할 수 없습니다.");
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
            ? "플랜 그룹이 일시정지되었습니다." 
            : "플랜 그룹이 활성화되었습니다."
        );
        setToggleDialogOpen(false);
        router.refresh();
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "상태 변경에 실패했습니다."
        );
        setToggleDialogOpen(false);
      }
    });
  };

  // 표시할 상태 뱃지 결정 (저장됨, 초안 제외)
  const getDisplayStatus = () => {
    // 완료 상태는 우선 표시 (page.tsx에서 계산된 상태)
    if (group.status === "completed") {
      return { label: "완료", color: statusColors.completed };
    }
    
    // 활성/일시정지/중단 상태만 표시 (저장됨, 초안 제외)
    if (statusLabels[group.status]) {
      return { label: statusLabels[group.status], color: statusColors[group.status] };
    }
    
    // 저장됨(draft, saved) 상태는 뱃지 표시 안 함
    return null;
  };

  const displayStatus = getDisplayStatus();

  return (
    <li className={`group relative rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 ${
      isSelected 
        ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200" 
        : "border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5"
    }`}>
      {/* 1줄: 체크박스 + 뱃지 (좌측) / 아이콘들 (우측) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* 좌측: 체크박스 + 뱃지 */}
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <button
              type="button"
              onClick={onToggleSelect}
              className="inline-flex items-center justify-center rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 플랜 생성 완료 뱃지 */}
            {hasPlans && planCount > 0 && (
              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                플랜 생성 완료
              </span>
            )}
            {/* 상태 뱃지 */}
            {displayStatus && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${displayStatus.color}`}>
                {displayStatus.label}
              </span>
            )}
          </div>
        </div>

        {/* 우측: 아이콘 버튼들 */}
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/plan/group/${group.id}`}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="플랜 그룹 상세 보기"
            title="상세 보기"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {canToggle && (
            <button
              type="button"
              onClick={handleToggleActiveClick}
              disabled={isPending}
              className={`inline-flex items-center justify-center rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive
                  ? "text-green-600 hover:bg-green-50"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
              aria-label={isActive ? "플랜 그룹 비활성화" : "플랜 그룹 활성화"}
              title={isActive ? "비활성화" : "활성화"}
            >
              {isActive ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            aria-label="플랜 그룹 삭제"
            title="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 제목 */}
      <h3 className="mb-3 break-words text-base font-semibold text-gray-900">
        {group.name || "플랜 그룹"}
      </h3>

      <div className="flex flex-col gap-3">
        {/* 진행률 */}
        {hasPlans && planCount > 0 && totalCount > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-600">진행률</span>
              <span className="text-xs font-semibold text-gray-900">
                {completedCount}/{totalCount}개 완료
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    completedCount === totalCount
                      ? "bg-green-600"
                      : completedCount > 0
                      ? "bg-blue-600"
                      : "bg-gray-300"
                  }`}
                  style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">
                {Math.round((completedCount / totalCount) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* 목적 */}
        <div className="break-words text-sm text-gray-600">
          <span className="text-gray-500">목적: </span>
          <span className="font-medium text-gray-900">
            {group.plan_purpose
              ? planPurposeLabels[group.plan_purpose] || group.plan_purpose
              : "—"}
          </span>
        </div>

        {/* 스케줄러 */}
        <div className="break-words text-sm text-gray-600">
          <span className="text-gray-500">스케줄러: </span>
          <span className="font-medium text-gray-900">
            {group.scheduler_type
              ? schedulerTypeLabels[group.scheduler_type] || group.scheduler_type
              : "—"}
          </span>
        </div>

        {/* 기간 */}
        <div className="break-words text-sm text-gray-600">
          <span className="text-gray-500">기간: </span>
          <span className="font-medium text-gray-900">
            {group.period_start && group.period_end
              ? `${new Date(group.period_start).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} ~ ${new Date(group.period_end).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}`
              : "—"}
          </span>
        </div>

        {/* 하단 메타 정보 */}
        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">
            {group.created_at
              ? new Date(group.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
              : "—"}
          </p>
          {hasPlans && planCount > 0 && totalCount === 0 && (
            <span className="text-xs text-gray-500">
              {planCount}개 플랜
            </span>
          )}
        </div>
      </div>

      <PlanGroupDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        groupId={group.id}
        groupName={group.name}
        groupStatus={group.status as any}
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

