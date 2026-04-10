"use client";

import { cn } from "@/lib/cn";
import type { QualityBoxDataPoint, QualityAxisTrend } from "@/lib/domains/student-record/chart-data";
import { CHART_HEX } from "@/lib/design-tokens/report";

interface Props {
  boxes: QualityBoxDataPoint[];
  axisTrends: QualityAxisTrend[] | null;
  /** 설계 모드 학년 (해당 학기 box에 점선 표시) */
  designGrades?: number[];
  className?: string;
}

/** n<3이면 box가 통계적으로 의미 없으므로 dot만 표시 */
const MIN_BOX_COUNT = 3;

export function QualityBoxPlot({ boxes, axisTrends, designGrades = [], className }: Props) {
  const width = 560;
  const height = 240;
  const padding = { top: 20, right: 50, bottom: 30, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const boxWidth = Math.min(40, plotW / boxes.length - 10);
  const designGradeSet = new Set(designGrades);

  // Y축 동적 범위: 데이터에 맞게 조정 (여백 10%)
  const allScores = boxes.flatMap((b) => [b.min, b.max, ...b.outliers.map((o) => o.score)]);
  const dataMin = allScores.length > 0 ? Math.min(...allScores) : 0;
  const dataMax = allScores.length > 0 ? Math.max(...allScores) : 100;
  const range = dataMax - dataMin || 20;
  const yFloor = Math.max(0, Math.floor((dataMin - range * 0.1) / 10) * 10);
  const yCeil = Math.min(100, Math.ceil((dataMax + range * 0.1) / 10) * 10);
  const yScale = (v: number) => padding.top + plotH - ((v - yFloor) / (yCeil - yFloor)) * plotH;

  // Y축 눈금 생성
  const yTicks: number[] = [];
  for (let v = yFloor; v <= yCeil; v += 10) yTicks.push(v);

  return (
    <div className={cn("print-avoid-break", className)}>
      <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">학기별 콘텐츠 품질 분포</h4>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[560px]" style={{ minWidth: 320 }}>
          {/* Y축 그리드 */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="var(--border-secondary, #e5e7eb)"
                strokeDasharray={v === yFloor ? "0" : "3,3"}
              />
              <text x={padding.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-[var(--text-tertiary)]" fontSize={10}>
                {v}
              </text>
            </g>
          ))}

          {/* Box Plot */}
          {boxes.map((box, i) => {
            const cx = padding.left + (i + 0.5) * (plotW / boxes.length);
            const halfBox = boxWidth / 2;
            const grade = Number(box.학기.split("-")[0]);
            const isDesign = designGradeSet.has(grade);
            const dashArray = isDesign ? "4,2" : undefined;
            const boxFill = isDesign ? "#dbeafe" : CHART_HEX[5];
            const boxStroke = isDesign ? "#3b82f6" : CHART_HEX[5];
            const useBox = box.count >= MIN_BOX_COUNT;

            return (
              <g key={box.학기}>
                {useBox ? (
                  <>
                    {/* Whisker (min ~ max) */}
                    <line x1={cx} x2={cx} y1={yScale(box.max)} y2={yScale(box.min)} stroke="var(--text-secondary, #6b7280)" strokeWidth={1} />
                    {/* Whisker caps */}
                    <line x1={cx - halfBox} x2={cx + halfBox} y1={yScale(box.max)} y2={yScale(box.max)} stroke="var(--text-secondary, #6b7280)" strokeWidth={1} />
                    <line x1={cx - halfBox} x2={cx + halfBox} y1={yScale(box.min)} y2={yScale(box.min)} stroke="var(--text-secondary, #6b7280)" strokeWidth={1} />

                    {/* Box (Q1 ~ Q3) */}
                    <rect
                      x={cx - halfBox}
                      y={yScale(box.q3)}
                      width={boxWidth}
                      height={Math.max(1, yScale(box.q1) - yScale(box.q3))}
                      fill={boxFill}
                      fillOpacity={isDesign ? 0.2 : 0.3}
                      stroke={boxStroke}
                      strokeWidth={1}
                      strokeDasharray={dashArray}
                      rx={2}
                    />

                    {/* Median — 핵심 지표, 가장 진하게 */}
                    <line
                      x1={cx - halfBox}
                      x2={cx + halfBox}
                      y1={yScale(box.median)}
                      y2={yScale(box.median)}
                      stroke={boxStroke}
                      strokeWidth={2}
                      strokeDasharray={dashArray}
                    />
                  </>
                ) : (
                  /* n < 3: 개별 점만 표시 (box 의미 없음) */
                  <>
                    {[box.min, box.max].filter((v, idx, arr) => arr.indexOf(v) === idx).map((v, j) => (
                      <circle key={j} cx={cx} cy={yScale(v)} r={4} fill={boxFill} fillOpacity={0.5} stroke={boxStroke} strokeWidth={1} />
                    ))}
                  </>
                )}

                {/* Mean dot — trend line 연결용, median보다 약하게 */}
                <circle cx={cx} cy={yScale(box.mean)} r={3} fill={CHART_HEX[0]} fillOpacity={0.7} />

                {/* Outliers — 다이아몬드 형태 */}
                {box.outliers.map((o, j) => {
                  const oy = yScale(o.score);
                  return (
                    <g key={j}>
                      <path
                        d={`M${cx},${oy - 4} L${cx + 4},${oy} L${cx},${oy + 4} L${cx - 4},${oy} Z`}
                        fill="none"
                        stroke={CHART_HEX[3]}
                        strokeWidth={1.5}
                      />
                      <title>{`${o.subjectName}: ${o.score}점`}</title>
                    </g>
                  );
                })}

                {/* X label */}
                <text x={cx} y={height - padding.bottom + 16} textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize={10}>
                  {box.학기}
                </text>
                {/* Count label */}
                <text x={cx} y={yScale(box.max) - 6} textAnchor="middle" className="fill-[var(--text-tertiary)]" fontSize={10}>
                  n={box.count}
                </text>
              </g>
            );
          })}

          {/* Mean trend line — median보다 약한 시각 계층 */}
          {boxes.length >= 2 && (
            <polyline
              points={boxes
                .map((box, i) => `${padding.left + (i + 0.5) * (plotW / boxes.length)},${yScale(box.mean)}`)
                .join(" ")}
              fill="none"
              stroke={CHART_HEX[0]}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          )}
        </svg>
      </div>

      {/* 범례 — SVG 직후 밀착 */}
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: CHART_HEX[5], backgroundColor: `${CHART_HEX[5]}4d` }} />
          Q1–Q3
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: CHART_HEX[5] }} />
          중앙값
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_HEX[0], opacity: 0.7 }} />
          평균 추세
        </span>
        <span className="flex items-center gap-1">
          <svg width={10} height={10} viewBox="0 0 10 10"><path d="M5,1 L9,5 L5,9 L1,5 Z" fill="none" stroke={CHART_HEX[3]} strokeWidth={1.5} /></svg>
          이상치
        </span>
        {designGrades.length > 0 && (
          <span className="text-blue-500">점선 = 설계 모드</span>
        )}
      </div>

      {/* 5축 보조 테이블 */}
      {axisTrends && axisTrends.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-2 py-1 text-left font-medium">품질 축</th>
                {axisTrends.map((t) => (
                  <th key={t.학기} className="border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-2 py-1 text-center font-medium">
                    {t.학기}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["구체성", "논리연결", "탐구깊이", "문법", "연구정합성"] as const).map((axis) => (
                <tr key={axis}>
                  <td className="border border-[var(--border-primary)] px-2 py-1 font-medium">{axis}</td>
                  {axisTrends.map((t) => {
                    const val = t[axis];
                    return (
                      <td
                        key={t.학기}
                        className={cn(
                          "border border-[var(--border-primary)] px-2 py-1 text-center tabular-nums",
                          val !== null && val >= 3.5 ? "text-emerald-600" : val !== null && val < 2 ? "text-red-500" : "",
                        )}
                      >
                        {val !== null ? val.toFixed(1) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">각 축 0~5 점. 세특 과목별 평균.</p>
        </div>
      )}
    </div>
  );
}
