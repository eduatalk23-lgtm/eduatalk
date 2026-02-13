"use client";

import { useMemo } from "react";
import { normSInv, GRADE_9_BOUNDS } from "@/lib/domains/score/computation";

type BellCurveSVGProps = {
  /** 상위 백분위 (0~1). 예: 0.229 = 상위 22.9% */
  percentile: number;
};

/** 표준정규분포 PDF: φ(z) = exp(-z²/2) / √(2π) */
function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

// ── SVG layout ──
const VIEW_W = 480;
const VIEW_H = 160;
const PAD_X = 20;
const PAD_TOP = 28;
const PAD_BOTTOM = 30;
const CHART_W = VIEW_W - 2 * PAD_X;
const CHART_H = VIEW_H - PAD_TOP - PAD_BOTTOM;
const BASELINE_Y = PAD_TOP + CHART_H;

const Z_MAX = 3.5;
const MAX_PDF = normalPdf(0);

// ── 색상 토큰 (Tailwind 기준) ──
const COLOR_INDIGO_500 = "#6366f1";
const COLOR_INDIGO_700 = "#4338ca";
const COLOR_GRAY_400 = "#9ca3af";
const COLOR_GRAY_300 = "#d1d5db";

function zToX(z: number): number {
  return PAD_X + ((Z_MAX - z) / (2 * Z_MAX)) * CHART_W;
}

function pdfToY(pdf: number): number {
  return PAD_TOP + CHART_H - (pdf / MAX_PDF) * CHART_H;
}

function pctToZ(p: number): number {
  const c = Math.max(0.001, Math.min(0.999, p));
  return normSInv(1 - c);
}

const BOUNDS = GRADE_9_BOUNDS;

// 곡선 포인트 (정적)
const NUM_POINTS = 200;
const CURVE_POINTS: { x: number; y: number; z: number }[] = [];
for (let i = 0; i <= NUM_POINTS; i++) {
  const z = Z_MAX - (i / NUM_POINTS) * (2 * Z_MAX);
  const pdf = normalPdf(z);
  CURVE_POINTS.push({ x: zToX(z), y: pdfToY(pdf), z });
}
const CURVE_PATH =
  "M " + CURVE_POINTS.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");

// 등급 경계 X좌표 (정적)
const BOUNDARY_LINES = BOUNDS.slice(1).map((b) => zToX(pctToZ(b)));

// 등급 라벨 위치 (정적) — 너비 5% 이상이거나 홀수 등급만 표시
const GRADE_LABELS = Array.from({ length: 9 }, (_, g) => {
  const lo = g === 0 ? 0 : BOUNDS[g];
  const hi = g < 8 ? BOUNDS[g + 1] : 1;
  const widthPct = hi - lo;
  const show = widthPct >= 0.05 || (g + 1) % 2 === 1;
  if (!show) return null;
  const midZ = pctToZ((lo + hi) / 2);
  return { grade: g + 1, x: zToX(midZ) };
}).filter(Boolean) as { grade: number; x: number }[];

export default function BellCurveSVG({ percentile }: BellCurveSVGProps) {
  const { studentX, studentPdfY, shadePath, pctLabel, labelX } = useMemo(() => {
    const sZ = pctToZ(percentile);
    const sX = zToX(sZ);
    const sPdfY = pdfToY(normalPdf(sZ));

    const shaded = CURVE_POINTS.filter((p) => p.z >= sZ);
    const sPath =
      shaded.length > 1
        ? `M ${shaded[0].x.toFixed(1)},${BASELINE_Y} ` +
          shaded.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
          ` L ${sX.toFixed(1)},${BASELINE_Y} Z`
        : "";

    return {
      studentX: sX,
      studentPdfY: sPdfY,
      shadePath: sPath,
      pctLabel: `상위 ${(percentile * 100).toFixed(1)}%`,
      labelX: Math.min(Math.max(sX, PAD_X + 40), VIEW_W - PAD_X - 40),
    };
  }, [percentile]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="select-none"
      aria-label="정규분포 곡선 (9등급 기준)"
    >
      {/* 상위 영역 음영 */}
      {shadePath && (
        <path d={shadePath} fill={`${COLOR_INDIGO_500}1f`} stroke="none" />
      )}

      {/* 곡선 */}
      <path d={CURVE_PATH} fill="none" stroke={COLOR_INDIGO_500} strokeWidth="2" />

      {/* 기준선 */}
      <line
        x1={PAD_X} y1={BASELINE_Y}
        x2={VIEW_W - PAD_X} y2={BASELINE_Y}
        stroke={COLOR_GRAY_300} strokeWidth="0.5"
      />

      {/* 등급 경계 점선 */}
      {BOUNDARY_LINES.map((bx, i) => (
        <line
          key={`b-${i}`}
          x1={bx} y1={PAD_TOP + 4}
          x2={bx} y2={BASELINE_Y}
          stroke={COLOR_GRAY_300} strokeWidth="0.5" strokeDasharray="3 2"
        />
      ))}

      {/* 등급 라벨 — 숫자만 */}
      {GRADE_LABELS.map(({ grade, x }) => (
        <text
          key={`g-${grade}`}
          x={x} y={BASELINE_Y + 17}
          textAnchor="middle" fontSize="11" fill={COLOR_GRAY_400}
        >
          {grade}
        </text>
      ))}

      {/* 학생 수직선 */}
      <line
        x1={studentX} y1={studentPdfY}
        x2={studentX} y2={BASELINE_Y}
        stroke={COLOR_INDIGO_500} strokeWidth="2"
      />

      {/* 학생 도트 */}
      <circle cx={studentX} cy={studentPdfY} r="4" fill={COLOR_INDIGO_500} />

      {/* 학생 라벨 */}
      <text
        x={labelX} y={PAD_TOP - 10}
        textAnchor="middle" fontSize="13" fontWeight="600" fill={COLOR_INDIGO_700}
      >
        {pctLabel}
      </text>
    </svg>
  );
}
