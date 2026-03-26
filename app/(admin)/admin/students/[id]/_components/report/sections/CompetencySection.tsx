"use client";

import { useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type {
  DiagnosisTabData,
  RecordTabData,
  ActivityTag,
} from "@/lib/domains/student-record/types";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
  COMPETENCY_RUBRIC_QUESTIONS,
} from "@/lib/domains/student-record/constants";
import type { RubricScoreEntry } from "@/lib/domains/student-record/types";
import { aggregateTagsByQuestion, gradeToNum } from "@/lib/domains/student-record/rubric-matcher";
import { buildSingleRadarData, buildGrowthData } from "@/lib/domains/student-record/chart-data";
import { Brain } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { CollapsibleDetail } from "../CollapsibleDetail";
const AREA_COLORS: Record<string, string> = { academic: "#4f46e5", career: "#818cf8", community: "#059669" };

function parseRubricScores(raw: unknown): RubricScoreEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is RubricScoreEntry =>
      !!r && typeof r === "object" && "questionIndex" in r && "grade" in r,
  );
}

interface CompetencySectionProps {
  diagnosisData: DiagnosisTabData;
  recordDataByGrade?: Record<number, RecordTabData>;
}

export function CompetencySection({ diagnosisData, recordDataByGrade }: CompetencySectionProps) {
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

  // 레이더 차트 데이터 (공유 유틸 사용)
  const radarData = useMemo(
    () => buildSingleRadarData(aiScores, consultantScores),
    [aiScores, consultantScores],
  );

  // 영역별 도넛 데이터
  const donutData = useMemo(() => {
    const areaTotals = new Map<string, { sum: number; count: number }>();
    for (const item of COMPETENCY_ITEMS) {
      const score = consultantMap.get(item.code) ?? aiMap.get(item.code);
      const val = score?.grade_value ? (gradeToNum(score.grade_value)) : 0;
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

  // 성장 추이 + 주석 (S-1: 공유 유틸 사용)
  const { data: growthData, annotations: growthAnnotations } = useMemo(
    () => recordDataByGrade ? buildGrowthData(activityTags, recordDataByGrade) : { data: null, annotations: null },
    [activityTags, recordDataByGrade],
  );

  const growthLines = useMemo(() => {
    if (!growthData || growthData.length === 0) return [];
    return (["academic", "career", "community"] as const)
      .map((area) => ({
        label: COMPETENCY_AREA_LABELS[area],
        color: AREA_COLORS[area],
      }))
      .filter((line) => growthData.some((d) => line.label in d));
  }, [growthData]);

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Brain} title="역량 분석" subtitle="10항목 역량 프로필 + 성장 추이" />

      {!hasAnyData ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">역량 평가 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-500">AI 역량 분석을 실행하면 레이더 차트와 역량별 상세 분석이 생성됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {/* Tier 1a: 3영역 삼각형 레이더 (엑셀 역량분석 시트 재현) */}
          <div className="mb-6 grid grid-cols-3 gap-3 print-avoid-break">
            {(["academic", "career", "community"] as const).map((area) => {
              const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
              const areaRadar = areaItems.map((item) => {
                const score = consultantMap.get(item.code) ?? aiMap.get(item.code);
                return {
                  item: item.label.slice(0, 4),
                  fullLabel: item.label,
                  점수: score?.grade_value ? gradeToNum(score.grade_value) : 0,
                  fullMark: 5,
                };
              });
              const areaAvg = areaRadar.reduce((s, d) => s + d.점수, 0) / (areaRadar.length || 1);
              const grade = areaAvg >= 4 ? "A" : areaAvg >= 3 ? "B+" : areaAvg >= 2 ? "B" : "C";

              return (
                <div key={area} className="rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-xs font-semibold text-gray-800">{COMPETENCY_AREA_LABELS[area]}</p>
                  <p className="text-lg font-bold text-indigo-600">{grade}</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <RadarChart data={areaRadar} cx="50%" cy="50%" outerRadius="65%">
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="item" tick={{ fontSize: 8 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                      <Radar dataKey="점수" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          {/* Tier 1b: 영역별 요약 (도넛 + 성장 추이) — 항상 표시 */}
          <div className="grid grid-cols-1 gap-4 print-avoid-break md:grid-cols-2">
            {/* 영역별 도넛 차트 */}
            <div>
              <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">영역별 평균</h3>
              <ResponsiveContainer width="100%" height={220} minHeight={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    dataKey="value"
                    label={({ name, value }: { name?: string; value: number }) => `${name ?? ""} ${value}`}
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
                  <span key={d.name} className="flex items-center gap-1 text-xs text-gray-600 sm:text-xs">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* P1-1: 역량 성장 추이 라인 차트 */}
          {growthData && growthData.length >= 2 && growthLines.length > 0 && (
            <div className="print-avoid-break">
              <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">역량 성장 추이</h3>
              <ResponsiveContainer width="100%" height={220} minHeight={180}>
                <LineChart data={growthData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="학년" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(value: number) => [value.toFixed(1), ""]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                    iconSize={8}
                  />
                  {growthLines.map((line) => (
                      <Line
                        key={line.label}
                        type="monotone"
                        dataKey={line.label}
                        stroke={line.color}
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                        connectNulls
                      />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {/* E-5: 학년별 대표 활동 주석 */}
              {growthAnnotations && growthAnnotations.length > 0 && (
                <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${growthAnnotations.length}, 1fr)` }}>
                  {growthAnnotations.map((ga) => (
                    <div key={ga.grade} className="text-center">
                      <span className="text-xs font-medium text-gray-500">{ga.grade}학년: </span>
                      <span className="text-xs text-gray-600">{ga.annotations.join(" · ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tier 2: 10항목 상세 (레이더 + 등급 테이블) — 접힘/펼침 */}
          <CollapsibleDetail title="10항목 상세 분석">
            {/* 10항목 레이더 */}
            <div className="mb-6 print-avoid-break">
              <h3 className="mb-1 text-center text-xs font-semibold text-gray-600">10항목 역량 프로필</h3>
              <ResponsiveContainer width="100%" height={250} minHeight={200}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="item" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />
                  <Radar dataKey="점수" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

          {/* 등급 요약 테이블 */}
          <div className="print-avoid-break">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">
                10항목 등급 요약
              </h3>
              {(() => {
                const mismatchCount = COMPETENCY_ITEMS.filter((item) => {
                  const a = aiMap.get(item.code)?.grade_value;
                  const c = consultantMap.get(item.code)?.grade_value;
                  return a && c && a !== c;
                }).length;
                return mismatchCount > 0 ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    AI↔컨설턴트 불일치 {mismatchCount}건
                  </span>
                ) : null;
              })()}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-gray-700">
                    영역
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-700">
                    항목
                  </th>
                  <th className="w-12 whitespace-nowrap px-2 py-1.5 text-center font-medium text-gray-700">
                    AI
                  </th>
                  <th className="whitespace-nowrap px-2 py-1.5 text-center font-medium text-gray-700">
                    컨설턴트
                  </th>
                  <th className="w-20 whitespace-nowrap px-2 py-1.5 text-center font-medium text-gray-700">
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
                    // P3-4a: AI↔컨설턴트 등급 불일치 감지
                    const hasMismatch = ai?.grade_value && consultant?.grade_value && ai.grade_value !== consultant.grade_value;

                    return (
                      <tr
                        key={item.code}
                        className={`${
                          hasMismatch ? "bg-amber-50/60 " : ""
                        }${
                          idx === items.length - 1
                            ? "border-b border-gray-300"
                            : "border-b border-gray-100"
                        }`}
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

                  // 루브릭별 등급 (AI/컨설턴트)
                  const aiRubrics = parseRubricScores(ai?.rubric_scores);
                  const consultantRubrics = parseRubricScores(consultant?.rubric_scores);
                  const aiRubricMap = new Map(aiRubrics.map((r) => [r.questionIndex, r]));
                  const consultantRubricMap = new Map(consultantRubrics.map((r) => [r.questionIndex, r]));
                  const hasRubricGrades = aiRubrics.length > 0 || consultantRubrics.length > 0;

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
                        <div className="overflow-x-auto">
                        <table className="w-full border-collapse pt-2 text-xs sm:text-[11px]">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="px-2 py-1 text-left font-medium text-gray-500">
                                평가 기준
                              </th>
                              {hasRubricGrades && (
                                <>
                                  <th className="w-12 px-1 py-1 text-center font-medium text-blue-600">
                                    AI
                                  </th>
                                  <th className="w-12 px-1 py-1 text-center font-medium text-amber-600">
                                    컨설턴트
                                  </th>
                                </>
                              )}
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
                            {qStats.map((stat) => {
                              const aiR = aiRubricMap.get(stat.questionIndex);
                              const conR = consultantRubricMap.get(stat.questionIndex);
                              const match = aiR && conR && aiR.grade === conR.grade;
                              return (
                              <tr
                                key={stat.questionIndex}
                                className="border-b border-gray-50"
                              >
                                <td className="px-2 py-1 leading-snug text-gray-600">
                                  {stat.questionText}
                                </td>
                                {hasRubricGrades && (
                                  <>
                                    <td className="px-1 py-1 text-center">
                                      {aiR ? (
                                        <span className="text-xs font-semibold text-blue-600">{aiR.grade}</span>
                                      ) : (
                                        <span className="text-gray-200">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 py-1 text-center">
                                      {conR ? (
                                        <span className={`text-xs font-semibold ${match ? "text-green-600" : "text-amber-600"}`}>
                                          {conR.grade}
                                        </span>
                                      ) : (
                                        <span className="text-gray-200">-</span>
                                      )}
                                    </td>
                                  </>
                                )}
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
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </CollapsibleDetail>
        </div>
      )}
    </section>
  );
}

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-gray-300">-</span>;

  const styleMap: Record<string, { cls: string; icon: string }> = {
    "A+": { cls: "text-emerald-700 font-bold", icon: "◆" },
    "A-": { cls: "text-emerald-600 font-semibold", icon: "◇" },
    "B+": { cls: "text-blue-700 font-semibold", icon: "●" },
    B: { cls: "text-blue-600", icon: "○" },
    "B-": { cls: "text-blue-500", icon: "▪" },
    C: { cls: "text-amber-600", icon: "▫" },
  };

  const style = styleMap[grade];
  return (
    <span className={style?.cls ?? "text-gray-700"}>
      {style && <span className="mr-0.5 text-[8px] leading-none" aria-hidden="true">{style.icon}</span>}
      {grade}
    </span>
  );
}
