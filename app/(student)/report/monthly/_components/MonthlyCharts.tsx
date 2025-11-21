"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import type { MonthlyReport } from "@/lib/reports/monthly";

type MonthlyChartsProps = {
  reportData: MonthlyReport;
};

export function MonthlyCharts({ reportData }: MonthlyChartsProps) {
  // 주차별 학습시간 데이터
  const studyTimeData = reportData.studyTimeByWeek.map((week) => ({
    weekNumber: week.weekNumber,
    hours: week.hours,
  }));
  
  // 주차별 플랜 실행률 데이터
  const planCompletionData = reportData.planCompletionByWeek.map((week) => ({
    weekNumber: week.weekNumber,
    completionRate: week.completionRate,
  }));

  // 성적 변화 데이터
  const scoreData = [
    ...reportData.scores.lastMonth.map((s) => ({
      month: "지난달",
      subject: s.subject,
      grade: s.grade,
    })),
    ...reportData.scores.thisMonth.map((s) => ({
      month: "이번달",
      subject: s.subject,
      grade: s.grade,
    })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 주차별 학습시간 */}
      {studyTimeData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">주차별 학습시간</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={studyTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekNumber" label={{ value: "주차", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "시간", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Bar dataKey="hours" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 과목별 학습시간 */}
      {reportData.studyTimeBySubject.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">과목별 학습시간</h3>
          <div className="space-y-3">
            {reportData.studyTimeBySubject.slice(0, 5).map((item) => {
              const maxMinutes = Math.max(...reportData.studyTimeBySubject.map((s) => s.minutes), 1);
              return (
                <div key={item.subject} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-gray-600">{item.subject}</div>
                  <div className="flex-1">
                    <div className="h-6 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${(item.minutes / maxMinutes) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium text-gray-900">
                    {item.minutes}분
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 주차별 플랜 실행률 */}
      {planCompletionData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">주차별 플랜 실행률</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={planCompletionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekNumber" label={{ value: "주차", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "실행률 (%)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Line type="monotone" dataKey="completionRate" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 성적 변화 */}
      {scoreData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">성적 변화</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis reversed domain={[1, 9]} label={{ value: "등급", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Area type="monotone" dataKey="grade" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

