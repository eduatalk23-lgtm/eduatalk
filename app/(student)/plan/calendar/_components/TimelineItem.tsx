"use client";

import type { PlanWithContent } from "../_types/plan";
import type { AcademySchedule } from "@/lib/types/plan";
import { getTimeSlotColorClass, getTimeSlotIcon } from "../_utils/timelineUtils";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { 
  bgSurface, 
  textPrimary, 
  textTertiary,
  textMuted,
  getSemiTransparentBgClasses,
  borderInput,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type TimelineSlot = {
  start: string;
  end: string;
  type: string;
  label?: string;
  plans?: PlanWithContent[];
  academy?: AcademySchedule;
};

type TimelineItemProps = {
  slot: TimelineSlot;
  isLast?: boolean;
  connectedPlanIds?: Set<string>;
};

export function TimelineItem({ slot, isLast = false, connectedPlanIds }: TimelineItemProps) {
  const colorClass = getTimeSlotColorClass(slot.type as "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습");
  const IconComponent = getTimeSlotIcon(slot.type as "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습");

  // 시간에서 시(hour)만 추출 (예: "10:00" -> "10시")
  const startHour = slot.start.split(":")[0];
  const endHour = slot.end.split(":")[0];

  return (
    <div className="relative flex gap-4">
      {/* 시간대 라인 */}
      <div className="flex flex-col items-center gap-2">
        <div className={cn("rounded-lg px-4 py-2 text-base font-bold shadow-[var(--elevation-4)] border-2", borderInput, bgSurface, textPrimary)}>
          {startHour}시
        </div>
        {!isLast && (
          <div className="h-full min-h-[60px] w-1 bg-gradient-to-b from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700"></div>
        )}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 pb-4">
        <div className={cn("flex flex-col gap-4 rounded-lg border-2 p-5 transition-base hover:scale-[1.01] hover:shadow-[var(--elevation-8)]", colorClass)}>
          {/* 타입 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconComponent className="w-6 h-6" />
              {(slot.type === "학습시간" || slot.type === "학원일정") && (
                <span className={cn("text-lg font-bold", textPrimary)}>
                  {slot.start} ~ {slot.end}
                </span>
              )}
            </div>
            <span className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold shadow-[var(--elevation-1)]",
              slot.type === "학습시간"
                ? "bg-blue-500 text-white"
                : slot.type === "학원일정"
                ? "bg-purple-500 text-white"
                : slot.type === "자율학습"
                ? "bg-green-500 text-white"
                : slot.type === "이동시간"
                ? "bg-teal-500 text-white"
                : "bg-orange-500 text-white"
            )}>
              {slot.type}
            </span>
          </div>

          {/* 학원일정 표시 */}
          {slot.type === "학원일정" && slot.academy && (
            <div className={cn("flex flex-col gap-1 rounded-lg p-3", getSemiTransparentBgClasses("surface"))}>
              <div className={cn("font-medium", textPrimary)}>
                {slot.academy.academy_name || "학원"}
              </div>
              {slot.academy.subject && (
                <div className={cn("text-sm", textTertiary)}>
                  {slot.academy.subject}
                </div>
              )}
            </div>
          )}

          {/* 플랜 목록 */}
          {slot.type === "학습시간" && slot.plans && slot.plans.length > 0 && (
            <div className="flex flex-col gap-3">
              {slot.plans
                .sort((a, b) => {
                  // 시간 순서대로 정렬 (시간이 있으면 시간 순, 없으면 block_index 순)
                  if (a.start_time && b.start_time) {
                    const aTime = parseInt(a.start_time.replace(":", ""));
                    const bTime = parseInt(b.start_time.replace(":", ""));
                    return aTime - bTime;
                  }
                  return (a.block_index || 0) - (b.block_index || 0);
                })
                .map((plan) => (
                  <CalendarPlanCard
                    key={plan.id}
                    plan={plan}
                    compact={false}
                    showTime={true}
                    showProgress={true}
                    isConnected={connectedPlanIds?.has(plan.id) || false}
                  />
                ))}
            </div>
          )}

          {/* 플랜이 없는 학습시간 */}
          {slot.type === "학습시간" && (!slot.plans || slot.plans.length === 0) && (
            <div className={cn("rounded-lg p-3 text-center text-sm", getSemiTransparentBgClasses("surface"), textMuted)}>
              플랜 없음
            </div>
          )}

          {/* 특수 타임슬롯 (점심시간, 이동시간, 자율학습 등) */}
          {slot.type !== "학습시간" && slot.type !== "학원일정" && (
            <div className={cn("rounded-lg p-3", getSemiTransparentBgClasses("surface"))}>
              {slot.type === "점심시간" ? (
                <div className={cn("font-medium", textPrimary)}>맛있는 점심식사 드세요.</div>
              ) : slot.type === "자율학습" ? (
                <div className={cn("font-medium", textPrimary)}>완료하지 못한 학습 또는 복습을 진행하세요.</div>
              ) : (
                <div className={cn("font-medium", textPrimary)}>{slot.label || slot.type}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

