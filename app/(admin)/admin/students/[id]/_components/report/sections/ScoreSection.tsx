"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
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

  // X-2: 교과군별 개별 차트 데이터 (엑셀 "P교과분석" 시트 재현)
  const subjectGroupCharts = useMemo(() => {
    // subject_group별 그룹핑
    const groups = new Map<string, InternalScoreWithRelations[]>();
    for (const s of internalScores) {
      const groupName = s.subject_group?.name ?? s.subject?.name ?? "기타";
      const list = groups.get(groupName) ?? [];
      list.push(s);
      groups.set(groupName, list);
    }

    // 각 그룹에서 학기별 과목별 데이터 생성
    const TARGET_GROUPS = ["국어", "영어", "수학", "사회", "과학", "기타"];
    const result: Array<{
      groupName: string;
      data: Array<Record<string, string | number>>;
      subjects: string[];
    }> = [];

    for (const targetGroup of TARGET_GROUPS) {
      // 해당 그룹명을 포함하는 과목들 찾기
      const groupScores = [...groups.entries()]
        .filter(([name]) => name.includes(targetGroup) || (targetGroup === "기타" && !TARGET_GROUPS.slice(0, 5).some((g) => name.includes(g))))
        .flatMap(([, scores]) => scores);

      if (groupScores.length === 0) continue;

      // 학기별 그룹핑
      const semesterMap = new Map<string, Map<string, number>>();
      const subjectSet = new Set<string>();

      for (const s of groupScores) {
        if (!s.grade || !s.semester || s.rank_grade == null) continue;
        const semKey = `${s.grade}-${s.semester}`;
        const subName = s.subject?.name ?? "과목";
        subjectSet.add(subName);

        const sem = semesterMap.get(semKey) ?? new Map();
        sem.set(subName, s.rank_grade);
        semesterMap.set(semKey, sem);
      }

      const semesters = [...semesterMap.keys()].sort();
      const subjects = [...subjectSet].sort();

      const data = semesters.map((sem) => {
        const row: Record<string, string | number> = {
          semester: sem.replace("-", "학년 ") + "학기",
        };
        const values = semesterMap.get(sem)!;
        let sum = 0;
        let count = 0;
        for (const subj of subjects) {
          const val = values.get(subj);
          if (val != null) {
            row[subj] = val;
            sum += val;
            count++;
          }
        }
        if (count > 0) row["평균"] = Number((sum / count).toFixed(2));
        return row;
      });

      result.push({ groupName: targetGroup + " 교과", data, subjects });
    }

    return result;
  }, [internalScores]);

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={BarChart3} title="교과 성적 분석" subtitle="내신 추이 · 교과군별 분석" />

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
        <div className="mb-6 h-[220px] print-avoid-break">
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
        <div className="mb-6 h-[220px] print-avoid-break">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">교과군별 평균등급</h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={subjectBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="교과군" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} label={{ value: "등급", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip formatter={(value: number, _name: string, props: { payload?: { fullName?: string } }) => [value, props.payload?.fullName ?? _name]} />
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

      {/* 과목별 상세 — 학년별 그룹핑, 데이터 있는 컬럼만 표시 */}
      {sorted.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">과목별 성적</h3>
          {(() => {
            // 데이터 유무로 컬럼 표시 결정
            const hasConverted9 = sorted.some((s) => s.converted_grade_9 != null);
            const hasAdjusted = sorted.some((s) => s.adjusted_grade != null);
            const hasPercentile = sorted.some((s) => s.estimated_percentile != null);

            // 학년별 그룹핑
            const byGrade = new Map<number, typeof sorted>();
            for (const s of sorted) {
              const g = s.grade ?? 0;
              if (!byGrade.has(g)) byGrade.set(g, []);
              byGrade.get(g)!.push(s);
            }

            return Array.from(byGrade.entries()).map(([grade, scores]) => (
              <div key={grade} className="mb-4 print-avoid-break">
                <h4 className="mb-1 text-xs font-semibold text-indigo-600">{grade}학년</h4>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <th className="px-2 py-1 text-left font-medium text-gray-600">학기</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-600">과목</th>
                      <th className="px-2 py-1 text-left font-medium text-gray-600">교과군</th>
                      <th className="px-2 py-1 text-center font-medium text-gray-600">등급</th>
                      {hasConverted9 && <th className="px-2 py-1 text-center font-medium text-gray-600">9등급</th>}
                      {hasAdjusted && <th className="px-2 py-1 text-center font-medium text-gray-600">조정</th>}
                      {hasPercentile && <th className="px-2 py-1 text-center font-medium text-gray-600">백분위</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score) => {
                      const subjectName = (score.subject as unknown as { name: string } | null)?.name ?? "-";
                      const groupName = (score.subject_group as unknown as { name: string } | null)?.name ?? "-";
                      let gradeDisplay: string;
                      if (score.achievement_level && !score.rank_grade) {
                        const level = score.achievement_level.toUpperCase();
                        const approx = GRADE_5_TO_9_MAP[level]?.typical;
                        gradeDisplay = approx ? `${level}(≈${approx})` : level;
                      } else if (score.rank_grade != null) {
                        gradeDisplay = `${score.rank_grade}`;
                      } else {
                        gradeDisplay = "-";
                      }
                      return (
                        <tr key={score.id} className="border-b border-gray-100">
                          <td className="px-2 py-1">{score.semester}</td>
                          <td className="px-2 py-1">{subjectName}</td>
                          <td className="px-2 py-1 text-gray-500">{groupName}</td>
                          <td className="px-2 py-1 text-center font-medium">{gradeDisplay}</td>
                          {hasConverted9 && <td className="px-2 py-1 text-center">{score.converted_grade_9?.toFixed(1) ?? "-"}</td>}
                          {hasAdjusted && <td className="px-2 py-1 text-center">{score.adjusted_grade?.toFixed(2) ?? "-"}</td>}
                          {hasPercentile && <td className="px-2 py-1 text-center">{score.estimated_percentile != null ? `${score.estimated_percentile.toFixed(1)}%` : "-"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ));
          })()}
        </div>
      )}

      {/* X-2: 교과군별 개별 차트 (엑셀 P교과분석 시트) */}
      {subjectGroupCharts.length > 0 && (
        <div className="mt-8">
          <h3 className="report-subtitle mb-4">교과군별 성취도 추이</h3>
          <div className="grid grid-cols-2 gap-4">
            {subjectGroupCharts.map(({ groupName, data, subjects }) => (
              <div key={groupName} className="rounded-lg border border-gray-200 p-3 print-avoid-break">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">{groupName}</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="semester" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 9]} reversed tick={{ fontSize: 9 }} tickCount={5} />
                    <Tooltip contentStyle={{ fontSize: 10 }} />
                    {subjects.map((subj, si) => (
                      <Bar
                        key={subj}
                        dataKey={subj}
                        fill={si === 0 ? "#d1d5db" : si === 1 ? "#e5e7eb" : "#f3f4f6"}
                        radius={[2, 2, 0, 0]}
                        maxBarSize={20}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="평균"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f59e0b" }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">내신 성적 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-500">성적을 입력하면 등급 추이 차트, 교과군별 분석이 자동 생성됩니다.</p>
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
    <div className="rounded-lg border border-gray-300 p-3 shadow-sm print-avoid-break">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
