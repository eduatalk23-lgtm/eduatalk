"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Trash2, RefreshCw, Plus, Zap } from "lucide-react";
import { PlanStatus } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { deletePlanGroupAction, copyPlanGroupAction } from "@/lib/domains/plan";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanGroupDeleteDialog } from "@/app/(student)/plan/_components/PlanGroupDeleteDialog";
import { QuickAddPlanModal } from "@/app/(student)/plan/calendar/_components/QuickAddPlanModal";

type PlanGroupActionButtonsProps = {
  groupId: string;
  groupName: string | null;
  groupStatus: PlanStatus;
  canEdit: boolean;
  canDelete: boolean;
  /** 캘린더 전용 모드 (콘텐츠 없이 생성된 플랜 그룹) */
  isCalendarOnly?: boolean;
  /** 현재 콘텐츠 개수 */
  contentCount?: number;
  /** 학생 ID (빠른 플랜 추가용) */
  studentId?: string;
  /** 테넌트 ID (빠른 플랜 추가용) */
  tenantId?: string | null;
};

export function PlanGroupActionButtons({
  groupId,
  groupName,
  groupStatus,
  canEdit,
  canDelete,
  isCalendarOnly = false,
  contentCount = 0,
  studentId,
  tenantId,
}: PlanGroupActionButtonsProps) {
  const router = useRouter();
  const toast = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // 콘텐츠 추가 버튼 표시 여부
  // 최대 10개까지 추가 가능
  const MAX_CONTENTS = 10;
  const showAddContent = contentCount < MAX_CONTENTS;

  // 오늘 날짜
  const today = new Date().toISOString().split("T")[0];

  const handleCopy = () => {
    if (
      !confirm(
        "플랜 그룹을 복사하시겠습니까? 복사된 플랜 그룹은 초안 상태로 생성되며, 플랜은 복사되지 않습니다."
      )
    ) {
      return;
    }

    setCopyPending(true);
    startTransition(async () => {
      try {
        const result = await copyPlanGroupAction(groupId);
        toast.showSuccess("플랜 그룹이 복사되었습니다.");
        router.push(`/plan/group/${result.groupId}/edit`, { scroll: true });
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "플랜 그룹 복사에 실패했습니다."
        );
        setCopyPending(false);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 빠른 플랜 추가 버튼 */}
        {studentId && canEdit && (
          <button
            type="button"
            onClick={() => setShowQuickAddModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
            title="빠른 플랜 추가"
            aria-label="빠른 플랜 추가"
          >
            <Zap className="h-4 w-4" />
            빠른 추가
          </button>
        )}

        {/* 콘텐츠 추가 버튼 (캘린더 전용 모드 또는 콘텐츠 없는 경우) */}
        {showAddContent && canEdit && (
          <Link
            href={`/plan/group/${groupId}/add-content`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            title="콘텐츠 추가"
            aria-label="플랜에 콘텐츠 추가"
          >
            <Plus className="h-4 w-4" />
            콘텐츠 추가
          </Link>
        )}

        {canEdit && (
          <>
            <Link
              href={`/plan/group/${groupId}/reschedule`}
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
              title="재조정"
              aria-label="플랜 그룹 재조정"
            >
              <RefreshCw className="h-4 w-4" />
            </Link>
            <Link
              href={`/plan/group/${groupId}/edit`}
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
              title="수정"
              aria-label="플랜 그룹 수정"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={handleCopy}
          disabled={copyPending || isPending}
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          title="복사하기"
          aria-label="플랜 그룹 복사하기"
        >
          <Copy className="h-4 w-4" />
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-700 transition hover:bg-red-50 hover:text-red-600"
            title="삭제"
            aria-label="플랜 그룹 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <PlanGroupDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        groupId={groupId}
        groupName={groupName}
        groupStatus={groupStatus}
      />

      {/* 빠른 플랜 추가 모달 */}
      {studentId && (
        <QuickAddPlanModal
          open={showQuickAddModal}
          onOpenChange={setShowQuickAddModal}
          date={today}
          studentId={studentId}
          tenantId={tenantId ?? null}
          onSuccess={() => {
            setShowQuickAddModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

