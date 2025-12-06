"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

type CompletionToastProps = {
  completedPlanId?: string | null;
  planTitle?: string | null;
};

export function CompletionToast({ completedPlanId, planTitle }: CompletionToastProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess } = useToast();
  const planId = completedPlanId || searchParams.get("completedPlanId");

  useEffect(() => {
    if (!planId) {
      return;
    }

    // URL에서 completedPlanId 제거
    const params = new URLSearchParams(searchParams.toString());
    params.delete("completedPlanId");
    const newSearch = params.toString();
    const newUrl = newSearch ? `/today?${newSearch}` : "/today";
    router.replace(newUrl, { scroll: false });

    // 토스트 표시
    const title = planTitle || "플랜";
    showSuccess(`${title} 플랜이 완료 처리되었습니다.`);
  }, [planId, planTitle, searchParams, router, showSuccess]);

  return null;
}

