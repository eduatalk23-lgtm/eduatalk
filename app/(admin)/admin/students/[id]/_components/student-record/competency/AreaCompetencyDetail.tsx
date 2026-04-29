"use client";

// ============================================
// 영역별 역량 상세 패널 — 리포트/진단 공용
// 큰 레이더(AI vs 컨설턴트) + 영역 총평 + 하위 항목별 루브릭 질문 근거 테이블
// ============================================

import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/cn";
import type {
  CompetencyScore,
  ActivityTag,
  CompetencyArea,
  RubricScoreEntry,
} from "@/lib/domains/student-record/types";
import { aggregateTagsByQuestion } from "@/lib/domains/student-record/rubric-matcher";
import {
  buildAreaRadarData,
  composeAreaNarratives,
  type AreaRadarItem,
  type AreaRadarSection,
  type AreaNarrativeSummary,
} from "@/lib/domains/student-record/chart-data";
import { BADGE, TYPO, CHART_HEX } from "@/lib/design-tokens/report";

export const AREA_COLORS: Record<CompetencyArea, string> = {
  academic: CHART_HEX[0], // indigo
  career: CHART_HEX[1], // purple
  community: CHART_HEX[4], // emerald
};

function parseRubricScores(raw: unknown): RubricScoreEntry[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is RubricScoreEntry =>
      !!r && typeof r === "object" && "questionIndex" in r && "grade" in r,
  );
}

// ============================================
// 커스텀 PolarAngleAxis tick
// 항목명 + 하위 등급(컨설턴트/AI)을 2줄로 노출
// ============================================

/** Recharts가 PolarAngleAxis tick 함수에 주입하는 내부 props 일부 */
export interface RechartsPolarTickProps {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value?: string | number };
}

interface CompetencyAxisTickProps extends RechartsPolarTickProps {
  items: AreaRadarItem[];
  color: string;
}

export function CompetencyAxisTick({
  x = 0,
  y = 0,
  cx = 0,
  cy = 0,
  payload,
  items,
  color,
}: CompetencyAxisTickProps) {
  const labelValue = String(payload?.value ?? "");
  const item = items.find((i) => i.item === labelValue);
  const aiG = item?.aiGrade ?? null;
  const conG = item?.consultantGrade ?? null;

  // 차트 중심 기준 텍스트 anchor 결정
  const dx = x - cx;
  const dy = y - cy;
  let anchor: "start" | "middle" | "end" = "middle";
  if (dx > 8) anchor = "start";
  else if (dx < -8) anchor = "end";

  // 등급 라벨 합치기
  let gradeLabel = "";
  if (conG && aiG && conG !== aiG) gradeLabel = `${conG} / ${aiG}`;
  else if (conG) gradeLabel = conG;
  else if (aiG) gradeLabel = aiG;

  // 두 번째 줄 위치: 라벨이 차트 위쪽이면 위로, 아래쪽이면 아래로
  // (Recharts 기본 tick은 항상 가운데 정렬이므로 dy 부호로 외곽 방향 보정)
  const isTop = dy < -5;
  const secondDy = isTop ? -11 : 11;

  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        className="fill-[var(--text-secondary)]"
      >
        <tspan x={x} dy="0" fontSize={10}>
          {labelValue}
        </tspan>
        {gradeLabel && (
          <tspan
            x={x}
            dy={secondDy}
            fontSize={9}
            fontWeight={700}
            fill={color}
          >
            {gradeLabel}
          </tspan>
        )}
      </text>
    </g>
  );
}

// ============================================
// 그룹 컴포넌트 — 3영역 패널 일괄 렌더
// ============================================

interface AreaCompetencyDetailGroupProps {
  aiScores: CompetencyScore[];
  consultantScores: CompetencyScore[];
  activityTags: ActivityTag[];
  /** 외부 wrapping className (space 조정용) */
  className?: string;
}

export function AreaCompetencyDetailGroup({
  aiScores,
  consultantScores,
  activityTags,
  className,
}: AreaCompetencyDetailGroupProps) {
  const areaSections = useMemo(
    () => buildAreaRadarData(aiScores, consultantScores),
    [aiScores, consultantScores],
  );

  const areaNarratives = useMemo(
    () => composeAreaNarratives(aiScores, consultantScores),
    [aiScores, consultantScores],
  );

  const narrativeMap = useMemo(
    () => new Map(areaNarratives.map((a) => [a.area, a])),
    [areaNarratives],
  );

  const aiMap = useMemo(
    () => new Map(aiScores.map((s) => [s.competency_item, s])),
    [aiScores],
  );

  const consultantMap = useMemo(
    () => new Map(consultantScores.map((s) => [s.competency_item, s])),
    [consultantScores],
  );

  return (
    <div className={cn("space-y-6", className)}>
      {areaSections.map((section) => (
        <AreaCompetencyPanel
          key={section.area}
          section={section}
          narrative={narrativeMap.get(section.area)}
          aiMap={aiMap}
          consultantMap={consultantMap}
          activityTags={activityTags}
        />
      ))}
    </div>
  );
}

// ============================================
// 단일 패널 — 큰 레이더 + 영역 총평 + 하위 항목 루브릭 질문 근거
// ============================================

interface AreaCompetencyPanelProps {
  section: AreaRadarSection;
  narrative: AreaNarrativeSummary | undefined;
  aiMap: Map<string, CompetencyScore>;
  consultantMap: Map<string, CompetencyScore>;
  activityTags: ActivityTag[];
}

export function AreaCompetencyPanel({
  section,
  narrative,
  aiMap,
  consultantMap,
  activityTags,
}: AreaCompetencyPanelProps) {
  const color = AREA_COLORS[section.area];
  const hasAiData = section.items.some((i) => i.AI > 0);
  const hasConData = section.items.some((i) => i.컨설턴트 > 0);
  const hasAreaData = hasAiData || hasConData;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] print-avoid-break">
      {/* 헤더: 영역명 + 평균 등급 + 불일치 배지 */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-secondary)] px-4 py-2">
        <h3 className={cn("font-semibold text-[var(--text-primary)]", TYPO.body)}>
          {section.label}
        </h3>
        <div className="flex items-center gap-2">
          {section.mismatchCount > 0 && (
            <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.amber)}>
              AI↔컨설턴트 불일치 {section.mismatchCount}건
            </span>
          )}
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ backgroundColor: color + "20", color }}
          >
            {hasAreaData ? section.avgGrade : "-"}
          </span>
        </div>
      </div>

      {/* 레이더 + 총평 */}
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[320px_1fr]">
        <div>
          {hasAreaData ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart
                data={section.items}
                cx="50%"
                cy="50%"
                outerRadius="62%"
                margin={{ top: 12, right: 36, bottom: 12, left: 36 }}
              >
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="item"
                  tick={(tickProps: RechartsPolarTickProps) => (
                    <CompetencyAxisTick
                      {...tickProps}
                      items={section.items}
                      color={color}
                    />
                  )}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  tick={false}
                  axisLine={false}
                />
                {hasAiData && (
                  <Radar
                    name="AI"
                    dataKey="AI"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.12}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                )}
                {hasConData && (
                  <Radar
                    name="컨설턴트"
                    dataKey="컨설턴트"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                )}
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-[var(--text-placeholder)]">
              <span className={TYPO.caption}>평가 데이터 없음</span>
            </div>
          )}
        </div>

        <div>
          {narrative && (
            <>
              <p
                className={cn(
                  "font-medium leading-relaxed text-[var(--text-primary)]",
                  TYPO.body,
                )}
              >
                {narrative.headline}
              </p>
              {(narrative.strongest || narrative.weakest) && (
                <ul className={cn("mt-2 space-y-0.5", TYPO.caption)}>
                  {narrative.strongest && (
                    <li className="text-emerald-700 dark:text-emerald-400">
                      <strong>강점</strong>: {narrative.strongest.label}
                      <span className="ml-1 opacity-80">
                        ({narrative.strongest.grade})
                      </span>
                    </li>
                  )}
                  {narrative.weakest && (
                    <li className="text-amber-700 dark:text-amber-400">
                      <strong>보완</strong>: {narrative.weakest.label}
                      <span className="ml-1 opacity-80">
                        ({narrative.weakest.grade})
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* 하위 항목별 루브릭 질문 근거 (상시 노출) */}
      <div className="divide-y divide-[var(--border-primary)] border-t border-[var(--border-secondary)]">
        {section.items.map((sItem) => {
          const ai = aiMap.get(sItem.code);
          const consultant = consultantMap.get(sItem.code);
          const grade = consultant?.grade_value ?? ai?.grade_value ?? null;
          const narrativeText = consultant?.narrative ?? ai?.narrative ?? null;

          const qStats = aggregateTagsByQuestion(sItem.code, activityTags);
          const hasAnyStats = qStats.some(
            (s) => s.positive > 0 || s.negative > 0 || s.needsReview > 0,
          );

          const aiRubrics = parseRubricScores(ai?.rubric_scores);
          const consultantRubrics = parseRubricScores(consultant?.rubric_scores);
          const aiRubricMap = new Map(aiRubrics.map((r) => [r.questionIndex, r]));
          const consultantRubricMap = new Map(
            consultantRubrics.map((r) => [r.questionIndex, r]),
          );
          const hasRubricGrades = aiRubrics.length > 0 || consultantRubrics.length > 0;

          if (!grade && !narrativeText && qStats.length === 0) return null;

          return (
            <div key={sItem.code} className="px-4 py-3">
              {/* 항목명 + 등급 */}
              <div className="flex items-center gap-2">
                <span className={cn("font-medium", TYPO.body)}>{sItem.item}</span>
                {grade && (
                  <span className="text-sm">
                    <GradeBadge grade={grade} />
                  </span>
                )}
              </div>

              {/* narrative */}
              {narrativeText && (
                <p className={cn("pt-1 leading-relaxed", TYPO.caption)}>
                  {narrativeText}
                </p>
              )}

              {/* 루브릭 질문별 근거 테이블 */}
              {qStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse pt-2 text-xs sm:text-2xs">
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
                        {(hasAnyStats || hasRubricGrades) && (
                          <th className="px-2 py-1 text-left font-medium text-[var(--text-secondary)]">
                            판단 근거
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {qStats.map((stat) => {
                        const aiR = aiRubricMap.get(stat.questionIndex);
                        const conR = consultantRubricMap.get(stat.questionIndex);
                        const match = aiR && conR && aiR.grade === conR.grade;
                        const reasoning = (conR?.reasoning ?? aiR?.reasoning ?? "").trim();
                        const evidenceLine = stat.evidences[0]?.split("\n")[0] ?? "";
                        const judgeText = reasoning || evidenceLine;
                        return (
                          <tr
                            key={stat.questionIndex}
                            className="border-b border-[var(--border-primary)] align-top"
                          >
                            <td className="px-2 py-1 leading-snug text-[var(--text-secondary)]">
                              {stat.questionText}
                            </td>
                            {hasRubricGrades && (
                              <>
                                <td className="px-1 py-1 text-center">
                                  {aiR ? (
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                      {aiR.grade}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--text-placeholder)]">-</span>
                                  )}
                                </td>
                                <td className="px-1 py-1 text-center">
                                  {conR ? (
                                    <span
                                      className={`text-xs font-semibold ${
                                        match
                                          ? "text-green-600 dark:text-green-400"
                                          : "text-amber-600 dark:text-amber-400"
                                      }`}
                                    >
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
                            {(hasAnyStats || hasRubricGrades) && (
                              <td className="px-2 py-1 leading-snug text-[var(--text-tertiary)]">
                                {judgeText
                                  ? judgeText.length > 120
                                    ? judgeText.slice(0, 120) + "…"
                                    : judgeText
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
    </div>
  );
}

// ============================================
// 등급 뱃지 (공용 스타일)
// ============================================

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
      {style && (
        <span className="mr-0.5 text-3xs leading-none" aria-hidden="true">
          {style.icon}
        </span>
      )}
      {grade}
    </span>
  );
}
