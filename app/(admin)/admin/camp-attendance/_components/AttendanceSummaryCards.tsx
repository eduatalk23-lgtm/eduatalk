"use client";

import { Users, CheckCircle2, Clock, XCircle, Building2 } from "lucide-react";
import { cn } from "@/lib/cn";

type AttendanceSummaryCardsProps = {
  summary: {
    totalCamps: number;
    totalParticipants: number;
    overallAttendanceRate: number;
    overallLateRate: number;
    overallAbsentRate: number;
  };
  camps: Array<{
    id: string;
    name: string;
    attendanceRate: number;
  }>;
};

export function AttendanceSummaryCards({
  summary,
  camps,
}: AttendanceSummaryCardsProps) {
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
      label: "출석률",
      value: summary.overallAttendanceRate,
      unit: "%",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "지각률",
      value: summary.overallLateRate,
      unit: "%",
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "결석률",
      value: summary.overallAbsentRate,
      unit: "%",
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
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
                <span className="text-sm font-normal text-gray-400">
                  {card.unit}
                </span>
              </p>
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
