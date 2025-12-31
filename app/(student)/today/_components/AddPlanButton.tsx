"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EnhancedAddPlanModal } from "./EnhancedAddPlanModal";
import { useQueryClient } from "@tanstack/react-query";

type AddPlanButtonProps = {
  studentId: string;
  tenantId: string | null;
  planGroupId: string | null; // 캘린더 아키텍처 필수
  defaultDate?: string;
};

export function AddPlanButton({
  studentId,
  tenantId,
  planGroupId,
  defaultDate,
}: AddPlanButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Refresh today plans and container plans
    queryClient.invalidateQueries({ queryKey: ["todayPlans"] });
    queryClient.invalidateQueries({ queryKey: ["containerPlans"] });
  };

  // tenantId와 planGroupId가 모두 있어야 플랜 추가 가능
  if (!tenantId || !planGroupId) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Plus className="h-4 w-4" />
        <span>플랜 추가</span>
      </button>

      {isModalOpen && (
        <EnhancedAddPlanModal
          studentId={studentId}
          tenantId={tenantId}
          planGroupId={planGroupId}
          defaultDate={defaultDate}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
