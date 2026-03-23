"use client";

import { useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import type {
  DiagnosisTabData,
  ActivityTag,
} from "@/lib/domains/student-record/types";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
  COMPETENCY_RUBRIC_QUESTIONS,
} from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";
import { aggregateTagsByQuestion } from "@/lib/domains/student-record/rubric-matcher";

const GRADE_TO_NUM: Record<string, number> = { "A+": 5, "A-": 4, "B+": 3, "B": 2, "B-": 1, "C": 0 };
const AREA_COLORS: Record<string, string> = { academic: "#6366f1", career: "#8b5cf6", community: "#10b981" };

interface CompetencySectionProps {
  diagnosisData: DiagnosisTabData;
}

export function CompetencySection({ diagnosisData }: CompetencySectionProps) {
  const { competencyScores, activityTags } = diagnosisData;
  const aiScores = competencyScores.ai;
  const consultantScores = competencyScores.consultant;

  // 점수 + narrative 매핑
  const aiMap = useMemo(
    () => new Map(aiScores.map((s) => [s.competency_item, s])),
    [aiScores],
  );
  const consultantMap = useMemo(
    () => new Map(consultantScores.map((s) => [s.competency_item, s])),
    [consultantScores],
  );

  // 역량별 활동태그 집계 + evidence_summary 수집
  const tagsByItem = useMemo(() => {
    const map = new Map<
      string,
      { positive: number; negative: number; evidences: string[] }
    >();
    for (const tag of activityTags) {
      const entry = map.get(tag.competency_item) ?? {
        positive: 0,
        negative: 0,
        evidences: [],
      };
      if (tag.evaluation === "positive") entry.positive++;
      else if (tag.evaluation === "negative") entry.negative++;
      if (tag.evidence_summary) entry.evidences.push(tag.evidence_summary);
      map.set(tag.competency_item, entry);
    }
    return map;
  }, [activityTags]);

  const hasAnyData = aiScores.length > 0 || consultantScores.length > 0;
  const areas = ["academic", "career", "community"] as const;

  // 레이더 차트 데이터 (컨설턴트 우선, AI fallback)
  const radarData = useMemo(() =>
    COMPETENCY_ITEMS.map((item) => {
      const conScore = consultantMap.get(item.code);
      const aiScore = aiMap.get(item.code);
      const score = conScore ?? aiScore;
      return {
        item: item.label,
        점수: score?.grade_value ? (GRADE_TO_NUM[score.grade_value] ?? 0) : 0,
        fullMark: 5,
      };
    }),
  [consultantMap, aiMap]);

  // 영역별 도넛 데이터
  const donutData = useMemo(() => {
    const areaTotals = new Map<string, { sum: number; count: number }>();
    for (const item of COMPETENCY_ITEMS) {
      const score = consultantMap.get(item.code) ?? aiMap.get(item.code);
      const val = score?.grade_value ? (GRADE_TO_NUM[score.grade_value] ?? 0) : 0;
      const entry = areaTotals.get(item.area) ?? { sum: 0, count: 0 };
      entry.sum += val;
      entry.count++;
      areaTotals.set(item.area, entry);
    }
    return areas.map((area) => {
      const entry = areaTotals.get(area);
      return {
        name: COMPETENCY_AREA_LABELS[area],
        value: entry ? Number((entry.sum / entry.count).toFixed(1)) : 0,
        color: AREA_COLORS[area],
      };
    });
  }, [consultantMap, aiMap]);

  return (
    <section className="print-break-before">
      <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        정성 평가 (역량 분석)
      </h2>

      {!hasAnyData ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">역량 평가 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">AI 역량 분석을 실행하면 레이더 차트와 역량별 상세 분석이 생성됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {/* 역량 시각화 — 레이더 + 도넛 */}
          <div className="grid grid-cols-2 gap-4 print-avoid-break" style={{ height: 280 }}>
            {/* 레이더 차트 (10개 역량) */}
            <div style={{ height: 260 }}>
              <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">역량 프로필</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="item" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />
                  <Radar dataKey="점수" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 영역별 도넛 차트 */}
            <div style={{ height: 260 }}>
              <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">영역별 평균</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    dataKey="value"
                    label={({ name, value }: { name: string; value: number }) => `${name} ${value}`}
                    labelLine={false}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3">
                {donutData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 등급 요약 테이블 */}
          <div className="print-avoid-break">
            <h3 className="text-sm font-semibold text-gray-800">
              10항목 등급 요약
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                    영역
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                    항목
                  </th>
                  <th className="w-16 px-2 py-1.5 text-center font-medium text-gray-700">
                    AI
                  </th>
                  <th className="w-16 px-2 py-1.5 text-center font-medium text-gray-700">
                    컨설턴트
                  </th>
                  <th className="w-20 px-2 py-1.5 text-center font-medium text-gray-700">
                    근거
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => {
                  const items = COMPETENCY_ITEMS.filter(
                    (i) => i.area === area,
                  );
                  return items.map((item, idx) => {
                    const ai = aiMap.get(item.code);
                    const consultant = consultantMap.get(item.code);
                    const tagInfo = tagsByItem.get(item.code);
                    const hasEvidence =
                      (tagInfo?.positive ?? 0) > 0 ||
                      (tagInfo?.negative ?? 0) > 0;

                    return (
                      <tr
                        key={item.code}
                        className={
                          idx === items.length - 1
                            ? "border-b border-gray-300"
                            : "border-b border-gray-100"
                        }
                      >
                        {idx === 0 && (
                          <td
                            rowSpan={items.length}
                            className="px-3 py-1.5 align-top text-xs font-semibold text-gray-800"
                          >
                            {COMPETENCY_AREA_LABELS[area]}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-xs">{item.label}</td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={ai?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={consultant?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          {hasEvidence ? (
                            <span>
                              <span className="text-emerald-600">
                                +{tagInfo!.positive}
                              </span>
                              {tagInfo!.negative > 0 && (
                                <span className="text-red-500">
                                  {" "}
                                  -{tagInfo!.negative}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* 항목별 상세: narrative + 루브릭 질문별 분석 그리드 */}
          {areas.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return (
              <div key={area} className="print-break-before">
                <h3 className="border-b border-gray-200 pb-1 text-sm font-semibold text-gray-800">
                  {COMPETENCY_AREA_LABELS[area]} 상세
                </h3>

                {items.map((item) => {
                  const ai = aiMap.get(item.code);
                  const consultant = consultantMap.get(item.code);
                  const grade = consultant?.grade_value ?? ai?.grade_value;
                  const narrative =
                    consultant?.narrative ?? ai?.narrative ?? null;

                  // 질문별 태그 집계
                  const qStats = aggregateTagsByQuestion(
                    item.code,
                    activityTags,
                  );
                  const hasAnyStats = qStats.some(
                    (s) => s.positive > 0 || s.negative > 0 || s.needsReview > 0,
                  );

                  if (!grade && !narrative && qStats.length === 0) return null;

                  return (
                    <div
                      key={item.code}
                      className="border-b border-gray-100 py-3 print-avoid-break"
                    >
                      {/* 항목명 + 등급 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {item.label}
                        </span>
                        {grade && (
                          <span className="text-sm">
                            <GradeBadge grade={grade} />
                          </span>
                        )}
                      </div>

                      {/* narrative 해석 서술 */}
                      {narrative && (
                        <p className="pt-1 text-xs leading-relaxed text-gray-700">
                          {narrative}
                        </p>
                      )}

                      {/* 루브릭 질문별 분석 그리드 (Sheet 4 대응) */}
                      {qStats.length > 0 && (
                        <table className="w-full border-collapse pt-2 text-[11px]">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="px-2 py-1 text-left font-medium text-gray-500">
                                평가 기준
                              </th>
                              <th className="w-10 px-1 py-1 text-center font-medium text-emerald-600">
                                +
                              </th>
                              <th className="w-10 px-1 py-1 text-center font-medium text-red-500">
                                -
                              </th>
                              {hasAnyStats && (
                                <th className="px-2 py-1 text-left font-medium text-gray-500">
                                  근거
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {qStats.map((stat) => (
                              <tr
                                key={stat.questionIndex}
                                className="border-b border-gray-50"
                              >
                                <td className="px-2 py-1 leading-snug text-gray-600">
                                  {stat.questionText}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {stat.positive > 0 ? (
                                    <span className="text-emerald-600">
                                      {stat.positive}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">-</span>
                                  )}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {stat.negative > 0 ? (
                                    <span className="text-red-500">
                                      {stat.negative}
                                    </span>
                                  ) : (
                                    <span className="text-gray-200">-</span>
                                  )}
                                </td>
                                {hasAnyStats && (
                                  <td className="px-2 py-1 text-gray-500">
                                    {stat.evidences.length > 0
                                      ? stat.evidences[0].split("\n")[0].slice(0, 60) +
                                        (stat.evidences[0].length > 60 ? "…" : "")
                                      : ""}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-gray-300">-</span>;

  const colorMap: Record<string, string> = {
    "A+": "text-emerald-700 font-bold",
    "A-": "text-emerald-600 font-semibold",
    "B+": "text-blue-700 font-semibold",
    B: "text-blue-600",
    "B-": "text-blue-500",
    C: "text-orange-600",
  };

  return (
    <span className={colorMap[grade] ?? "text-gray-700"}>{grade}</span>
  );
}
