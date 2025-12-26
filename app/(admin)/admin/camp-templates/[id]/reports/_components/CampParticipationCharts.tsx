"use client";

import { useMemo } from "react";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { Card } from "@/components/ui/Card";
import type { CampLearningStats, CampAttendanceStats } from "@/lib/domains/camp/types";

type CampParticipationChartsProps = {
  attendanceStats: CampAttendanceStats | null;
  learningStats: CampLearningStats | null;
};

// 차트 색상 팔레트
const COLORS = [
  "#4F46E5", // indigo-600
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#EC4899", // pink-500
  "#84CC16", // lime-500
];

export function CampParticipationCharts({
  attendanceStats,
  learningStats,
}: CampParticipationChartsProps) {
  // Lazy load recharts
  const { recharts, loading } = useRecharts();

  // 참여자별 학습 시간 데이터 (상위 10명)
  const studyTimeData = useMemo(() => {
    if (!learningStats?.participant_stats) return [];

    return learningStats.participant_stats
      .map((stat) => ({
        name: stat.student_name.length > 6
          ? stat.student_name.slice(0, 6) + "..."
          : stat.student_name,
        fullName: stat.student_name,
        학습시간: Math.round(stat.study_minutes / 60 * 10) / 10, // 시간 단위로 변환
        완료율: stat.plan_completion_rate,
      }))
      .sort((a, b) => b.학습시간 - a.학습시간)
      .slice(0, 10);
  }, [learningStats]);

  // 과목별 학습 시간 분포 (전체 집계)
  const subjectDistributionData = useMemo(() => {
    if (!learningStats?.participant_stats) return [];

    const subjectTotals: Record<string, number> = {};

    learningStats.participant_stats.forEach((stat) => {
      Object.entries(stat.subject_distribution).forEach(([subject, minutes]) => {
        subjectTotals[subject] = (subjectTotals[subject] || 0) + minutes;
      });
    });

    return Object.entries(subjectTotals)
      .map(([subject, minutes]) => ({
        name: subject,
        value: Math.round(minutes / 60 * 10) / 10, // 시간 단위
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // 상위 8개 과목만
  }, [learningStats]);

  // 참여자별 출석률 분포
  const attendanceDistributionData = useMemo(() => {
    if (!attendanceStats?.participant_stats) return [];

    const ranges = [
      { range: "90-100%", min: 90, max: 100, count: 0 },
      { range: "80-89%", min: 80, max: 89, count: 0 },
      { range: "70-79%", min: 70, max: 79, count: 0 },
      { range: "60-69%", min: 60, max: 69, count: 0 },
      { range: "60% 미만", min: 0, max: 59, count: 0 },
    ];

    attendanceStats.participant_stats.forEach((stat) => {
      const rate = stat.attendance_rate || 0;
      for (const range of ranges) {
        if (rate >= range.min && rate <= range.max) {
          range.count++;
          break;
        }
      }
    });

    return ranges.filter((r) => r.count > 0);
  }, [attendanceStats]);

  // 학습 시간 분포 (범위별)
  const studyTimeDistributionData = useMemo(() => {
    if (!learningStats?.participant_stats) return [];

    const ranges = [
      { range: "10시간 이상", min: 600, max: Infinity, count: 0 },
      { range: "5-10시간", min: 300, max: 599, count: 0 },
      { range: "3-5시간", min: 180, max: 299, count: 0 },
      { range: "1-3시간", min: 60, max: 179, count: 0 },
      { range: "1시간 미만", min: 0, max: 59, count: 0 },
    ];

    learningStats.participant_stats.forEach((stat) => {
      const minutes = stat.study_minutes || 0;
      for (const range of ranges) {
        if (minutes >= range.min && minutes <= range.max) {
          range.count++;
          break;
        }
      }
    });

    return ranges.filter((r) => r.count > 0);
  }, [learningStats]);

  const hasLearningData = studyTimeData.length > 0;
  const hasSubjectData = subjectDistributionData.length > 0;
  const hasAttendanceDistribution = attendanceDistributionData.length > 0;

  if (!hasLearningData && !hasSubjectData && !hasAttendanceDistribution) {
    return null;
  }

  // Show loading skeleton while recharts loads
  if (loading || !recharts) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200" />
            <ChartLoadingSkeleton height={320} />
          </Card>
        ))}
      </div>
    );
  }

  // Extract recharts components
  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
  } = recharts;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 참여자별 학습 시간 TOP 10 */}
      {hasLearningData && (
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            참여자별 학습 시간 (상위 10명)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={studyTimeData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" unit="시간" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip
                  formatter={(value: number) => [`${value}시간`, "학습 시간"]}
                  labelFormatter={(label) => {
                    const item = studyTimeData.find((d) => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Bar dataKey="학습시간" fill="#4F46E5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 과목별 학습 시간 분포 */}
      {hasSubjectData && (
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            과목별 학습 시간 분포
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subjectDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                >
                  {subjectDistributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}시간`, "학습 시간"]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 출석률 분포 */}
      {hasAttendanceDistribution && (
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            출석률 분포
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={attendanceDistributionData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis unit="명" />
                <Tooltip formatter={(value: number) => [`${value}명`, "참여자 수"]} />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]}>
                  {attendanceDistributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.range === "90-100%"
                          ? "#10B981"
                          : entry.range === "80-89%"
                            ? "#22C55E"
                            : entry.range === "70-79%"
                              ? "#F59E0B"
                              : entry.range === "60-69%"
                                ? "#F97316"
                                : "#EF4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 학습 시간 분포 */}
      {studyTimeDistributionData.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            학습 시간 분포
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={studyTimeDistributionData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis unit="명" />
                <Tooltip formatter={(value: number) => [`${value}명`, "참여자 수"]} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
