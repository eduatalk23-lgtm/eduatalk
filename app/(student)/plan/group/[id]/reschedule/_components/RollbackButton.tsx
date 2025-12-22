/**
 * 롤백 버튼 컴포넌트
 * 
 * 재조정을 롤백할 수 있는 버튼과 다이얼로그를 제공합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { rollbackReschedule } from "@/lib/domains/plan";
import { validateRollback } from "@/lib/reschedule/rollbackValidator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { useToast } from "@/components/ui/ToastProvider";
import { RotateCcw } from "lucide-react";

type RollbackButtonProps = {
  rescheduleLogId: string;
  groupId: string;
};

export function RollbackButton({
  rescheduleLogId,
  groupId,
}: RollbackButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [canRollback, setCanRollback] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    checkRollbackStatus();
  }, [rescheduleLogId]);

  const checkRollbackStatus = async () => {
    setValidating(true);
    try {
      // TODO: Supabase 클라이언트를 서버에서 가져오는 방법 수정 필요
      // 현재는 클라이언트 컴포넌트이므로 API route를 통해 검증해야 할 수 있음
      // 일단 간단하게 서버 액션으로 검증하도록 수정
      const response = await fetch(
        `/api/reschedule/${rescheduleLogId}/validate-rollback`
      );
      if (response.ok) {
        const data = await response.json();
        setCanRollback(data.canRollback);
        setReason(data.reason || null);
      }
    } catch (error) {
      console.error("[RollbackButton] 롤백 상태 확인 실패:", error);
      setCanRollback(false);
      setReason("롤백 상태를 확인할 수 없습니다.");
    } finally {
      setValidating(false);
    }
  };

  const handleRollback = async () => {
    if (!confirmDialogOpen) {
      setConfirmDialogOpen(true);
      return;
    }

    setExecuting(true);
    try {
      const result = await rollbackReschedule(rescheduleLogId);
      if (result.success) {
        toast.showSuccess(
          `롤백이 완료되었습니다. (복원: ${result.restoredPlans}개, 취소: ${result.canceledPlans}개)`
        );
        router.refresh();
        router.push(`/plan/group/${groupId}`);
      } else {
        toast.showError(result.error || "롤백에 실패했습니다.");
      }
    } catch (error) {
      toast.showError(
        error instanceof Error ? error.message : "롤백에 실패했습니다."
      );
    } finally {
      setExecuting(false);
      setConfirmDialogOpen(false);
    }
  };

  if (validating) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-500"
      >
        <RotateCcw className="h-4 w-4 animate-spin" />
        확인 중...
      </button>
    );
  }

  if (!canRollback) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-gray-500">
        <RotateCcw className="h-4 w-4" />
        <span>롤백 불가</span>
        {reason && (
          <span className="pl-2 text-xs text-gray-400" title={reason}>
            (?) {reason}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setConfirmDialogOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <RotateCcw className="h-4 w-4" />
        롤백
      </button>

      {/* 확인 다이얼로그 */}
      {confirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-lg max-w-md w-full px-4">
            <h3 className="text-lg font-semibold text-gray-900">
              재조정 롤백 확인
            </h3>
            <p className="text-sm text-gray-600">
              정말로 이 재조정을 롤백하시겠습니까?
              <br />
              새로 생성된 플랜이 취소되고, 이전 플랜이 복원됩니다.
            </p>
            {reason && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs text-yellow-800">{reason}</p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialogOpen(false)}
                disabled={executing}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleRollback}
                disabled={executing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
              >
                {executing ? "롤백 중..." : "롤백 실행"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

