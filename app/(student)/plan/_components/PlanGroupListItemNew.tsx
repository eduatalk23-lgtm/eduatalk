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
import { PlanGroupCard } from "../_shared/PlanCard";
import { StatusBadge } from "../_shared/StatusBadge";
import { PlanGroupDeleteDialog } from "./PlanGroupDeleteDialog";
import { PlanGroupActiveToggleDialog } from "./PlanGroupActiveToggleDialog";

type PlanGroupListItemProps = {
  group: PlanGroup;
  planCount: number;
  hasPlans: boolean;
  completedCount?: number;
  totalCount?: number;
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
  
  const isCampPlan = !!(group.plan_type === "camp" && group.camp_invitation_id);
  const canToggle = hasPlans && planCount > 0 && !isCompleted && !isCancelled;
  const canDelete = !isCampPlan;

  const handleToggleActiveClick = () => {
    if (!canToggle) {
      if (!hasPlans || planCount === 0) {
        toast.showInfo("플랜이 생성된 후 활성화할 수 있습니다.");
      } else {
        toast.showInfo("완료 또는 중단된 플랜 그룹은 활성화할 수 없습니다.");
      }
      return;
    }
    setToggleDialogOpen(true);
  };

  const handleToggleActiveConfirm = () => {
    const newStatus: PlanStatus = isActive ? "paused" : "active";
    const currentStatus = group.status as PlanStatus;
    
    if (!PlanStatusManager.canTransition(currentStatus, newStatus)) {
      if (currentStatus === "draft" || currentStatus === "saved") {
        if (newStatus !== "active") {
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

  // Prepare badges
  const badges = [];
  if (isCampPlan) {
    badges.push({ label: "캠프 프로그램", variant: "warning" as const });
  }
  if (hasPlans && planCount > 0) {
    badges.push({ label: "플랜 생성 완료", variant: "info" as const });
  }

  // Prepare metadata
  const metadata = [
    { 
      label: "목적", 
      value: group.plan_purpose ? planPurposeLabels[group.plan_purpose] || group.plan_purpose : "—" 
    },
    { 
      label: "스케줄러", 
      value: group.scheduler_type ? schedulerTypeLabels[group.scheduler_type] || group.scheduler_type : "—" 
    },
    {
      label: "기간",
      value: group.period_start && group.period_end
        ? `${new Date(group.period_start).toLocaleDateString("ko-KR", { 
            year: "numeric", month: "long", day: "numeric" 
          })} ~ ${new Date(group.period_end).toLocaleDateString("ko-KR", { 
            year: "numeric", month: "long", day: "numeric" 
          })}`
        : "—"
    },
  ];

  // Prepare actions
  const actions = (
    <>
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
          {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        </button>
      )}
      {canDelete ? (
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="플랜 그룹 삭제"
          title="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-300 cursor-not-allowed"
          aria-label="캠프 플랜은 삭제할 수 없습니다"
          title="캠프 플랜은 삭제할 수 없습니다"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </>
  );

  const shouldShowStatus = 
    group.status === "active" || 
    group.status === "paused" || 
    group.status === "completed" ||
    group.status === "cancelled";

  return (
    <>
      <li>
        <PlanGroupCard
          title={group.name || "플랜 그룹"}
          status={shouldShowStatus ? group.status : undefined}
          badges={badges}
          progress={hasPlans && totalCount > 0 ? { completed: completedCount, total: totalCount } : undefined}
          metadata={metadata}
          createdAt={group.created_at}
          actions={actions}
          isSelected={isSelected}
        >
          {/* Checkbox for selection */}
          {onToggleSelect && (
            <div className="flex items-center gap-2">
              {!isCampPlan ? (
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
              ) : (
                <div className="inline-flex items-center justify-center rounded-lg p-1 text-gray-300 cursor-not-allowed">
                  <Square className="h-5 w-5" />
                </div>
              )}
            </div>
          )}

          {/* Extra info if no progress */}
          {hasPlans && planCount > 0 && totalCount === 0 && (
            <p className="text-xs text-gray-500">{planCount}개 플랜</p>
          )}
        </PlanGroupCard>
      </li>

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
    </>
  );
}

