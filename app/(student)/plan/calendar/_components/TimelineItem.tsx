"use client";

import type { PlanWithContent } from "../_types/plan";
import type { AcademySchedule } from "@/lib/types/plan";
import { getTimeSlotColorClass, getTimeSlotIcon } from "../_utils/timelineUtils";
import { PlanCard } from "./PlanCard";

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
};

export function TimelineItem({ slot, isLast = false }: TimelineItemProps) {
  const colorClass = getTimeSlotColorClass(slot.type);
  const icon = getTimeSlotIcon(slot.type);

  // 시간에서 시(hour)만 추출 (예: "10:00" -> "10시")
  const startHour = slot.start.split(":")[0];
  const endHour = slot.end.split(":")[0];

  return (
    <div className="relative flex gap-4">
      {/* 시간대 라인 */}
      <div className="flex flex-col items-center">
        <div className="rounded-lg bg-white px-4 py-2 text-base font-bold text-gray-900 shadow-md border-2 border-gray-300">
          {startHour}시
        </div>
        {!isLast && (
          <div className="mt-2 h-full min-h-[60px] w-1 bg-gradient-to-b from-gray-300 to-gray-200"></div>
        )}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 pb-4">
        <div className={`rounded-lg border-2 p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${colorClass}`}>
          {/* 타입 헤더 */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              {(slot.type === "학습시간" || slot.type === "학원일정") && (
                <span className="text-lg font-bold text-gray-900">
                  {slot.start} ~ {slot.end}
                </span>
              )}
            </div>
            <span className={`rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${
              slot.type === "학습시간"
                ? "bg-blue-500 text-white"
                : slot.type === "학원일정"
                ? "bg-purple-500 text-white"
                : slot.type === "자율학습"
                ? "bg-green-500 text-white"
                : "bg-orange-500 text-white"
            }`}>
              {slot.type}
            </span>
          </div>

          {/* 학원일정 표시 */}
          {slot.type === "학원일정" && slot.academy && (
            <div className="rounded-lg bg-white/60 p-3">
              <div className="font-medium text-gray-900">
                {slot.academy.academy_name || "학원"}
              </div>
              {slot.academy.subject && (
                <div className="mt-1 text-sm text-gray-600">
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
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    compact={false}
                    showTime={true}
                    showProgress={true}
                  />
                ))}
            </div>
          )}

          {/* 플랜이 없는 학습시간 */}
          {slot.type === "학습시간" && (!slot.plans || slot.plans.length === 0) && (
            <div className="rounded-lg bg-white/60 p-3 text-center text-sm text-gray-400">
              플랜 없음
            </div>
          )}

          {/* 특수 타임슬롯 (점심시간, 이동시간, 자율학습 등) */}
          {slot.type !== "학습시간" && slot.type !== "학원일정" && (
            <div className="rounded-lg bg-white/60 p-3">
              {slot.type === "점심시간" ? (
                <div className="font-medium text-gray-900">맛있는 점심식사 드세요.</div>
              ) : slot.type === "자율학습" ? (
                <div className="font-medium text-gray-900">완료하지 못한 학습 또는 복습을 진행하세요.</div>
              ) : (
                <div className="font-medium">{slot.label || slot.type}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

