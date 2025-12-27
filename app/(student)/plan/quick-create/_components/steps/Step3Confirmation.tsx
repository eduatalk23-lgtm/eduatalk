"use client";

import { useMemo } from "react";
import { BookOpen, Calendar, Clock, Repeat, CheckCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { type SelectedContent, type ScheduleSettings, FREE_LEARNING_OPTIONS } from "../types";

interface Step3ConfirmationProps {
  content: SelectedContent | null;
  schedule: ScheduleSettings;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function Step3Confirmation({ content, schedule }: Step3ConfirmationProps) {
  // 날짜 포맷팅
  const formattedDate = useMemo(() => {
    if (!schedule.planDate) return "";
    const date = new Date(schedule.planDate + "T00:00:00");
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [schedule.planDate]);

  // 반복 설명
  const repeatDescription = useMemo(() => {
    if (schedule.repeatType === "none") return null;

    if (schedule.repeatType === "daily") {
      const endDate = schedule.repeatEndDate
        ? new Date(schedule.repeatEndDate + "T00:00:00").toLocaleDateString(
            "ko-KR",
            { month: "long", day: "numeric" }
          )
        : "무기한";
      return `매일 반복 (${endDate}까지)`;
    }

    if (schedule.repeatType === "weekly" && schedule.repeatDays?.length) {
      const days = schedule.repeatDays.map((d) => WEEKDAY_LABELS[d]).join(", ");
      const endDate = schedule.repeatEndDate
        ? new Date(schedule.repeatEndDate + "T00:00:00").toLocaleDateString(
            "ko-KR",
            { month: "long", day: "numeric" }
          )
        : "무기한";
      return `매주 ${days} 반복 (${endDate}까지)`;
    }

    return null;
  }, [schedule]);

  // 시간 포맷팅
  const timeDisplay = useMemo(() => {
    if (schedule.startTime && schedule.endTime) {
      return `${schedule.startTime} ~ ${schedule.endTime}`;
    }
    if (schedule.startTime) {
      return `${schedule.startTime} 시작`;
    }
    return "시간 미정";
  }, [schedule.startTime, schedule.endTime]);

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl">📝</div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          콘텐츠를 선택해주세요
        </p>
      </div>
    );
  }

  const contentTypeOption = content.isFreeLearning
    ? FREE_LEARNING_OPTIONS.find((o) => o.type === content.freeLearningType)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          플랜 확인
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          아래 내용을 확인하고 플랜을 생성하세요
        </p>
      </div>

      {/* Summary Card */}
      <div className="overflow-hidden rounded-xl border-2 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-green-200 bg-white px-6 py-4 dark:border-green-800 dark:bg-gray-800">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl text-2xl",
              contentTypeOption?.color || "bg-blue-100"
            )}
          >
            {contentTypeOption?.icon || "📖"}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {content.title}
            </h3>
            {content.isFreeLearning && contentTypeOption && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {contentTypeOption.label}
              </span>
            )}
          </div>
          <CheckCircle className="h-6 w-6 text-green-500" />
        </div>

        {/* Details */}
        <div className="divide-y divide-green-200 dark:divide-green-800">
          {/* Date */}
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                학습 날짜
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formattedDate}
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                학습 시간
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {timeDisplay}
                {content.estimatedMinutes && (
                  <span className="ml-2 text-gray-400">
                    (예상 {content.estimatedMinutes}분)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Repeat */}
          {repeatDescription && (
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Repeat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  반복 설정
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {repeatDescription}
                </div>
              </div>
            </div>
          )}

          {/* Content Type */}
          {content.isFreeLearning && contentTypeOption && (
            <div className="flex items-center gap-4 px-6 py-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  contentTypeOption.color
                )}
              >
                <span className="text-lg">{contentTypeOption.icon}</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  학습 유형
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {contentTypeOption.label}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <h4 className="font-medium text-blue-800 dark:text-blue-300">
          💡 팁
        </h4>
        <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-400">
          <li>• 플랜은 &quot;오늘의 학습&quot; 페이지에서 바로 시작할 수 있어요</li>
          <li>• 타이머로 학습 시간을 기록하면 게이미피케이션 보상을 받을 수 있어요</li>
          <li>• 생성 후에도 캘린더에서 시간을 드래그하여 조정할 수 있어요</li>
        </ul>
      </div>
    </div>
  );
}
