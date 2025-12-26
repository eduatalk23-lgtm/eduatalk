"use client";

import {
  Users,
  CheckCircle2,
  PlayCircle,
  Clock,
  BarChart3,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/cn";

type PlanSummaryCardsProps = {
  summary: {
    totalCamps: number;
    totalParticipants: number;
    totalPlans: number;
    completedPlans: number;
    inProgressPlans: number;
    notStartedPlans: number;
    overallCompletionRate: number;
    totalStudyMinutes: number;
  };
  camps: Array<{
    id: string;
    name: string;
    planCompletionRate: number;
  }>;
};

export function PlanSummaryCards({ summary, camps }: PlanSummaryCardsProps) {
  // 학습 시간 포맷
  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  const cards = [
    {
      label: "선택된 캠프",
      value: summary.totalCamps,
      unit: "개",
      icon: Building2,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "전체 참여자",
      value: summary.totalParticipants,
      unit: "명",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "플랜 완료율",
      value: summary.overallCompletionRate,
      unit: "%",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      subtitle: `${summary.completedPlans}/${summary.totalPlans}`,
    },
    {
      label: "진행 중",
      value: summary.inProgressPlans,
      unit: "개",
      icon: PlayCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "총 학습시간",
      value: formatStudyTime(summary.totalStudyMinutes),
      unit: "",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={cn("mt-1 text-2xl font-bold", card.color)}>
                {card.value}
                {card.unit && (
                  <span className="text-sm font-normal text-gray-400">
                    {card.unit}
                  </span>
                )}
              </p>
              {card.subtitle && (
                <p className="text-xs text-gray-400">{card.subtitle}</p>
              )}
            </div>
            <div className={cn("rounded-lg p-3", card.bgColor)}>
              <card.icon className={cn("h-6 w-6", card.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
