"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { getRiskColorHex } from "@/lib/constants/colors";

export type SubjectRiskAnalysis = {
  subject: string;
  risk_score: number;
  recent_grade_trend: number;
  consistency_score: number;
  mastery_estimate: number;
  recent3AvgGrade: number;
  gradeChange: number;
  scoreVariance: number;
  improvementRate: number;
};

type RiskIndexListProps = {
  analyses: SubjectRiskAnalysis[];
};

const getTrendIcon = (trend: number): string => {
  if (trend > 0) return "📈"; // 상승
  if (trend < 0) return "📉"; // 하락
  return "➡️"; // 유지
};

const getTrendText = (trend: number): string => {
  if (trend > 0) return "상승";
  if (trend < 0) return "하락";
  return "유지";
};

export function RiskIndexList({ analyses }: RiskIndexListProps) {
  const chartData = analyses.map((a) => ({
    name: a.subject,
    "Risk Index": Math.round(a.risk_score),
  }));

  return (
    <div className="space-y-6">
      {/* Risk Index 차트 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          과목별 Risk Index
        </h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis domain={[0, 100]} label={{ value: "Risk Index", angle: -90, position: "insideLeft" }} />
            <Tooltip
              formatter={(value: number) => [`${value}점`, "Risk Index"]}
            />
            <Legend />
            <Bar dataKey="Risk Index" name="Risk Index">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getRiskColorHex(entry["Risk Index"])}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 취약 과목 리스트 */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">취약 과목 상세 분석</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  과목
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Risk Index
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  등급 추이
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  최근 3회 평균
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  일관성
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  숙련도
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analyses.map((analysis) => (
                <tr key={analysis.subject} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {analysis.subject}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-16 rounded-full"
                        style={{
                          backgroundColor: getRiskColorHex(analysis.risk_score),
                        }}
                      />
                      <span className="font-semibold">
                        {Math.round(analysis.risk_score)}점
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-1">
                      <span>{getTrendIcon(analysis.recent_grade_trend)}</span>
                      <span>{getTrendText(analysis.recent_grade_trend)}</span>
                      {analysis.gradeChange !== 0 && (
                        <span className="text-xs text-gray-500">
                          ({analysis.gradeChange > 0 ? "+" : ""}
                          {analysis.gradeChange.toFixed(1)})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {analysis.recent3AvgGrade > 0
                      ? `${analysis.recent3AvgGrade.toFixed(1)}등급`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{
                            width: `${analysis.consistency_score}%`,
                          }}
                        />
                      </div>
                      <span>{Math.round(analysis.consistency_score)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600"
                          style={{
                            width: `${analysis.mastery_estimate}%`,
                          }}
                        />
                      </div>
                      <span>{Math.round(analysis.mastery_estimate)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href="/plan/new-group"
                      className="inline-flex items-center justify-center rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      학습 플랜 생성
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Index 설명 */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          Risk Index 계산 기준
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <strong>최근 3회 등급 평균 (40%)</strong>: 최근 3번의 시험 등급 평균
          </li>
          <li>
            <strong>등급 하락 패널티 (30%)</strong>: 최근 등급이 하락했을 경우 위험도 증가
          </li>
          <li>
            <strong>원점수 편차 (20%)</strong>: 점수 변동성이 클수록 위험도 증가
          </li>
          <li>
            <strong>개선율 부족 (10%)</strong>: 학습 시간 대비 성취도 개선이 부족할 경우 위험도 증가
          </li>
          <li>
            <strong>Risk Index 70점 이상</strong>: 매우 위험 (즉시 집중 학습 필요)
          </li>
          <li>
            <strong>Risk Index 50-69점</strong>: 위험 (집중 학습 권장)
          </li>
          <li>
            <strong>Risk Index 30-49점</strong>: 주의 (지속적 모니터링 필요)
          </li>
          <li>
            <strong>Risk Index 0-29점</strong>: 양호 (현재 수준 유지)
          </li>
        </ul>
      </div>
    </div>
  );
}

