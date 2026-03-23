"use client";

import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { GRADE_5_TO_9_MAP } from "@/lib/domains/student-record/constants";

interface ScoreSectionProps {
  internalAnalysis: InternalAnalysis;
  internalScores: InternalScoreWithRelations[];
}

export function ScoreSection({
  internalAnalysis,
  internalScores,
}: ScoreSectionProps) {
  const { totalGpa, adjustedGpa, zIndex, subjectStrength } = internalAnalysis;

  // GPA 표시: totalGpa 우선, null이면 adjustedGpa
  const primaryGpa = totalGpa ?? adjustedGpa;
  const gpaLabel =
    totalGpa != null
      ? "석차등급 기준"
      : adjustedGpa != null
        ? "조정등급 기준"
        : null;

  // 교과군별 성적
  const subjectGroups = Object.entries(subjectStrength).sort(
    ([, a], [, b]) => a - b,
  );

  // 과목별 상세 (학년/학기 정렬)
  const sorted = [...internalScores].sort((a, b) => {
    if (a.grade !== b.grade) return (a.grade ?? 0) - (b.grade ?? 0);
    if (a.semester !== b.semester) return (a.semester ?? 0) - (b.semester ?? 0);
    return 0;
  });

  // 학기별 GPA 추이 데이터
  const trendData = useMemo(() => {
    const termMap = new Map<string, { sum: number; count: number }>();
    for (const s of internalScores) {
      if (s.converted_grade_9 == null || !s.grade || !s.semester) continue;
      const key = `${s.grade}-${s.semester}`;
      const entry = termMap.get(key) ?? { sum: 0, count: 0 };
      entry.sum += s.converted_grade_9;
      entry.count++;
      termMap.set(key, entry);
    }
    return Array.from(termMap.entries())
      .map(([key, { sum, count }]) => ({
        term: key.replace("-", "학년 ") + "학기",
        평균등급: Number((sum / count).toFixed(2)),
      }))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [internalScores]);

  // 교과군별 BarChart 데이터
  const subjectBarData = useMemo(() => {
    return subjectGroups.map(([name, gpa]) => ({
      교과군: name.length > 4 ? name.slice(0, 4) + "…" : name,
      fullName: name,
      평균등급: Number(gpa.toFixed(2)),
    }));
  }, [subjectGroups]);

  return (
    <section className="print-break-before">
      <h2 className="mb-4 border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        교과 성적 분석
      </h2>

      {/* GPA 요약 */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryCard
          label="내신 평균등급"
          value={primaryGpa != null ? primaryGpa.toFixed(2) : "산출 불가"}
          sub={gpaLabel}
        />
        <SummaryCard
          label="조정등급 평균"
          value={adjustedGpa != null ? adjustedGpa.toFixed(2) : "-"}
        />
        <SummaryCard
          label="학업역량 Z-Index"
          value={zIndex != null ? zIndex.toFixed(2) : "-"}
        />
      </div>

      {/* 등급 추이 차트 — 인쇄 규격: A4 내 고정 높이 */}
      {trendData.length > 1 && (
        <div className="mb-6 print-avoid-break" style={{ height: 220 }}>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">학기별 평균등급 추이</h3>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="term" tick={{ fontSize: 11 }} />
              <YAxis domain={[1, 9]} reversed tick={{ fontSize: 11 }} label={{ value: "등급", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip />
              <Line type="monotone" dataKey="평균등급" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 교과군별 성적 바 차트 */}
      {subjectBarData.length > 1 && (
        <div className="mb-6 print-avoid-break" style={{ height: 220 }}>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">교과군별 평균등급</h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={subjectBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="교과군" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} label={{ value: "등급", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip formatter={(value: number, _name: string, props: { payload: { fullName: string } }) => [value, props.payload.fullName]} />
              <Bar dataKey="평균등급" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 교과군별 GPA 테이블 */}
      {subjectGroups.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            교과군별 평균등급
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-700">
                  교과군
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">
                  평균등급
                </th>
              </tr>
            </thead>
            <tbody>
              {subjectGroups.map(([name, gpa]) => (
                <tr key={name} className="border-b border-gray-200">
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-right">{gpa.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 과목별 상세 */}
      {sorted.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            과목별 성적
          </h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  학년
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  학기
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  과목
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  교과군
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  원등급
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  9등급 환산
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  조정등급
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  추정백분위
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((score) => {
                const subjectName =
                  (score.subject as unknown as { name: string } | null)?.name ??
                  "-";
                const groupName =
                  (
                    score.subject_group as unknown as {
                      name: string;
                    } | null
                  )?.name ?? "-";

                // 원등급 표시: 성취도 있으면 5등급 체계, 없으면 9등급
                let originalDisplay: string;
                if (score.achievement_level && !score.rank_grade) {
                  const level = score.achievement_level.toUpperCase();
                  const approx = GRADE_5_TO_9_MAP[level]?.typical;
                  originalDisplay = approx
                    ? `${level}(≈${approx}등급)`
                    : level;
                } else if (score.rank_grade != null) {
                  originalDisplay = `${score.rank_grade}등급`;
                } else {
                  originalDisplay = "-";
                }

                // 9등급 환산
                const converted9 =
                  score.converted_grade_9 != null
                    ? score.converted_grade_9.toFixed(1)
                    : "-";

                return (
                  <tr
                    key={score.id}
                    className="border-b border-gray-100"
                  >
                    <td className="px-2 py-1.5">{score.grade}</td>
                    <td className="px-2 py-1.5">{score.semester}</td>
                    <td className="px-2 py-1.5">{subjectName}</td>
                    <td className="px-2 py-1.5">{groupName}</td>
                    <td className="px-2 py-1.5 text-center">
                      {originalDisplay}
                    </td>
                    <td className="px-2 py-1.5 text-center">{converted9}</td>
                    <td className="px-2 py-1.5 text-center">
                      {score.adjusted_grade != null
                        ? score.adjusted_grade.toFixed(2)
                        : "-"}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {score.estimated_percentile != null
                        ? `${score.estimated_percentile.toFixed(1)}%`
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">내신 성적 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">성적을 입력하면 등급 추이 차트, 교과군별 분석이 자동 생성됩니다.</p>
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 print-avoid-break">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
