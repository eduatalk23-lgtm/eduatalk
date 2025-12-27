"use client";

import { useMemo } from "react";
import { TimelineZone, type TimeBlock, type ZoneType, type OverlayPlan } from "./containers/TimelineZone";
import type { PlanGroup } from "../_utils/planGroupUtils";
import type { DailyScheduleInfo } from "@/lib/types/plan/domain";

type TimelineViewProps = {
  groups: PlanGroup[];
  serverNow?: number;
  dailySchedule?: DailyScheduleInfo | null;
};

/**
 * 슬롯 타입을 ZoneType으로 변환
 */
function mapSlotTypeToZone(slotType: string): ZoneType {
  switch (slotType) {
    case "학습시간":
      return "study";
    case "점심시간":
      return "lunch";
    case "학원일정":
      return "academy";
    case "이동시간":
      return "transit";
    case "자율학습":
      return "free";
    default:
      return "study";
  }
}

/**
 * 시간이 블록 범위 내에 있는지 확인
 */
function isTimeInRange(time: string, blockStart: string, blockEnd: string): boolean {
  return time >= blockStart && time < blockEnd;
}

/**
 * 플랜의 범위 레이블 생성
 */
function getRangeLabel(plan: PlanGroup["plan"]): string | undefined {
  const { planned_start_page_or_time: start, planned_end_page_or_time: end, content_type } = plan;
  if (start === null || start === undefined || end === null || end === undefined) {
    return undefined;
  }
  if (content_type === "book") {
    return `p.${start}-${end}`;
  }
  if (content_type === "lecture") {
    return `${start}~${end}`;
  }
  return `${start}~${end}`;
}

/**
 * TimelineView - 타임라인 기반 플랜 뷰
 * 플랜 그룹 생성 시 도출된 타임라인 데이터(daily_schedule)를 기반으로 표시합니다.
 * - dailySchedule.time_slots: 학습시간, 점심시간, 학원일정 등
 * - 완료된 플랜은 오버레이로 표시
 */
export function TimelineView({
  groups,
  serverNow = Date.now(),
  dailySchedule = null,
}: TimelineViewProps) {
  // 현재 시간 계산 (HH:mm 형식)
  const currentTime = useMemo(() => {
    const now = new Date(serverNow);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, [serverNow]);

  // time_slots → TimeBlock 변환 및 완료된 플랜 오버레이
  const timeBlocks = useMemo(() => {
    const blocks: TimeBlock[] = [];

    // 1. dailySchedule의 time_slots를 TimeBlock으로 변환
    if (dailySchedule?.time_slots && dailySchedule.time_slots.length > 0) {
      dailySchedule.time_slots.forEach((slot, index) => {
        blocks.push({
          id: `schedule-${index}`,
          startTime: slot.start,
          endTime: slot.end,
          zoneType: mapSlotTypeToZone(slot.type),
          label: slot.label || slot.type,
        });
      });
    } else {
      // dailySchedule이 없으면 기본 학습 시간대 블록 생성
      blocks.push({
        id: "study-morning",
        startTime: "09:00",
        endTime: "12:00",
        zoneType: "study",
        label: "오전 학습시간",
      });

      blocks.push({
        id: "lunch",
        startTime: "12:00",
        endTime: "13:00",
        zoneType: "lunch",
        label: "점심시간",
      });

      blocks.push({
        id: "study-afternoon",
        startTime: "13:00",
        endTime: "18:00",
        zoneType: "study",
        label: "오후 학습시간",
      });

      blocks.push({
        id: "study-evening",
        startTime: "18:00",
        endTime: "22:00",
        zoneType: "free",
        label: "저녁 학습시간",
      });
    }

    // 2. 완료된 플랜 및 진행 중인 플랜을 해당 시간대 블록 내에 오버레이로 추가
    const now = new Date(serverNow);
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    for (const group of groups) {
      const plan = group.plan;
      // status 필드가 없을 수 있으므로 actual_end_time으로 완료 상태를 추론
      const isCompleted = !!plan.actual_end_time;
      const isActive = !!plan.actual_start_time && !plan.actual_end_time;
      const status = plan.status || (isCompleted ? "completed" : isActive ? "in_progress" : "scheduled");

      // 완료된 플랜 (actual_end_time이 있으면 완료로 처리)
      if (isCompleted && plan.actual_start_time && plan.actual_end_time) {
        const startDate = new Date(plan.actual_start_time);
        const endDate = new Date(plan.actual_end_time);
        const planStartTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
        const planEndTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

        // 해당 시간대 블록 찾기
        const matchingBlock = blocks.find(block =>
          isTimeInRange(planStartTime, block.startTime, block.endTime)
        );

        if (matchingBlock) {
          // 해당 블록의 overlayPlans에 추가
          if (!matchingBlock.overlayPlans) {
            matchingBlock.overlayPlans = [];
          }
          matchingBlock.overlayPlans.push({
            id: plan.id,
            title: plan.content_title || "학습 완료",
            chapter: plan.chapter ?? undefined,
            contentType: plan.content_type as OverlayPlan["contentType"],
            range: getRangeLabel(plan),
            durationMinutes,
            startTime: planStartTime,
            endTime: planEndTime,
            status: "completed",
          });
        }
      }

      // 진행 중인 플랜 (학습 중 또는 일시정지)
      if (isActive && plan.actual_start_time) {
        const startDate = new Date(plan.actual_start_time);
        const planStartTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
        const elapsedMinutes = Math.max(0, Math.round((now.getTime() - startDate.getTime()) / 60000));
        const isPaused = status === "paused" || plan.session?.isPaused === true;

        // 해당 시간대 블록 찾기
        const matchingBlock = blocks.find(block =>
          isTimeInRange(planStartTime, block.startTime, block.endTime)
        );

        if (matchingBlock) {
          // 해당 블록의 overlayPlans에 추가
          if (!matchingBlock.overlayPlans) {
            matchingBlock.overlayPlans = [];
          }
          matchingBlock.overlayPlans.push({
            id: plan.id,
            title: plan.content_title || "학습 중",
            chapter: plan.chapter ?? undefined,
            contentType: plan.content_type as OverlayPlan["contentType"],
            range: getRangeLabel(plan),
            durationMinutes: elapsedMinutes,
            startTime: planStartTime,
            endTime: currentTimeStr,
            status: "active",
            isPaused,
          });
        }
      }
    }

    // 각 블록 내 overlayPlans 시간순 정렬
    for (const block of blocks) {
      if (block.overlayPlans) {
        block.overlayPlans.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }

    return blocks;
  }, [groups, dailySchedule, serverNow]);

  // groups가 비어있어도 타임라인(시간대)은 항상 표시
  return <TimelineZone blocks={timeBlocks} currentTime={currentTime} />;
}
