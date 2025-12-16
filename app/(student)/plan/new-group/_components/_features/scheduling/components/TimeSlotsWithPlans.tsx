import { memo, useMemo } from "react";
import type { BlockData, ContentData } from "../../../utils/scheduleTransform";
import type { Plan } from "./scheduleTypes";
import {
  timeToMinutes,
  minutesToTime,
  getPlanStartTime,
  calculateEstimatedTime,
} from "./scheduleUtils";
import { PlanTable } from "./PlanTable";
import { getTimeSlotColorClasses, type TimeSlotType } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

// 모든 시간 슬롯과 플랜을 함께 처리하는 컴포넌트
export const TimeSlotsWithPlans = memo(
  function TimeSlotsWithPlans({
    timeSlots,
    date,
    datePlans,
    contents,
    blocks,
    dayType,
    totalStudyHours,
    sequenceMap,
  }: {
    timeSlots: Array<{
      type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
      start: string;
      end: string;
      label?: string;
    }>;
    date: string;
    datePlans: Plan[];
    contents: Map<string, ContentData>;
    blocks: BlockData[];
    dayType: string;
    totalStudyHours: number;
    sequenceMap: Map<string, number>;
  }) {
    // 학습시간과 자율학습 블록 필터링 (메모이제이션)
    const studyTimeSlots = useMemo(
      () =>
        timeSlots.filter(
          (slot) => slot.type === "학습시간" || slot.type === "자율학습"
        ),
      [timeSlots]
    );

    // 이동시간과 학원일정 슬롯 필터링 (메모이제이션)
    const travelAndAcademySlots = useMemo(
      () =>
        timeSlots.filter(
          (slot) => slot.type === "이동시간" || slot.type === "학원일정"
        ),
      [timeSlots]
    );

    // 플랜 정보 준비 (메모이제이션)
    const plansWithInfo = useMemo(() => {
      const plans = datePlans.map((plan) => {
        // DB에 저장된 start_time과 end_time을 우선 사용
        let startTime: string | null = null;
        let endTime: string | null = null;
        
        if (plan.start_time && plan.end_time) {
          // DB에 저장된 시간이 있으면 직접 사용
          startTime = plan.start_time;
          endTime = plan.end_time;
        } else {
          // 없으면 getPlanStartTime으로 추정
          startTime = getPlanStartTime(plan, date, blocks);
        }
        
        const estimatedTime = calculateEstimatedTime(plan, contents, dayType);
        
        // DB에 저장된 시간이 있으면 그 시간을 사용, 없으면 추정 시간 사용
        const originalStartTime = startTime ? timeToMinutes(startTime) : null;
        const originalEndTime = endTime ? timeToMinutes(endTime) : null;
        const originalDuration = originalStartTime !== null && originalEndTime !== null
          ? originalEndTime - originalStartTime
          : estimatedTime;
        
        return {
          plan,
          originalStartTime,
          originalEndTime,
          originalEstimatedTime: originalDuration, // DB 시간 또는 예상 소요시간 저장
          estimatedTime, // 배치에 사용할 시간
          remainingTime: estimatedTime, // 남은 시간 추적
          blockIndex: plan.block_index,
        };
      });

      // 복습일이고 예상 소요시간이 총 학습시간보다 큰 경우 평균 시간으로 조정
      const isReviewDay = dayType === "복습일";
      const totalEstimatedTime = plans.reduce(
        (sum, p) => sum + p.originalEstimatedTime,
        0
      );
      const totalStudyMinutes = totalStudyHours * 60;

      if (
        isReviewDay &&
        totalEstimatedTime > totalStudyMinutes &&
        datePlans.length > 0
      ) {
        // 평균 시간 계산
        const averageTime = Math.floor(totalStudyMinutes / datePlans.length);
        plans.forEach((p) => {
          p.estimatedTime = averageTime;
          p.remainingTime = averageTime;
          // originalEstimatedTime은 그대로 유지 (강조 표시용)
        });
      }

      return plans;
    }, [datePlans, date, blocks, contents, dayType, totalStudyHours]);

    // 플랜을 시간 순으로 정렬 (메모이제이션)
    const sortedPlans = useMemo(() => {
      return [...plansWithInfo].sort((a, b) => {
        if (a.originalStartTime !== null && b.originalStartTime !== null) {
          return a.originalStartTime - b.originalStartTime;
        }
        if (a.originalStartTime !== null) return -1;
        if (b.originalStartTime !== null) return 1;
        return (a.blockIndex || 0) - (b.blockIndex || 0);
      });
    }, [plansWithInfo]);

    // 각 학습시간 블록에 플랜 배치 (메모이제이션)
    const slotPlansMap = useMemo(() => {
      const map = new Map<
        number,
        Array<{
          plan: Plan;
          start: string;
          end: string;
          isPartial: boolean;
          isContinued: boolean; // 이전 블록에서 이어지는지
          originalEstimatedTime: number; // 원래 예상 소요시간
        }>
      >();

      // 각 슬롯에 플랜 배치 (같은 날 모든 플랜 우선 배치)
      // plansWithInfo를 복사하여 remainingTime을 추적
      const plansWithRemainingTime = sortedPlans.map((p) => ({
        ...p,
        remainingTime: p.estimatedTime,
      }));

      studyTimeSlots.forEach((slot, slotIdx) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        const plansInSlot: Array<{
          plan: Plan;
          start: string;
          end: string;
          isPartial: boolean;
          isContinued: boolean;
          originalEstimatedTime: number;
        }> = [];

        // 시작 시간이 있는 플랜들 배치
        for (const planInfo of plansWithRemainingTime) {
          if (planInfo.remainingTime <= 0) continue;

          if (planInfo.originalStartTime !== null) {
            const planStart = planInfo.originalStartTime;
            // DB에 저장된 end_time이 있으면 사용, 없으면 예상 시간 사용
            const planEnd = planInfo.originalEndTime !== null
              ? planInfo.originalEndTime
              : planStart + planInfo.originalEstimatedTime;

            // 플랜이 이 슬롯과 겹치는지 확인
            if (planStart < slotEnd && planEnd > slotStart) {
              // DB에 저장된 시간이 있으면 그대로 사용
              if (planInfo.originalEndTime !== null && planStart >= slotStart && planEnd <= slotEnd) {
                plansInSlot.push({
                  plan: planInfo.plan,
                  start: minutesToTime(planStart),
                  end: minutesToTime(planEnd),
                  isPartial: false,
                  isContinued: false,
                  originalEstimatedTime: planInfo.originalEstimatedTime,
                });
                planInfo.remainingTime = 0; // DB 시간을 사용했으므로 남은 시간 0
              } else {
                // 슬롯 범위 내에서 조정
                const slotAvailableStart = Math.max(planStart, slotStart);
                const slotAvailableEnd = Math.min(
                  planInfo.originalEndTime !== null ? planInfo.originalEndTime : planStart + planInfo.remainingTime,
                  slotEnd
                );

                if (slotAvailableStart < slotAvailableEnd) {
                  const timeUsed = slotAvailableEnd - slotAvailableStart;
                  const wasPartial =
                    planInfo.remainingTime < planInfo.originalEstimatedTime;

                  plansInSlot.push({
                    plan: planInfo.plan,
                    start: minutesToTime(slotAvailableStart),
                    end: minutesToTime(slotAvailableEnd),
                    isPartial: planInfo.remainingTime > timeUsed,
                    isContinued: wasPartial, // 이전 블록에서 이어지는지
                    originalEstimatedTime: planInfo.originalEstimatedTime,
                  });
                  planInfo.remainingTime -= timeUsed;
                }
              }
            }
          }
        }

        // 시작 시간이 없는 플랜들 배치 (같은 날 모든 플랜 우선 배치)
        let currentTime = slotStart;
        for (const planInfo of plansWithRemainingTime) {
          if (planInfo.remainingTime <= 0) continue;
          if (planInfo.originalStartTime !== null) continue; // 이미 배치된 플랜은 스킵

          const timeToUse = Math.min(
            planInfo.remainingTime,
            slotEnd - currentTime
          );
          if (timeToUse > 0) {
            const wasPartial =
              planInfo.remainingTime < planInfo.originalEstimatedTime;
            const willBePartial = planInfo.remainingTime > timeToUse;

            plansInSlot.push({
              plan: planInfo.plan,
              start: minutesToTime(currentTime),
              end: minutesToTime(currentTime + timeToUse),
              isPartial: willBePartial,
              isContinued: wasPartial, // 이전 블록에서 이어지는지
              originalEstimatedTime: planInfo.originalEstimatedTime,
            });
            planInfo.remainingTime -= timeToUse;
            currentTime += timeToUse;

            if (currentTime >= slotEnd) break;
          }
        }

        // 시간 순으로 정렬
        plansInSlot.sort(
          (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
        );

        if (plansInSlot.length > 0) {
          map.set(slotIdx, plansInSlot);
        }
      });

      return map;
    }, [studyTimeSlots, sortedPlans]);

    // 각 학습시간 슬롯에서 남은 시간 영역 계산 (메모이제이션)
    const remainingTimeSlotsMap = useMemo(() => {
      const map = new Map<
        number,
        Array<{
          start: string;
          end: string;
          type: "학습시간" | "자율학습";
        }>
      >();

      studyTimeSlots.forEach((slot, slotIdx) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        const plansInSlot = slotPlansMap.get(slotIdx) || [];

        // 플랜이 배치된 시간 구간들
        const usedRanges: Array<{ start: number; end: number }> = [];
        plansInSlot.forEach((plan) => {
          usedRanges.push({
            start: timeToMinutes(plan.start),
            end: timeToMinutes(plan.end),
          });
        });

        // 시간 순으로 정렬
        usedRanges.sort((a, b) => a.start - b.start);

        // 남은 시간 구간 계산
        const remainingRanges: Array<{ start: string; end: string }> = [];
        let currentTime = slotStart;

        usedRanges.forEach((range) => {
          if (currentTime < range.start) {
            // 플랜 배치 전 남은 시간
            remainingRanges.push({
              start: minutesToTime(currentTime),
              end: minutesToTime(range.start),
            });
          }
          currentTime = Math.max(currentTime, range.end);
        });

        // 마지막 플랜 이후 남은 시간
        if (currentTime < slotEnd) {
          remainingRanges.push({
            start: minutesToTime(currentTime),
            end: minutesToTime(slotEnd),
          });
        }

        if (remainingRanges.length > 0) {
          map.set(
            slotIdx,
            remainingRanges.map((range) => ({
              ...range,
              type: slot.type as "학습시간" | "자율학습",
            }))
          );
        }
      });

      return map;
    }, [studyTimeSlots, slotPlansMap]);

    // 이동시간/학원일정 슬롯에 커스텀 플랜 배치 (메모이제이션)
    const travelAndAcademyPlansMap = useMemo(() => {
      const map = new Map<
        number,
        Array<{
          plan: Plan;
          start: string;
          end: string;
          isPartial: boolean;
          isContinued: boolean;
          originalEstimatedTime: number;
        }>
      >();

      // 커스텀 플랜만 별도로 처리 (이동시간/학원일정 슬롯에 배치)
      const customPlansWithInfo = plansWithInfo.filter(
        (p) => p.plan.content_type === "custom"
      );

      travelAndAcademySlots.forEach((slot, slotIdx) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        const plansInSlot: Array<{
          plan: Plan;
          start: string;
          end: string;
          isPartial: boolean;
          isContinued: boolean;
          originalEstimatedTime: number;
        }> = [];

        // 커스텀 플랜 중에서 이 슬롯과 시간이 일치하는 플랜 찾기
        for (const planInfo of customPlansWithInfo) {
          // 시작 시간이 있는 경우: 슬롯과 시간이 겹치는지 확인
          if (planInfo.originalStartTime !== null) {
            const planStart = planInfo.originalStartTime;
            const planEnd = planStart + planInfo.originalEstimatedTime;

            // 플랜이 이 슬롯과 겹치는지 확인
            if (planStart < slotEnd && planEnd > slotStart) {
              const slotAvailableStart = Math.max(planStart, slotStart);
              const slotAvailableEnd = Math.min(planEnd, slotEnd);

              if (slotAvailableStart < slotAvailableEnd) {
                plansInSlot.push({
                  plan: planInfo.plan,
                  start: minutesToTime(slotAvailableStart),
                  end: minutesToTime(slotAvailableEnd),
                  isPartial: false,
                  isContinued: false,
                  originalEstimatedTime: planInfo.originalEstimatedTime,
                });
              }
            }
          } else {
            // 시작 시간이 없는 경우: 슬롯 시간에 맞춰 배치
            // (이동시간/학원일정은 일반적으로 시간이 고정되어 있으므로)
            const timeToUse = Math.min(
              planInfo.estimatedTime,
              slotEnd - slotStart
            );
            if (timeToUse > 0) {
              plansInSlot.push({
                plan: planInfo.plan,
                start: slot.start,
                end: minutesToTime(slotStart + timeToUse),
                isPartial: planInfo.estimatedTime > timeToUse,
                isContinued: false,
                originalEstimatedTime: planInfo.originalEstimatedTime,
              });
            }
          }
        }

        if (plansInSlot.length > 0) {
          map.set(slotIdx, plansInSlot);
        }
      });

      return map;
    }, [travelAndAcademySlots, plansWithInfo]);

    // 모든 이동시간/학원일정 슬롯에서 배치된 플랜 ID 수집
    const placedPlanIds = new Set<string>();
    travelAndAcademyPlansMap.forEach((plans) => {
      plans.forEach((p) => {
        placedPlanIds.add(p.plan.id);
      });
    });

    // 학습시간 및 자율학습 블록 인덱스 매핑 (메모이제이션)
    const studySlotIndexMap = useMemo(() => {
      const map = new Map<number, number>();
      let studySlotIdx = 0;
      timeSlots.forEach((slot, idx) => {
        if (slot.type === "학습시간" || slot.type === "자율학습") {
          map.set(idx, studySlotIdx);
          studySlotIdx++;
        }
      });
      return map;
    }, [timeSlots]);

    // 이동시간/학원일정 슬롯 인덱스 매핑 (메모이제이션)
    const travelAndAcademySlotIndexMap = useMemo(() => {
      const map = new Map<number, number>();
      let travelAndAcademySlotIdx = 0;
      timeSlots.forEach((slot, idx) => {
        if (slot.type === "이동시간" || slot.type === "학원일정") {
          map.set(idx, travelAndAcademySlotIdx);
          travelAndAcademySlotIdx++;
        }
      });
      return map;
    }, [timeSlots]);

    return (
      <>
        {timeSlots.map((slot, idx) => {
          const slotColorClasses = getTimeSlotColorClasses(slot.type as TimeSlotType);

          // 학습시간 블록인 경우 해당 인덱스로 플랜 찾기
          const studySlotIdx = studySlotIndexMap.get(idx);
          const plansInStudySlot =
            slot.type === "학습시간" && studySlotIdx !== undefined
              ? slotPlansMap.get(studySlotIdx) || []
              : [];

          // 이동시간/학원일정 슬롯인 경우 커스텀 플랜 찾기
          const travelAndAcademySlotIdx = travelAndAcademySlotIndexMap.get(idx);
          const plansInTravelAndAcademySlot =
            (slot.type === "이동시간" || slot.type === "학원일정") &&
            travelAndAcademySlotIdx !== undefined
              ? travelAndAcademyPlansMap.get(travelAndAcademySlotIdx) || []
              : [];

          // 학습시간 슬롯에는 커스텀이 아닌 플랜만 표시
          // const nonCustomPlans = datePlans.filter(
          //   (p) => p.content_type !== "custom"
          // );
          // 이동시간/학원일정 슬롯에는 커스텀 플랜만 표시
          const customPlans = datePlans.filter(
            (p) => p.content_type === "custom"
          );
          // 배치되지 않은 커스텀 플랜만 필터링
          const unplacedCustomPlans = customPlans.filter(
            (p) => !placedPlanIds.has(p.id)
          );

          return (
            <div key={idx} className="flex flex-col gap-1.5">
              <div
                className={cn("rounded border px-3 py-2 text-xs", slotColorClasses)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{idx + 1}.</span>
                    <span className="font-medium">
                      {slot.label || slot.type}
                    </span>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {slot.start} ~ {slot.end}
                  </span>
                </div>
              </div>
              {/* 학습시간 슬롯 */}
              {(slot.type === "학습시간" || slot.type === "자율학습") && (
                <>
                  {plansInStudySlot.length > 0 && (
                    <div className="pl-4 overflow-x-auto">
                      <PlanTable
                        plans={plansInStudySlot}
                        contents={contents}
                        dayType={dayType}
                        sequenceMap={sequenceMap}
                      />
                    </div>
                  )}
                  {/* 남은 학습 시간 영역 표시 (플랜이 일부만 배치된 경우만) */}
                  {(() => {
                    // 플랜이 하나도 없으면 남은 시간 영역을 표시하지 않음 (중복 방지)
                    if (plansInStudySlot.length === 0) {
                      return null;
                    }

                    const studySlotIdx = studySlotIndexMap.get(idx);
                    const remainingRanges =
                      studySlotIdx !== undefined
                        ? remainingTimeSlotsMap.get(studySlotIdx) || []
                        : [];

                    // 플랜이 일부만 배치되어 남은 영역이 있을 때만 표시
                    return remainingRanges.length > 0 ? (
                      <div className="pl-4 flex flex-col gap-1.5">
                        {remainingRanges.map((range, rangeIdx) => {
                          const rangeColorClasses = getTimeSlotColorClasses(range.type as TimeSlotType);
                          return (
                            <div
                              key={rangeIdx}
                              className={cn("rounded border px-3 py-2 text-xs", rangeColorClasses)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {range.type === "학습시간"
                                    ? "학습 시간"
                                    : "자율 학습 시간"}
                                </span>
                                <span>
                                  {range.start} ~ {range.end}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                </>
              )}
              {/* 이동시간/학원일정 슬롯 */}
              {(slot.type === "이동시간" || slot.type === "학원일정") && (
                <>
                  {plansInTravelAndAcademySlot.length > 0 ? (
                    <div className="pl-4 overflow-x-auto">
                      <PlanTable
                        plans={plansInTravelAndAcademySlot}
                        contents={contents}
                        dayType={dayType}
                        sequenceMap={sequenceMap}
                      />
                    </div>
                  ) : unplacedCustomPlans.length > 0 ? (
                    <div className="pl-4 text-xs text-gray-600 dark:text-gray-400 italic">
                      (커스텀 플랜 {unplacedCustomPlans.length}개 - 시간 정보
                      없음)
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  },
  (prevProps, nextProps) => {
    // timeSlots, datePlans, dayType이 변경되었는지 확인
    return (
      prevProps.date === nextProps.date &&
      prevProps.dayType === nextProps.dayType &&
      prevProps.totalStudyHours === nextProps.totalStudyHours &&
      prevProps.timeSlots.length === nextProps.timeSlots.length &&
      prevProps.datePlans.length === nextProps.datePlans.length &&
      prevProps.sequenceMap.size === nextProps.sequenceMap.size
    );
  }
);
