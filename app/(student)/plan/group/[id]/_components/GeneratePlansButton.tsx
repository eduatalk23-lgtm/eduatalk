"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getPlansByGroupIdAction } from "@/app/(student)/actions/planGroupActions";
import { PlanStatus } from "@/lib/types/plan";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

// 큰 모달 컴포넌트는 동적 import로 코드 스플리팅
const PlanPreviewDialog = dynamic(
  () => import("./PlanPreviewDialog").then((mod) => ({ default: mod.PlanPreviewDialog })),
  {
    loading: () => <LoadingSkeleton />,
    ssr: false,
  }
);

type GeneratePlansButtonProps = {
  groupId: string;
  currentStatus: PlanStatus;
  onPlansGenerated?: () => void;
};

export function GeneratePlansButton({
  groupId,
  currentStatus,
  onPlansGenerated,
}: GeneratePlansButtonProps) {
  const router = useRouter();
  const [hasPlans, setHasPlans] = useState<boolean | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canGenerate = currentStatus === "saved" || currentStatus === "active";

  // 플랜이 이미 생성되었는지 확인
  useEffect(() => {
    const checkPlans = async () => {
      try {
        const result = await getPlansByGroupIdAction(groupId);
        setHasPlans(result.plans.length > 0);
      } catch (error) {
        console.error("플랜 확인 실패:", error);
        setHasPlans(false);
      }
    };

    if (canGenerate) {
      checkPlans();
    }
  }, [groupId, canGenerate]);

  const handlePreviewClick = () => {
    if (!canGenerate) {
      alert("플랜 그룹이 저장되거나 활성화된 상태에서만 플랜을 미리볼 수 있습니다.");
      return;
    }
    setPreviewOpen(true);
  };

  const handlePlansGenerated = () => {
    // 실제 플랜 생성이 완료된 경우에만 호출됨 (미리보기에서는 호출되지 않음)
    setHasPlans(true);
    router.refresh();
    onPlansGenerated?.();
  };

  if (!canGenerate) {
    return null;
  }

  const isDisabled = hasPlans === true;

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handlePreviewClick}
          disabled={isDisabled}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
        >
          플랜 미리보기 및 생성
        </button>
        {hasPlans && (
          <p className="text-sm text-gray-800">
            플랜이 이미 생성되었습니다. 새로운 플랜을 만들려면 플랜 그룹을 복사하여 수정하세요.
          </p>
        )}
      </div>
      <PlanPreviewDialog
        groupId={groupId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onPlansGenerated={handlePlansGenerated}
      />
    </>
  );
}

