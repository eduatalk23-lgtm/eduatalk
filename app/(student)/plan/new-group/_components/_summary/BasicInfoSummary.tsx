"use client";

import React, { useMemo } from "react";
import { Calendar, Target, Settings } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { SectionSummary } from "./SectionSummary";

/**
 * BasicInfoSummary - 기본 정보 요약
 * 
 * Phase 4.3에서 구현
 * Step 1의 기본 정보를 요약하여 표시
 */

export type BasicInfoSummaryProps = {
  data: WizardData;
};

export const BasicInfoSummary = React.memo(function BasicInfoSummary({
  data,
}: BasicInfoSummaryProps) {
  // 학습 기간 계산
  const periodDays = useMemo(() => {
    if (!data.period_start || !data.period_end) return 0;
    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [data.period_start, data.period_end]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 목적 한글화
  const purposeLabel = {
    "내신대비": "내신 대비",
    "모의고사(수능)": "모의고사/수능 대비",
    "": "미설정",
  }[data.plan_purpose] || data.plan_purpose;

  // 스케줄러 타입 한글화
  const schedulerLabel = {
    "1730_timetable": "1730 타임테이블",
    "": "미설정",
  }[data.scheduler_type] || data.scheduler_type;

  const items = [
    {
      label: "플랜 이름",
      value: data.name || "미설정",
      icon: <Settings className="h-4 w-4" />,
      highlight: !!data.name,
    },
    {
      label: "학습 목적",
      value: purposeLabel,
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: "학습 기간",
      value: data.period_start && data.period_end
        ? `${formatDate(data.period_start)} ~ ${formatDate(data.period_end)}`
        : "미설정",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      label: "총 일수",
      value: periodDays > 0 ? `${periodDays}일` : "미설정",
    },
    {
      label: "스케줄러",
      value: schedulerLabel,
    },
  ];

  // 1730 Timetable 옵션
  if (data.scheduler_type === "1730_timetable" && data.scheduler_options) {
    if (data.scheduler_options.study_days) {
      items.push({
        label: "학습일 수",
        value: `${data.scheduler_options.study_days}일`,
      });
    }
    if (data.scheduler_options.review_days) {
      items.push({
        label: "복습일 수",
        value: `${data.scheduler_options.review_days}일`,
      });
    }
  }

  // 목표일 (선택)
  if (data.target_date) {
    items.push({
      label: "목표일",
      value: formatDate(data.target_date),
      icon: <Target className="h-4 w-4" />,
    });
  }

  return (
    <div className="space-y-4">
      <SectionSummary items={items} />
    </div>
  );
});

