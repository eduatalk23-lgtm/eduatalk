"use client";

import { Calendar, Clock, XCircle, BookOpen, RotateCcw } from "lucide-react";
import { formatNumber } from "@/lib/utils/formatNumber";
import type { ScheduleSummaryStatsProps } from "./types";

/**
 * 스케줄 요약 통계 그리드
 */
export function ScheduleSummaryStats({ summary }: ScheduleSummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <span className="text-xs font-medium text-gray-600">총 기간</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{summary.total_days}</p>
        <p className="text-xs text-gray-600">일</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-400" />
          <span className="text-xs font-medium text-gray-600">제외일</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {summary.total_exclusion_days.휴가 +
            summary.total_exclusion_days.개인사정 +
            summary.total_exclusion_days.지정휴일}
        </p>
        <p className="text-xs text-gray-600">일</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <span className="text-xs font-medium text-blue-800">학습일</span>
        </div>
        <p className="text-2xl font-bold text-blue-800">
          {summary.total_study_days}
        </p>
        <p className="text-xs text-blue-800">일</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-green-500" />
          <span className="text-xs font-medium text-green-700">복습일</span>
        </div>
        <p className="text-2xl font-bold text-green-900">
          {summary.total_review_days}
        </p>
        <p className="text-xs text-green-600">일</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          <span className="text-xs font-medium text-gray-600">
            총 학습 시간
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {formatNumber(Math.round(summary.total_study_hours))}
        </p>
        <p className="text-xs text-gray-600">시간</p>
      </div>
    </div>
  );
}
