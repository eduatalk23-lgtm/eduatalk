"use client";

import { useState, useEffect } from "react";
import { assignTenantToUser, assignTenantToMultipleUsers, getActiveTenants, type TenantlessUser } from "@/lib/domains/superadmin";
import { Dialog } from "@/components/ui/Dialog";
import { useServerAction } from "@/lib/hooks/useServerAction";
import { isErrorResponse } from "@/lib/types/actionResponse";

type AssignTenantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null; // null이면 일괄 할당 모드
  userType: "student" | "parent" | "admin" | null;
  selectedUserIds: string[] | null; // 일괄 할당 시 사용
  users: TenantlessUser[]; // 사용자 정보 조회용
  onComplete: () => void;
};

export function AssignTenantDialog({
  open,
  onOpenChange,
  userId,
  userType,
  selectedUserIds,
  users,
  onComplete,
}: AssignTenantDialogProps) {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 단일 사용자 할당 훅
  const singleAssignHook = useServerAction(assignTenantToUser, {
    onSuccess: () => {
      onComplete();
      onOpenChange(false);
      alert("테넌트가 할당되었습니다.");
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  // 다중 사용자 할당 훅
  const multipleAssignHook = useServerAction(assignTenantToMultipleUsers, {
    onSuccess: (data) => {
      onComplete();
      onOpenChange(false);
      alert(`${data?.assignedCount || 0}명의 사용자에 테넌트가 할당되었습니다.`);
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  const isPending = singleAssignHook.isPending || multipleAssignHook.isPending;

  // 다이얼로그가 열릴 때 테넌트 목록 로드
  useEffect(() => {
    if (open) {
      setLoadingTenants(true);
      setError(null);
      getActiveTenants()
        .then((result) => {
          if (result.success && result.data) {
            setTenants(result.data);
            const firstTenant = result.data[0];
            if (firstTenant?.id) {
              setSelectedTenantId(firstTenant.id);
            }
          } else if (isErrorResponse(result)) {
            setError(result.error || result.message || "테넌트 목록을 불러올 수 없습니다.");
          } else {
            setError("테넌트 목록을 불러올 수 없습니다.");
          }
        })
        .catch((err) => {
          console.error("[AssignTenantDialog] 테넌트 목록 로드 실패", err);
          setError("테넌트 목록을 불러오는 중 오류가 발생했습니다.");
        })
        .finally(() => {
          setLoadingTenants(false);
        });
    } else {
      // 다이얼로그가 닫힐 때 상태 초기화
      setSelectedTenantId("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!selectedTenantId) {
      setError("테넌트를 선택해주세요.");
      return;
    }

    setError(null);

    if (userId && userType) {
      // 단일 사용자 할당
      singleAssignHook.execute(userId, selectedTenantId, userType);
    } else if (selectedUserIds && selectedUserIds.length > 0) {
      // 다중 사용자 할당
      const userData = users
        .filter((u) => selectedUserIds.includes(u.id))
        .map((u) => ({ userId: u.id, userType: u.userType }));

      if (userData.length === 0) {
        setError("선택된 사용자 정보를 찾을 수 없습니다.");
        return;
      }

      multipleAssignHook.execute(userData, selectedTenantId);
    } else {
      setError("할당할 사용자가 없습니다.");
    }
  };

  const isBulkMode = !userId && selectedUserIds && selectedUserIds.length > 0;
  const targetUser = userId ? users.find((u) => u.id === userId) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isBulkMode ? "일괄 테넌트 할당" : "테넌트 할당"}
      description={
        isBulkMode
          ? `선택한 ${selectedUserIds?.length || 0}명의 사용자에 테넌트를 할당합니다.`
          : targetUser
          ? `${targetUser.email} (${targetUser.name || "이름 없음"}) 사용자에 테넌트를 할당합니다.`
          : "사용자에 테넌트를 할당합니다."
      }
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {loadingTenants ? (
          <div className="py-4 text-center text-sm text-gray-500">테넌트 목록을 불러오는 중...</div>
        ) : error && !tenants.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            등록된 테넌트가 없습니다. 먼저 테넌트를 생성해주세요.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">테넌트 선택</label>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                disabled={isPending}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            {(error || singleAssignHook.error || multipleAssignHook.error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error || singleAssignHook.error || multipleAssignHook.error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !selectedTenantId}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? "할당 중..." : "할당하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

