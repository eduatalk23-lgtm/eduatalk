"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

type CompletionToastProps = {
  completedPlanId?: string | null;
  planTitle?: string | null;
};

export function CompletionToast({ completedPlanId, planTitle }: CompletionToastProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { showSuccess } = useToast();
  const planId = completedPlanId || searchParams.get("completedPlanId");
  const handledRef = useRef(false);

  useEffect(() => {
    if (!planId) {
      return;
    }

    if (handledRef.current) {
      return;
    }

    handledRef.current = true;

    // 현재 경로 기준으로 캠프 모드 여부 판단
    const isCampMode = pathname?.startsWith("/camp/today");
    const basePath = isCampMode ? "/camp/today" : "/today";

    // URL에서 completedPlanId 제거
    const params = new URLSearchParams(searchParams.toString());
    params.delete("completedPlanId");
    const newSearch = params.toString();
    const newUrl = newSearch ? `${basePath}?${newSearch}` : basePath;
    router.replace(newUrl, { scroll: false });

    // 토스트 표시
    const title = planTitle || "플랜";
    showSuccess(`${title} 플랜이 완료 처리되었습니다.`);
  }, [planId, planTitle, pathname, router, showSuccess]);

  return null;
}

