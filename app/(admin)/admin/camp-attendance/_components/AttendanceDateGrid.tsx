"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { CampTemplate } from "@/lib/domains/camp/types";

type DailyStats = {
  date: string;
  camps: Array<{
    campId: string;
    campName: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    earlyLeave: number;
    total: number;
  }>;
};

type AttendanceDateGridProps = {
  dailyStats: DailyStats[];
  camps: CampTemplate[];
};

export function AttendanceDateGrid({ dailyStats, camps }: AttendanceDateGridProps) {
  // 날짜별로 요일 계산
  const formattedStats = useMemo(() => {
    return dailyStats.map((day) => {
      const date = new Date(day.date);
      const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      return {
        ...day,
        dayOfWeek,
        isWeekend,
        formattedDate: `${date.getMonth() + 1}/${date.getDate()}`,
      };
    });
  }, [dailyStats]);

  if (dailyStats.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">해당 기간에 출석 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <h3 className="font-semibold text-gray-900">날짜별 출석 현황</h3>
        <p className="text-sm text-gray-500">
          각 셀의 숫자는 출석/전체를 나타냅니다.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                캠프
              </th>
              {formattedStats.map((day) => (
                <th
                  key={day.date}
                  className={cn(
                    "border-b border-gray-200 px-2 py-3 text-center text-xs font-medium",
                    day.isWeekend ? "bg-gray-100 text-gray-500" : "text-gray-700"
                  )}
                >
                  <div>{day.formattedDate}</div>
                  <div
                    className={cn(
                      "text-xs",
                      day.dayOfWeek === "일"
                        ? "text-red-500"
                        : day.dayOfWeek === "토"
                        ? "text-blue-500"
                        : "text-gray-400"
                    )}
                  >
                    ({day.dayOfWeek})
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {camps.map((camp) => (
              <tr key={camp.id} className="hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-4 py-3">
                  <div className="font-medium text-gray-900 truncate max-w-[150px]">
                    {camp.name}
                  </div>
                </td>
                {formattedStats.map((day) => {
                  const campStats = day.camps.find((c) => c.campId === camp.id);
                  const present = (campStats?.present || 0) + (campStats?.late || 0);
                  const total = campStats?.total || 0;
                  const rate = total > 0 ? (present / total) * 100 : 0;

                  // 출석률에 따른 색상
                  let bgColor = "bg-gray-50";
                  let textColor = "text-gray-400";

                  if (total > 0) {
                    if (rate >= 90) {
                      bgColor = "bg-green-100";
                      textColor = "text-green-700";
                    } else if (rate >= 70) {
                      bgColor = "bg-yellow-100";
                      textColor = "text-yellow-700";
                    } else if (rate >= 50) {
                      bgColor = "bg-orange-100";
                      textColor = "text-orange-700";
                    } else {
                      bgColor = "bg-red-100";
                      textColor = "text-red-700";
                    }
                  }

                  return (
                    <td
                      key={day.date}
                      className={cn(
                        "border-b border-gray-200 px-2 py-3 text-center",
                        day.isWeekend && "bg-gray-50"
                      )}
                    >
                      {total > 0 ? (
                        <div
                          className={cn(
                            "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium",
                            bgColor,
                            textColor
                          )}
                        >
                          {present}/{total}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500">출석률:</span>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-green-100" />
            <span>90%+</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-yellow-100" />
            <span>70-89%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-orange-100" />
            <span>50-69%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-100" />
            <span>50% 미만</span>
          </div>
        </div>
      </div>
    </div>
  );
}
