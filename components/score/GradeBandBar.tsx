"use client";

import { GRADE_9_BOUNDS, GRADE_5_BOUNDS } from "@/lib/domains/score/computation";

type GradeBandBarProps = {
  /** 상위 백분위 (0~1) */
  percentile: number;
  /** 표시할 등급 체계 */
  gradeSystem: 5 | 9;
  /** 해당 등급 체계에서의 활성 등급 (1-based) */
  activeGrade: number;
  /** 바 위에 표시할 라벨 */
  label?: string;
};

/** 라벨이 보일 최소 너비 (%) */
const MIN_WIDTH_FOR_LABEL = 6;

export default function GradeBandBar({
  percentile,
  gradeSystem,
  activeGrade,
  label,
}: GradeBandBarProps) {
  const bounds = gradeSystem === 5 ? GRADE_5_BOUNDS : GRADE_9_BOUNDS;
  const maxGrade = gradeSystem === 5 ? 5 : 9;

  const segments: {
    grade: number;
    lower: number;
    upper: number;
    widthPct: number;
  }[] = [];

  for (let g = 1; g <= maxGrade; g++) {
    const lower = bounds[g - 1];
    const upper = g < maxGrade ? bounds[g] : 1;
    segments.push({ grade: g, lower, upper, widthPct: (upper - lower) * 100 });
  }

  const markerLeftPct = percentile * 100;

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      )}

      <div className="relative">
        {/* 색상 바 */}
        <div className="flex h-7 w-full overflow-hidden rounded-md">
          {segments.map((seg) => {
            const isActive = seg.grade === activeGrade;
            return (
              <div
                key={seg.grade}
                className={`flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-indigo-500 text-white"
                    : "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                } ${seg.grade < maxGrade ? "border-r border-white/80 dark:border-gray-900" : ""}`}
                style={{ flexBasis: `${seg.widthPct}%` }}
              >
                {/* 활성 구간에 등급 번호 표시 (좁아도 표시) */}
                {isActive && (
                  <span className="text-[11px] font-bold leading-none">{seg.grade}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 마커 삼각형 */}
        <div
          className="absolute top-7 -translate-x-1/2"
          style={{ left: `${markerLeftPct}%` }}
        >
          <div className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-indigo-500" />
        </div>

        {/* 등급 라벨 행 (바 아래) */}
        <div className="relative mt-4 flex h-5 w-full">
          {segments.map((seg) => {
            const isActive = seg.grade === activeGrade;
            const isWide = seg.widthPct >= (gradeSystem === 9 ? 10 : 14);
            const isNarrow = seg.widthPct < MIN_WIDTH_FOR_LABEL;

            return (
              <div
                key={seg.grade}
                className="flex items-center justify-center overflow-hidden"
                style={{ flexBasis: `${seg.widthPct}%` }}
              >
                <span
                  className={`text-center text-[11px] leading-tight ${
                    isActive
                      ? "font-semibold text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isNarrow && !isActive ? "" : seg.grade}
                  {isWide && (
                    <span className="ml-0.5 font-normal opacity-50">
                      {Math.round(seg.widthPct)}%
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
