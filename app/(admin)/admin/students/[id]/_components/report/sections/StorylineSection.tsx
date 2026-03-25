"use client";

import { GitBranch } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { StorylineTabData, RecordTabData } from "@/lib/domains/student-record/types";
import { STRENGTH_BADGE } from "../constants";
import { ReportMarkdown } from "../ReportMarkdown";

// 6색 팔레트: indigo 계열 + semantic
const RECORD_TYPE_COLORS: Record<string, string> = {
  세특: "#4f46e5",      // indigo-600
  개인세특: "#818cf8",   // indigo-400
  창체: "#059669",      // emerald-600
  독서: "#f59e0b",      // amber-500
  행특: "#6b7280",      // gray-500
};
const GRADE_COLORS = ["#4f46e5", "#818cf8", "#a5b4fc"]; // indigo 600→400→300

const AREA_LABELS: Record<string, string> = {
  autonomy: "자율·자치",
  club: "동아리",
  career: "진로",
  setek: "세특",
  personal_setek: "개인세특",
  reading: "독서",
  course_selection: "교과선택",
};

interface StorylineSectionProps {
  storylineData: StorylineTabData;
  studentGrade: number;
  recordDataByGrade?: Record<number, RecordTabData>;
}

export function StorylineSection({
  storylineData,
  studentGrade,
  recordDataByGrade,
}: StorylineSectionProps) {
  const { storylines, roadmapItems } = storylineData;

  // P1-3: 활동 분포 데이터
  const { typeDistribution, gradeDistribution } = useMemo(() => {
    if (!recordDataByGrade) return { typeDistribution: [], gradeDistribution: [] };

    const typeCounts: Record<string, number> = { 세특: 0, 개인세특: 0, 창체: 0, 독서: 0, 행특: 0 };
    const gradeCounts: Array<{ name: string; count: number }> = [];

    for (let g = 1; g <= studentGrade; g++) {
      const data = recordDataByGrade[g];
      if (!data) { gradeCounts.push({ name: `${g}학년`, count: 0 }); continue; }
      const setekCount = (data.seteks ?? []).filter((s) => s.content).length;
      const personalCount = (data.personalSeteks ?? []).filter((s) => s.content).length;
      const changcheCount = (data.changche ?? []).filter((c) => c.content).length;
      const readingCount = (data.readings ?? []).length;
      const haengteukCount = data.haengteuk?.content ? 1 : 0;

      typeCounts["세특"] += setekCount;
      typeCounts["개인세특"] += personalCount;
      typeCounts["창체"] += changcheCount;
      typeCounts["독서"] += readingCount;
      typeCounts["행특"] += haengteukCount;

      gradeCounts.push({
        name: `${g}학년`,
        count: setekCount + personalCount + changcheCount + readingCount + haengteukCount,
      });
    }

    return {
      typeDistribution: Object.entries(typeCounts)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, color: RECORD_TYPE_COLORS[name] ?? "#6b7280" })),
      gradeDistribution: gradeCounts,
    };
  }, [recordDataByGrade, studentGrade]);

  if (storylines.length === 0 && roadmapItems.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={GitBranch} title="스토리라인" subtitle="3년 성장 서사 · 활동 분포 · 로드맵" />
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">스토리라인이 아직 등록되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-500">3년간 성장 서사를 구성하면 테마별 연결과 로드맵이 표시됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={GitBranch} title="스토리라인" subtitle="3년 성장 서사 · 활동 분포 · 로드맵" />

      {/* P1-3: 활동 분포 시각화 */}
      {typeDistribution.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 print-avoid-break md:grid-cols-2">
          {/* 유형별 도넛 */}
          <div>
            <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">활동 유형 분포</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={65}
                  dataKey="value"
                  label={({ name, value }: { name?: string; value: number }) => `${name ?? ""} ${value}`}
                  labelLine={false}
                >
                  {typeDistribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v}건`, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-2">
              {typeDistribution.map((d) => (
                <span key={d.name} className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </div>

          {/* 학년별 활동 건수 바 차트 */}
          <div>
            <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">학년별 활동 건수</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gradeDistribution} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v}건`, ""]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {gradeDistribution.map((_, i) => (
                    <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 스토리라인 카드 */}
      <div className="space-y-5 pt-4">
        {storylines.map((sl) => {
          const badge = STRENGTH_BADGE[sl.strength ?? "moderate"];
          const linkedItems = roadmapItems.filter(
            (r) => r.storyline_id === sl.id,
          );

          return (
            <div
              key={sl.id}
              className="rounded-lg border border-gray-300 p-4 shadow-sm print-avoid-break"
            >
              {/* 제목 + 배지 */}
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {sl.title}
                </h3>
                {badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                )}
                {sl.career_field && (
                  <span className="text-xs text-gray-500">
                    {sl.career_field}
                  </span>
                )}
              </div>

              {/* 키워드 */}
              {sl.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {sl.keywords.map((kw: string, i: number) => (
                    <span
                      key={i}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* 학년별 테마 타임라인 */}
              {(sl.grade_1_theme || sl.grade_2_theme || sl.grade_3_theme) && (
                <div className="flex gap-2 pt-3">
                  {[
                    { grade: 1, theme: sl.grade_1_theme },
                    { grade: 2, theme: sl.grade_2_theme },
                    { grade: 3, theme: sl.grade_3_theme },
                  ]
                    .filter((t) => t.grade <= studentGrade)
                    .map((t) => (
                      <div
                        key={t.grade}
                        className="flex-1 rounded bg-gray-50 p-2"
                      >
                        <p className="text-xs font-medium text-gray-500">
                          {t.grade}학년
                        </p>
                        <p className="text-sm text-gray-800">
                          {t.theme || "-"}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {/* 서술 */}
              {sl.narrative && (
                <ReportMarkdown className="pt-3">{sl.narrative}</ReportMarkdown>
              )}

              {/* 연결된 로드맵 아이템 */}
              {linkedItems.length > 0 && (
                <div className="pt-3">
                  {/* P3-5: 로드맵 진행률 프로그레스 바 */}
                  {(() => {
                    const executed = linkedItems.filter((i) => i.execution_content).length;
                    const pct = Math.round((executed / linkedItems.length) * 100);
                    return (
                      <div className="mb-2 flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-500">
                          로드맵 ({executed}/{linkedItems.length})
                        </p>
                        <div className="h-2 flex-1 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">{pct}%</span>
                      </div>
                    );
                  })()}
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-1 text-left text-gray-500">
                          학년
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          영역
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          계획
                        </th>
                        <th className="px-2 py-1 text-left text-gray-500">
                          실행
                        </th>
                        <th className="px-2 py-1 text-center text-gray-500">
                          일치
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedItems
                        .sort((a, b) => a.grade - b.grade)
                        .map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100"
                          >
                            <td className="px-2 py-1">{item.grade}</td>
                            <td className="px-2 py-1">
                              {AREA_LABELS[item.area] ?? item.area}
                            </td>
                            <td className="px-2 py-1">{item.plan_content}</td>
                            <td className="px-2 py-1">
                              {item.execution_content ?? "-"}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {item.match_rate != null ? (
                                <div className="flex items-center gap-1">
                                  <div className="h-1 w-10 rounded-full bg-gray-200">
                                    <div
                                      className={`h-1 rounded-full ${item.match_rate >= 70 ? "bg-emerald-500" : item.match_rate >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                                      style={{ width: `${item.match_rate}%` }}
                                    />
                                  </div>
                                  <span className="text-xs">{item.match_rate}%</span>
                                </div>
                              ) : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
