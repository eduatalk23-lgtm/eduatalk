"use client";

type AchievementInterpolationBarProps = {
  /** 성취도 비율 (%) — 합계 ≈ 100 */
  ratioA: number;
  ratioB: number;
  ratioC: number;
  ratioD: number;
  ratioE: number;
  /** 학생 성취도 (A~E) */
  achievementLevel: string;
  /** 원점수 */
  rawScore: number;
  /** 보간된 추정 백분위 (0~1, 상위 비율) */
  estimatedPercentile: number;
};

const LEVELS = ["A", "B", "C", "D", "E"] as const;

/** 성취도별 색상 (왼쪽=상위 A, 오른쪽=하위 E) */
const LEVEL_COLORS: Record<string, { active: string; inactive: string }> = {
  A: { active: "bg-indigo-500", inactive: "bg-indigo-200 dark:bg-indigo-900" },
  B: { active: "bg-indigo-400", inactive: "bg-indigo-100 dark:bg-indigo-900/60" },
  C: { active: "bg-sky-400", inactive: "bg-sky-100 dark:bg-sky-900/40" },
  D: { active: "bg-amber-400", inactive: "bg-amber-100 dark:bg-amber-900/40" },
  E: { active: "bg-gray-400", inactive: "bg-gray-200 dark:bg-gray-700" },
};

/** 성취도 구간 점수 범위 (ceiling, span) */
const SCORE_RANGES: Record<string, { ceiling: number; span: number }> = {
  A: { ceiling: 100, span: 10 },
  B: { ceiling: 90, span: 10 },
  C: { ceiling: 80, span: 10 },
  D: { ceiling: 70, span: 10 },
  E: { ceiling: 60, span: 60 },
};

/** 라벨 표시 최소 너비 (%) */
const MIN_WIDTH_FOR_LABEL = 5;
const MIN_WIDTH_FOR_PCT = 10;

export default function AchievementInterpolationBar({
  ratioA,
  ratioB,
  ratioC,
  ratioD,
  ratioE,
  achievementLevel,
  rawScore,
  estimatedPercentile,
}: AchievementInterpolationBarProps) {
  const ratios: Record<string, number> = {
    A: ratioA,
    B: ratioB,
    C: ratioC,
    D: ratioD,
    E: ratioE,
  };

  const total = ratioA + ratioB + ratioC + ratioD + ratioE;
  if (total <= 0) return null;

  const level = achievementLevel.toUpperCase();
  const markerLeftPct = estimatedPercentile * 100;

  const range = SCORE_RANGES[level];
  const posInBand = range
    ? `${level} 구간(${range.ceiling - range.span}~${range.ceiling}점) 내 ${rawScore}점`
    : `${level} 구간`;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        성취도비율 분포 (실제 학급 데이터)
      </p>

      <div className="relative">
        {/* 색상 바 */}
        <div className="flex h-7 w-full overflow-hidden rounded-md">
          {LEVELS.map((lv) => {
            const pct = (ratios[lv] / total) * 100;
            if (pct <= 0) return null;
            const isActive = lv === level;
            const colors = LEVEL_COLORS[lv];
            return (
              <div
                key={lv}
                className={`flex items-center justify-center transition-colors ${
                  isActive ? `${colors.active} text-white` : colors.inactive
                } ${lv !== LEVELS[LEVELS.length - 1] ? "border-r border-white/80 dark:border-gray-900" : ""}`}
                style={{ flexBasis: `${pct}%` }}
              >
                {isActive && pct >= MIN_WIDTH_FOR_LABEL && (
                  <span className="text-[11px] font-bold">{lv}</span>
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

        {/* 라벨 행 */}
        <div className="relative mt-4 flex h-5 w-full">
          {LEVELS.map((lv) => {
            const pct = (ratios[lv] / total) * 100;
            if (pct <= 0) return null;
            const isActive = lv === level;
            const showPct = pct >= MIN_WIDTH_FOR_PCT;
            const showLabel = pct >= MIN_WIDTH_FOR_LABEL || isActive;

            return (
              <div
                key={lv}
                className="flex items-center justify-center overflow-hidden"
                style={{ flexBasis: `${pct}%` }}
              >
                {showLabel && (
                  <span
                    className={`text-center text-[11px] leading-tight ${
                      isActive
                        ? "font-semibold text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {lv}
                    {showPct && (
                      <span className="ml-0.5 font-normal opacity-50">
                        {ratios[lv].toFixed(0)}%
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 보간 설명 */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {posInBand} → 상위 {(estimatedPercentile * 100).toFixed(1)}% 추정
      </p>
    </div>
  );
}
