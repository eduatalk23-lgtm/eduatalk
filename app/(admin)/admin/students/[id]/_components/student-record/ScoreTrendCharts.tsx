"use client";

import { useQuery } from "@tanstack/react-query";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";

type ScoreTrendChartsProps = {
  studentId: string;
  tenantId: string;
};

/**
 * 내신 GPA 추이 + 모의고사 백분위 추이 차트.
 * 생기부 기록탭 sec-7에 표시.
 */
export function ScoreTrendCharts({ studentId, tenantId }: ScoreTrendChartsProps) {
  const { recharts, loading: chartsLoading } = useRecharts();

  const { data, isLoading } = useQuery({
    queryKey: ["scoreTrends", studentId, tenantId],
    queryFn: async () => {
      const { fetchScoreTrendsAction } = await import("@/lib/domains/score/actions/core");
      return fetchScoreTrendsAction(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading || chartsLoading || !recharts) {
    return <ChartLoadingSkeleton height={160} />;
  }

  if (!data) return null;

  const hasGpa = data.gpaByTerm.length >= 2;
  const hasMock = data.mockTrend.length >= 2;

  if (!hasGpa && !hasMock) return null;

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } = recharts;

  return (
    <div className="flex flex-col gap-4">
      {hasGpa && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">내신 등급 추이</h4>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.gpaByTerm} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                <YAxis domain={[1, 9]} reversed tick={{ fontSize: 11 }} width={25} />
                <Tooltip
                  formatter={(value: number) => [`${value}등급`, "평균 등급"]}
                  labelFormatter={(label: string) => {
                    const [g, s] = label.split("-");
                    return `${g}학년 ${s}학기`;
                  }}
                />
                <Line type="monotone" dataKey="gpa" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="평균등급" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasMock && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">모의고사 평균 백분위 추이</h4>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.mockTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="exam_date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}월`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "평균 백분위"]}
                  labelFormatter={(_: unknown, payload: Array<{ payload?: { exam_title?: string } }>) =>
                    payload?.[0]?.payload?.exam_title ?? ""
                  }
                />
                <Line type="monotone" dataKey="percentile" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="백분위" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
