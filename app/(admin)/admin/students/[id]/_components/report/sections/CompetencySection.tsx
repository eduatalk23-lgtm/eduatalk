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

// 역량 항목 코드 → 레이블 빠른 조회
const COMPETENCY_ITEM_LABEL: Record<string, string> = Object.fromEntries(
  COMPETENCY_ITEMS.map((i) => [i.code, i.label]),
);
import type { RubricScoreEntry } from "@/lib/domains/student-record/types";
import { aggregateTagsByQuestion, gradeToNum } from "@/lib/domains/student-record/rubric-matcher";
import { buildSingleRadarData, buildGrowthData } from "@/lib/domains/student-record/chart-data";
import { Brain } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { CollapsibleDetail } from "../CollapsibleDetail";
import { BADGE, TABLE, SPACING, TYPO, CHART_HEX } from "@/lib/design-tokens/report";
import { SectionActionSummary } from "./SectionActionSummary";

const AREA_COLORS: Record<string, string> = {
  academic: CHART_HEX[0],   // indigo
  career: CHART_HEX[1],     // purple
  community: CHART_HEX[4],  // emerald
};

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
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>역량 평가 데이터가 입력되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>AI 역량 분석을 실행하면 레이더 차트와 역량별 상세 분석이 생성됩니다.</p>
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
                <div key={area} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 text-center">
                  <p className={TYPO.subsectionTitle}>{COMPETENCY_AREA_LABELS[area]}</p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{grade}</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <RadarChart data={areaRadar} cx="50%" cy="50%" outerRadius="65%">
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="item" tick={{ fontSize: 8 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                      <Radar dataKey="점수" stroke={CHART_HEX[0]} fill={CHART_HEX[0]} fillOpacity={0.2} strokeWidth={2} />
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
              <h3 className={cn("mb-1 text-center", TYPO.caption, "font-semibold")}>영역별 평균</h3>
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
                  <span key={d.name} className={cn("flex items-center gap-1", TYPO.caption)}>
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
              <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>역량 성장 추이</h3>
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
                      <span className={cn("font-medium", TYPO.caption)}>{ga.grade}학년: </span>
                      <span className={TYPO.caption}>{ga.annotations.join(" · ")}</span>
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
              <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>10항목 역량 프로필</h3>
              <ResponsiveContainer width="100%" height={250} minHeight={200}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="item" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />
                  <Radar dataKey="점수" stroke={CHART_HEX[0]} fill={CHART_HEX[0]} fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

          {/* 등급 요약 테이블 */}
          <div className="print-avoid-break">
            <div className="flex items-center gap-2">
              <h3 className={TYPO.subsectionTitle}>
                10항목 등급 요약
              </h3>
              {(() => {
                const mismatchCount = COMPETENCY_ITEMS.filter((item) => {
                  const a = aiMap.get(item.code)?.grade_value;
                  const c = consultantMap.get(item.code)?.grade_value;
                  return a && c && a !== c;
                }).length;
                return mismatchCount > 0 ? (
                  <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.amber)}>
                    AI↔컨설턴트 불일치 {mismatchCount}건
                  </span>
                ) : null;
              })()}
            </div>
            <table className={TABLE.wrapper}>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={cn(TABLE.th, "whitespace-nowrap")}>영역</th>
                  <th className={TABLE.th}>항목</th>
                  <th className={cn(TABLE.th, "w-12 whitespace-nowrap text-center")}>AI</th>
                  <th className={cn(TABLE.th, "whitespace-nowrap text-center")}>컨설턴트</th>
                  <th className={cn(TABLE.th, "w-20 whitespace-nowrap text-center")}>근거</th>
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
                          hasMismatch ? "bg-amber-50/60 dark:bg-amber-950/20 " : ""
                        }${
                          idx === items.length - 1
                            ? "border-b border-[var(--border-secondary)]"
                            : "border-b border-[var(--border-primary)]"
                        }`}
                      >
                        {idx === 0 && (
                          <td
                            rowSpan={items.length}
                            className="px-3 py-1.5 align-top text-xs font-semibold text-[var(--text-primary)]"
                          >
                            {COMPETENCY_AREA_LABELS[area]}
                          </td>
                        )}
                        <td className={cn(TABLE.td, "text-xs")}>{item.label}</td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={ai?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <GradeBadge grade={consultant?.grade_value} />
                        </td>
                        <td className="px-2 py-1.5 text-center text-xs">
                          {hasEvidence ? (
                            <span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +{tagInfo!.positive}
                              </span>
                              {tagInfo!.negative > 0 && (
                                <span className="text-red-500 dark:text-red-400">
                                  {" "}
                                  -{tagInfo!.negative}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--text-placeholder)]">-</span>
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
                <h3 className="border-b border-[var(--border-secondary)] pb-1 text-sm font-semibold text-[var(--text-primary)]">
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
                      className="border-b border-[var(--border-primary)] py-3 print-avoid-break"
                    >
                      {/* 항목명 + 등급 */}
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", TYPO.body)}>
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
                        <p className={cn("pt-1 leading-relaxed", TYPO.caption)}>
                          {narrative}
                        </p>
                      )}

                      {/* 루브릭 질문별 분석 그리드 (Sheet 4 대응) */}
                      {qStats.length > 0 && (
                        <div className="overflow-x-auto">
                        <table className="w-full border-collapse pt-2 text-xs sm:text-[11px]">
                          <thead>
                            <tr className="border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)]">
                              <th className="px-2 py-1 text-left font-medium text-[var(--text-secondary)]">
                                평가 기준
                              </th>
                              {hasRubricGrades && (
                                <>
                                  <th className="w-12 px-1 py-1 text-center font-medium text-blue-600 dark:text-blue-400">
                                    AI
                                  </th>
                                  <th className="w-12 px-1 py-1 text-center font-medium text-amber-600 dark:text-amber-400">
                                    컨설턴트
                                  </th>
                                </>
                              )}
                              <th className="w-10 px-1 py-1 text-center font-medium text-emerald-600 dark:text-emerald-400">
                                +
                              </th>
                              <th className="w-10 px-1 py-1 text-center font-medium text-red-500 dark:text-red-400">
                                -
                              </th>
                              {hasAnyStats && (
                                <th className="px-2 py-1 text-left font-medium text-[var(--text-secondary)]">
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
                                className="border-b border-[var(--border-primary)]"
                              >
                                <td className="px-2 py-1 leading-snug text-[var(--text-secondary)]">
                                  {stat.questionText}
                                </td>
                                {hasRubricGrades && (
                                  <>
                                    <td className="px-1 py-1 text-center">
                                      {aiR ? (
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{aiR.grade}</span>
                                      ) : (
                                        <span className="text-[var(--text-placeholder)]">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 py-1 text-center">
                                      {conR ? (
                                        <span className={`text-xs font-semibold ${match ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                                          {conR.grade}
                                        </span>
                                      ) : (
                                        <span className="text-[var(--text-placeholder)]">-</span>
                                      )}
                                    </td>
                                  </>
                                )}
                                <td className="px-1 py-1 text-center">
                                  {stat.positive > 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      {stat.positive}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-placeholder)]">-</span>
                                  )}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {stat.negative > 0 ? (
                                    <span className="text-red-500 dark:text-red-400">
                                      {stat.negative}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-placeholder)]">-</span>
                                  )}
                                </td>
                                {hasAnyStats && (
                                  <td className="px-2 py-1 text-[var(--text-tertiary)]">
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

          {/* 가장 낮은 역량 기반 다음 단계 */}
          {(() => {
            const scores = [...(consultantScores.length > 0 ? consultantScores : aiScores)];
            const weakCompetencies = scores
              .filter((s) => s.grade_value)
              .sort((a, b) => gradeToNum(a.grade_value ?? "") - gradeToNum(b.grade_value ?? ""))
              .slice(0, 2)
              .map((c) => {
                const itemLabel = COMPETENCY_ITEM_LABEL[c.competency_item] ?? c.competency_item;
                const areaLabel = COMPETENCY_AREA_LABELS[c.competency_area as keyof typeof COMPETENCY_AREA_LABELS] ?? "";
                return `${areaLabel ? `[${areaLabel}] ` : ""}${itemLabel}(현재 ${c.grade_value ?? "-"}등급) → 관련 활동 기록에서 구체적 사례를 추가하세요`;
              });
            return weakCompetencies.length > 0 ? <SectionActionSummary actions={weakCompetencies} /> : null;
          })()}
        </div>
      )}
    </section>
  );
}

function GradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <span className="text-[var(--text-placeholder)]">-</span>;

  const styleMap: Record<string, { cls: string; icon: string }> = {
    "A+": { cls: "text-emerald-700 dark:text-emerald-400 font-bold", icon: "◆" },
    "A-": { cls: "text-emerald-600 dark:text-emerald-500 font-semibold", icon: "◇" },
    "B+": { cls: "text-blue-700 dark:text-blue-400 font-semibold", icon: "●" },
    B: { cls: "text-blue-600 dark:text-blue-500", icon: "○" },
    "B-": { cls: "text-blue-500 dark:text-blue-600", icon: "▪" },
    C: { cls: "text-amber-600 dark:text-amber-400", icon: "▫" },
  };

  const style = styleMap[grade];
  return (
    <span className={style?.cls ?? "text-[var(--text-primary)]"}>
      {style && <span className="mr-0.5 text-[8px] leading-none" aria-hidden="true">{style.icon}</span>}
      {grade}
    </span>
  );
}
