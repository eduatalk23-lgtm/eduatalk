"use client";

import { useState } from "react";

type DailyBreakdownSectionProps = {
  breakdown: Array<{
    date: string;
    dayOfWeek: string;
    studyTimeMinutes: number;
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
    contents: Array<{
      contentType: "book" | "lecture" | "custom";
      contentTitle: string;
      subject: string | null;
      studyTimeMinutes: number;
    }>;
  }>;
};

const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
};

export function DailyBreakdownSection({ breakdown }: DailyBreakdownSectionProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const toggleDay = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">요일별 학습 상세</h3>
      <div className="space-y-4">
        {breakdown.map((day) => (
          <div key={day.date} className="rounded-lg border border-gray-200 bg-gray-50">
            <button
              onClick={() => toggleDay(day.date)}
              className="w-full p-4 text-left transition hover:bg-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {day.dayOfWeek} ({new Date(day.date).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })})
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>학습: {day.studyTimeMinutes}분</span>
                    <span>플랜: {day.completedPlans}/{day.totalPlans}</span>
                    <span>실행률: {day.completionRate}%</span>
                  </div>
                </div>
                <span className="text-gray-400">
                  {expandedDay === day.date ? "▼" : "▶"}
                </span>
              </div>
            </button>
            {expandedDay === day.date && (
              <div className="border-t border-gray-200 bg-white p-4">
                {day.contents.length > 0 ? (
                  <div className="space-y-2">
                    {day.contents.map((content, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded border border-gray-200 bg-white p-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{contentTypeLabels[content.contentType]}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {content.contentTitle}
                            </span>
                            {content.subject && (
                              <span className="text-xs text-gray-500">({content.subject})</span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {content.studyTimeMinutes}분
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    학습한 콘텐츠가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

