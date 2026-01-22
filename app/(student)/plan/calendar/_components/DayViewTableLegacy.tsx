"use client";

/**
 * DayViewTableLegacy - 레거시 테이블 뷰 컴포넌트
 *
 * 이 컴포넌트는 DayView에서 분리된 테이블 형식의 플랜 표시 뷰입니다.
 * 현재는 비활성화 상태이나, 프린트 뷰나 관리자 상세 뷰 등에서 재활용 가능합니다.
 *
 * @deprecated 현재 비활성화 상태 - 필요시 활성화하여 사용
 */

import React from "react";
import { Clock } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { AcademySchedule } from "@/lib/types/plan";
import { getContentTypeIcon } from "../../_shared/utils/contentTypeUtils";
import {
  getTimeSlotColorClass,
  getTimeSlotIcon,
  type TimeSlotType,
} from "../_utils/timelineUtils";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  textTertiary,
  textMuted,
  bgStyles,
} from "@/lib/utils/darkMode";

export type TimeBlock = {
  index: number;
  label: string;
  time: string;
  startTime: string;
  endTime: string;
};

type DayViewTableLegacyProps = {
  timeBlocks: TimeBlock[];
  plansByBlock: Map<number, PlanWithContent[]>;
  slotTypes: Map<number, TimeSlotType>;
  academyByBlock: Map<number, AcademySchedule>;
};

export function DayViewTableLegacy({
  timeBlocks,
  plansByBlock,
  slotTypes,
  academyByBlock,
}: DayViewTableLegacyProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">학습 플랜</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                시간대
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                콘텐츠
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                교과/과목
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                범위/시간
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                상태
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                진행률/시간
              </th>
            </tr>
          </thead>
          <tbody>
            {timeBlocks.map((block) => {
              const slotType = slotTypes.get(block.index);
              const blockPlans = (plansByBlock.get(block.index) || []).sort(
                (a, b) => a.block_index - b.block_index
              );
              const blockAcademy = academyByBlock.get(block.index);

              // 학원일정 처리
              if (slotType === "학원일정" && blockAcademy) {
                const colorClass = getTimeSlotColorClass(slotType);
                const IconComponent = getTimeSlotIcon(slotType);

                return (
                  <tr
                    key={block.index}
                    className={`border-b border-gray-100 ${colorClass}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{block.label}</span>
                        <span className="text-xs opacity-75">{block.time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        <span>{blockAcademy.academy_name || "학원"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {blockAcademy.subject || "-"}
                    </td>
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-center text-sm text-gray-400"
                    >
                      학원일정
                    </td>
                  </tr>
                );
              }

              // 점심시간, 이동시간, 자율학습 등 특수 타임슬롯 처리
              if (slotType && slotType !== "학습시간" && slotType !== "학원일정") {
                const colorClass = getTimeSlotColorClass(slotType);
                const IconComponent = getTimeSlotIcon(slotType);

                return (
                  <tr
                    key={block.index}
                    className={`border-b border-gray-100 ${colorClass}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{block.label}</span>
                        <span className="text-xs opacity-75">{block.time}</span>
                      </div>
                    </td>
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-center text-sm font-medium"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <IconComponent className="h-4 w-4 shrink-0" />
                        <span>{slotType}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              // 학습시간 처리
              return (
                <React.Fragment key={block.index}>
                  {/* 플랜 행들 */}
                  {blockPlans.length > 0 ? (
                    blockPlans.map((plan, planIndex) => {
                      const ContentTypeIcon = getContentTypeIcon(plan.content_type);
                      const isCompleted = plan.status === "completed" || plan.actual_end_time != null;
                      const isActive =
                        plan.actual_start_time && !plan.actual_end_time;
                      // Keep progress for UI display (backwards compatibility)
                      const progressPercentage =
                        plan.progress != null ? Math.round(plan.progress) : null;

                      return (
                        <tr
                          key={plan.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            isCompleted
                              ? "bg-green-50/50"
                              : isActive
                                ? "bg-blue-50/50"
                                : ""
                          }`}
                        >
                          {/* 시간대 (첫 번째 플랜만 표시) */}
                          {planIndex === 0 && (
                            <td
                              className="px-4 py-3 align-top text-sm font-medium text-gray-700"
                              rowSpan={blockPlans.length}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span>{block.label}</span>
                                <span className="text-xs text-gray-500">
                                  {block.time}
                                </span>
                              </div>
                            </td>
                          )}
                          {/* 콘텐츠 */}
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-2">
                              <ContentTypeIcon className="h-5 w-5 shrink-0" />
                              <div className="flex flex-col gap-0.5">
                                <span className={cn("font-medium", textPrimary)}>
                                  {plan.contentTitle}
                                </span>
                                {plan.contentCategory && (
                                  <span className={cn("text-xs", textMuted)}>
                                    {plan.contentCategory}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* 교과/과목 */}
                          <td
                            className={cn(
                              "px-4 py-3 align-top text-sm",
                              textSecondary
                            )}
                          >
                            <div className="flex flex-col gap-1">
                              {plan.contentSubjectCategory && (
                                <span
                                  className={cn(
                                    "inline-block rounded px-2 py-0.5 text-xs font-medium",
                                    bgStyles.gray,
                                    textSecondary
                                  )}
                                >
                                  {plan.contentSubjectCategory}
                                </span>
                              )}
                              {plan.contentSubject && (
                                <span className={cn("text-xs", textTertiary)}>
                                  {plan.contentSubject}
                                </span>
                              )}
                              {!plan.contentSubjectCategory &&
                                !plan.contentSubject && (
                                  <span className={cn("text-xs", textMuted)}>
                                    -
                                  </span>
                                )}
                            </div>
                          </td>
                          {/* 범위 */}
                          <td
                            className={cn(
                              "px-4 py-3 align-top text-sm",
                              textSecondary
                            )}
                          >
                            <div className="flex flex-col gap-1">
                              {plan.planned_start_page_or_time !== null &&
                              plan.planned_end_page_or_time !== null ? (
                                <>
                                  {(() => {
                                    const ContentIcon = getContentTypeIcon(
                                      plan.content_type
                                    );
                                    return (
                                      <div className="flex items-center gap-1">
                                        <ContentIcon className="h-4 w-4 shrink-0" />
                                        <span>
                                          {plan.content_type === "book" ? (
                                            <>
                                              {plan.planned_start_page_or_time}-
                                              {plan.planned_end_page_or_time}
                                              페이지
                                            </>
                                          ) : (
                                            <>
                                              {plan.planned_start_page_or_time}강
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {plan.chapter && (
                                    <span className={cn("text-xs", textMuted)}>
                                      챕터: {plan.chapter}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className={cn("text-xs", textMuted)}>
                                  -
                                </span>
                              )}
                              {/* 시간 정보 */}
                              {plan.start_time && plan.end_time && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  <span>
                                    {plan.start_time} ~ {plan.end_time}
                                  </span>
                                </div>
                              )}
                              {/* 블록 인덱스 */}
                              <div className={cn("text-xs", textMuted)}>
                                블록 {plan.block_index}
                              </div>
                            </div>
                          </td>
                          {/* 상태 */}
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              {isCompleted && (
                                <span className="inline-block w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  ✅ 완료
                                </span>
                              )}
                              {isActive && (
                                <span className="inline-block w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                  ⏱️ 학습 중
                                </span>
                              )}
                              {!isCompleted && !isActive && (
                                <span className={cn("text-xs", textMuted)}>
                                  대기
                                </span>
                              )}
                            </div>
                          </td>
                          {/* 진행률 */}
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              {progressPercentage !== null ? (
                                <>
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      textSecondary
                                    )}
                                  >
                                    {progressPercentage}%
                                  </span>
                                  <div className="w-20">
                                    <ProgressBar
                                      value={progressPercentage}
                                      variant={
                                        isCompleted
                                          ? "success"
                                          : isActive
                                            ? "default"
                                            : undefined
                                      }
                                      color={
                                        isCompleted
                                          ? undefined
                                          : isActive
                                            ? "blue"
                                            : undefined
                                      }
                                      size="xs"
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className={cn("text-xs", textMuted)}>
                                  -
                                </span>
                              )}
                              {/* 완료량 */}
                              {plan.completed_amount !== null &&
                                plan.planned_end_page_or_time !== null && (
                                  <div className={cn("text-xs", textMuted)}>
                                    완료: {plan.completed_amount} /{" "}
                                    {plan.planned_end_page_or_time}
                                  </div>
                                )}
                              {/* 실제 시간 정보 */}
                              {plan.actual_start_time && (
                                <div className={cn("text-xs", textMuted)}>
                                  시작:{" "}
                                  {new Date(
                                    plan.actual_start_time
                                  ).toLocaleTimeString("ko-KR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                              {plan.actual_end_time && (
                                <div className={cn("text-xs", textMuted)}>
                                  종료:{" "}
                                  {new Date(
                                    plan.actual_end_time
                                  ).toLocaleTimeString("ko-KR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                              {/* 소요 시간 */}
                              {plan.total_duration_seconds != null && (
                                <div className={cn("text-xs", textMuted)}>
                                  소요:{" "}
                                  {Math.floor(plan.total_duration_seconds / 60)}분
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // 플랜이 없는 학습시간대
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">
                        <div className="flex flex-col gap-0.5">
                          <span>{block.label}</span>
                          <span className="text-xs text-gray-500">
                            {block.time}
                          </span>
                        </div>
                      </td>
                      <td
                        colSpan={5}
                        className="px-4 py-3 text-center text-sm text-gray-400"
                      >
                        플랜 없음
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
