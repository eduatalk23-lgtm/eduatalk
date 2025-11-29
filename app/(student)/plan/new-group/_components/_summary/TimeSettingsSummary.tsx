"use client";

import React, { useMemo } from "react";
import { Clock, Building2, CalendarX, Utensils } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { SummaryCard } from "./SummaryCard";
import { SectionSummary } from "./SectionSummary";

/**
 * TimeSettingsSummary - 시간 설정 요약
 * 
 * Phase 4.3에서 구현
 * Step 2의 시간 설정을 요약하여 표시
 */

export type TimeSettingsSummaryProps = {
  data: WizardData;
};

export const TimeSettingsSummary = React.memo(function TimeSettingsSummary({
  data,
}: TimeSettingsSummaryProps) {
  // 학원 일정 요일별 그룹핑
  const academyByDay = useMemo(() => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const grouped = new Map<number, number>();
    
    data.academy_schedules.forEach((schedule) => {
      grouped.set(schedule.day_of_week, (grouped.get(schedule.day_of_week) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, count]) => `${days[day]}(${count})`);
  }, [data.academy_schedules]);

  // 제외일 타입별 그룹핑
  const exclusionsByType = useMemo(() => {
    const grouped = new Map<string, number>();
    
    data.exclusions.forEach((exclusion) => {
      grouped.set(
        exclusion.exclusion_type,
        (grouped.get(exclusion.exclusion_type) || 0) + 1
      );
    });

    return Array.from(grouped.entries());
  }, [data.exclusions]);

  const items = [];

  // 학원 일정
  if (data.academy_schedules.length > 0) {
    items.push({
      label: "학원 일정",
      value: `${data.academy_schedules.length}개`,
      icon: <Building2 className="h-4 w-4" />,
    });
    
    if (academyByDay.length > 0) {
      items.push({
        label: "요일별",
        value: academyByDay.join(", "),
      });
    }
  }

  // 제외일
  if (data.exclusions.length > 0) {
    items.push({
      label: "제외일",
      value: `${data.exclusions.length}일`,
      icon: <CalendarX className="h-4 w-4" />,
    });
    
    exclusionsByType.forEach(([type, count]) => {
      items.push({
        label: `  • ${type}`,
        value: `${count}일`,
      });
    });
  }

  // 시간 설정
  if (data.time_settings) {
    const ts = data.time_settings;

    if (ts.lunch_time) {
      items.push({
        label: "점심 시간",
        value: `${ts.lunch_time.start} ~ ${ts.lunch_time.end}`,
        icon: <Utensils className="h-4 w-4" />,
      });
    }

    if (ts.camp_study_hours) {
      items.push({
        label: "캠프 학습 시간",
        value: `${ts.camp_study_hours.start} ~ ${ts.camp_study_hours.end}`,
        icon: <Clock className="h-4 w-4" />,
      });
    }

    if (ts.camp_self_study_hours) {
      items.push({
        label: "자율 학습 시간",
        value: `${ts.camp_self_study_hours.start} ~ ${ts.camp_self_study_hours.end}`,
      });
    }

    if (ts.designated_holiday_hours) {
      items.push({
        label: "지정 휴일 시간",
        value: `${ts.designated_holiday_hours.start} ~ ${ts.designated_holiday_hours.end}`,
      });
    }
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          학원 일정이나 제외일이 설정되지 않았습니다
        </p>
        <p className="mt-1 text-xs text-gray-500">
          모든 날짜에 학습이 배정됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          title="학원 일정"
          value={data.academy_schedules.length}
          subtitle="개"
          icon={<Building2 className="h-5 w-5" />}
          variant={data.academy_schedules.length > 0 ? "primary" : "default"}
        />
        <SummaryCard
          title="제외일"
          value={data.exclusions.length}
          subtitle="일"
          icon={<CalendarX className="h-5 w-5" />}
          variant={data.exclusions.length > 0 ? "warning" : "default"}
        />
      </div>

      {/* 상세 정보 */}
      <SectionSummary items={items} variant="compact" />
    </div>
  );
});

