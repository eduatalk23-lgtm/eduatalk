"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import {
  declineCampInvitation,
  cancelCampParticipation,
  editCampParticipation,
} from "@/lib/domains/camp";
import { useToast } from "@/components/ui/ToastProvider";
import {
  handleCampError,
  isNetworkError,
} from "@/lib/domains/camp/errors";

type CampActionDialogsProps = {
  invitationId: string;
  invitationStatus: string;
  planGroupStatus: string | null;
  hasPlans: boolean;
  templateName?: string;
};

export function CampActionDialogs({
  invitationId,
  invitationStatus,
  planGroupStatus,
  hasPlans,
  templateName,
}: CampActionDialogsProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  // 거절 다이얼로그 상태
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // 취소 다이얼로그 상태
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 초대 거절 가능 여부
  const canDecline = invitationStatus === "pending";

  // 참여 취소 가능 여부 (accepted 상태이고, 플랜이 활성화되지 않은 경우)
  const canCancel =
    invitationStatus === "accepted" &&
    planGroupStatus !== "active" &&
    planGroupStatus !== "paused";

  // 참여 정보 수정 가능 여부 (accepted 상태이고, 플랜이 생성되지 않은 경우)
  const canEdit =
    invitationStatus === "accepted" &&
    !hasPlans &&
    planGroupStatus !== "active" &&
    planGroupStatus !== "paused";

  const handleDecline = () => {
    startTransition(async () => {
      try {
        const result = await declineCampInvitation(
          invitationId,
          declineReason || undefined
        );
        if (result.success) {
          showSuccess("초대를 거절했습니다.");
          setDeclineDialogOpen(false);
          setDeclineReason("");
          router.refresh();
        } else {
          handleCampError(result, {
            context: "초대 거절",
            showError,
            onRefresh: () => router.refresh(),
          });
        }
      } catch (error) {
        handleCampError(error, {
          context: "초대 거절",
          defaultMessage: "초대 거절에 실패했습니다.",
          showError,
          onRefresh: () => router.refresh(),
        });
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      try {
        const result = await cancelCampParticipation(
          invitationId,
          cancelReason || undefined
        );
        if (result.success) {
          showSuccess("참여를 취소했습니다.");
          setCancelDialogOpen(false);
          setCancelReason("");
          router.refresh();
        } else {
          handleCampError(result, {
            context: "참여 취소",
            showError,
            onRefresh: () => router.refresh(),
          });
        }
      } catch (error) {
        handleCampError(error, {
          context: "참여 취소",
          defaultMessage: "참여 취소에 실패했습니다.",
          showError,
          onRefresh: () => router.refresh(),
        });
      }
    });
  };

  const handleEdit = () => {
    startTransition(async () => {
      try {
        const result = await editCampParticipation(invitationId);
        if (result.success && result.canEdit && result.redirectUrl) {
          showSuccess("수정 모드로 전환되었습니다.");
          setEditDialogOpen(false);
          router.push(result.redirectUrl);
        } else {
          handleCampError(result, {
            context: "수정 모드 전환",
            showError,
            onRefresh: () => router.refresh(),
          });
        }
      } catch (error) {
        handleCampError(error, {
          context: "수정 모드 전환",
          defaultMessage: "수정 모드 전환에 실패했습니다.",
          showError,
          onRefresh: () => router.refresh(),
        });
      }
    });
  };

  return (
    <>
      {/* 액션 버튼들 */}
      <div className="flex flex-wrap items-center gap-2">
        {canDecline && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeclineDialogOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            거절하기
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditDialogOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            정보 수정
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCancelDialogOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            참여 취소
          </button>
        )}
      </div>

      {/* 거절 확인 다이얼로그 */}
      <Dialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        title="캠프 초대 거절"
        description={`${templateName || "캠프"} 초대를 거절하시겠습니까?`}
        variant="destructive"
        maxWidth="md"
      >
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-gray-700">
            초대를 거절하면 이 캠프에 참여할 수 없게 됩니다.
            필요한 경우 관리자에게 재초대를 요청할 수 있습니다.
          </p>
          <div>
            <label
              htmlFor="declineReason"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              거절 사유 (선택)
            </label>
            <textarea
              id="declineReason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="거절 사유를 입력해주세요..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setDeclineDialogOpen(false)}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={isPending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "거절하기"}
          </button>
        </DialogFooter>
      </Dialog>

      {/* 취소 확인 다이얼로그 */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="캠프 참여 취소"
        description={`${templateName || "캠프"} 참여를 취소하시겠습니까?`}
        variant="destructive"
        maxWidth="md"
      >
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-gray-700">
            참여를 취소하면 제출한 정보와 생성된 플랜 그룹이 삭제됩니다.
            다시 참여하려면 관리자에게 재초대를 요청해야 합니다.
          </p>
          <div>
            <label
              htmlFor="cancelReason"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              취소 사유 (선택)
            </label>
            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="취소 사유를 입력해주세요..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setCancelDialogOpen(false)}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "참여 취소"}
          </button>
        </DialogFooter>
      </Dialog>

      {/* 수정 확인 다이얼로그 */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="참여 정보 수정"
        description="제출한 참여 정보를 수정하시겠습니까?"
        maxWidth="md"
      >
        <div className="py-4">
          <p className="text-sm text-gray-700">
            수정 모드로 전환하면 이전에 제출한 정보를 수정할 수 있습니다.
            수정 후 다시 제출해야 합니다.
          </p>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setEditDialogOpen(false)}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleEdit}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "전환 중..." : "수정하기"}
          </button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
