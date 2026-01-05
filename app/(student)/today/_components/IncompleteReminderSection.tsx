"use client";

import { usePlanReminder } from "@/lib/hooks/usePlanReminder";
import { IncompleteReminder } from "./IncompleteReminder";

interface IncompleteReminderSectionProps {
  studentId: string;
  className?: string;
}

/**
 * 미완료 플랜 리마인더 섹션
 *
 * Today 페이지에서 미완료 플랜 정보를 표시합니다.
 */
export function IncompleteReminderSection({
  studentId,
  className,
}: IncompleteReminderSectionProps) {
  const {
    todayIncomplete,
    delayedPlans,
    weeklySummary,
    isLoading,
    shouldShowBanner,
    dismissBanner,
  } = usePlanReminder({
    studentId,
    autoRefresh: false, // 페이지 로드 시에만 체크
  });

  // 로딩 중이거나 배너를 표시하지 않아야 하면 렌더링하지 않음
  if (isLoading || !shouldShowBanner) {
    return null;
  }

  return (
    <IncompleteReminder
      todayIncomplete={todayIncomplete}
      delayedPlans={delayedPlans}
      weeklySummary={weeklySummary}
      onDismiss={dismissBanner}
      className={className}
    />
  );
}
