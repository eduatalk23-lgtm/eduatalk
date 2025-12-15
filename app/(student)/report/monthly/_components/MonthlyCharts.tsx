"use client";

import {
  useRecharts,
  ChartLoadingSkeleton,
} from "@/components/charts/LazyRecharts";
import type { MonthlyReport } from "@/lib/reports/monthly";
import { createWidthStyle } from "@/lib/utils/cssVariables";
import { getChartColor } from "@/lib/constants/colors";

type MonthlyChartsProps = {
  reportData: MonthlyReport;
};

export function MonthlyCharts({ reportData }: MonthlyChartsProps) {
  const { recharts, loading } = useRecharts();
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

  if (loading || !recharts) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartLoadingSkeleton height={300} />
        <ChartLoadingSkeleton height={300} />
        <div className="lg:col-span-2">
          <ChartLoadingSkeleton height={300} />
        </div>
      </div>
    );
  }

  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } = recharts;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 주차별 학습시간 */}
      {studyTimeData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-gray-900">주차별 학습시간</h3>
            <div role="img" aria-label={`주차별 학습시간 차트. ${studyTimeData.map(d => `${d.weekNumber}주차: ${d.hours}시간`).join(", ")}`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={studyTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekNumber" label={{ value: "주차", position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: "시간", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill={getChartColor(0)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* 스크린 리더용 데이터 테이블 */}
            <table className="sr-only">
              <caption>주차별 학습시간 데이터</caption>
              <thead>
                <tr>
                  <th>주차</th>
                  <th>학습시간 (시간)</th>
                </tr>
              </thead>
              <tbody>
                {studyTimeData.map((item) => (
                  <tr key={item.weekNumber}>
                    <td>{item.weekNumber}주차</td>
                    <td>{item.hours}시간</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 과목별 학습시간 */}
      {reportData.studyTimeBySubject.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-gray-900">과목별 학습시간</h3>
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
                          style={createWidthStyle((item.minutes / maxMinutes) * 100)}
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
        </div>
      )}

      {/* 주차별 플랜 실행률 */}
      {planCompletionData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-gray-900">주차별 플랜 실행률</h3>
            <div role="img" aria-label={`주차별 플랜 실행률 차트. ${planCompletionData.map(d => `${d.weekNumber}주차: ${d.completionRate}%`).join(", ")}`}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={planCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekNumber" label={{ value: "주차", position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: "실행률 (%)", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="completionRate" stroke={getChartColor(1)} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 스크린 리더용 데이터 테이블 */}
            <table className="sr-only">
              <caption>주차별 플랜 실행률 데이터</caption>
              <thead>
                <tr>
                  <th>주차</th>
                  <th>실행률 (%)</th>
                </tr>
              </thead>
              <tbody>
                {planCompletionData.map((item) => (
                  <tr key={item.weekNumber}>
                    <td>{item.weekNumber}주차</td>
                    <td>{item.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

