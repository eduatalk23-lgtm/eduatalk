"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ComputationMeta } from "@/lib/domains/score/computation";
import { percentileToGrade5 } from "@/lib/domains/score/computation";
import BellCurveSVG from "./BellCurveSVG";
import GradeBandBar from "./GradeBandBar";
import AchievementInterpolationBar from "./AchievementInterpolationBar";
import ConfidencePanel from "./ConfidencePanel";

type ScoreConfidenceChartProps = {
  /** 상위 백분위 (0~1) */
  percentile: number;
  /** 원본 등급 체계 */
  gradeSystem: 5 | 9;
  meta: ComputationMeta;
  /** 9등급 환산 결과 */
  convertedGrade9?: number | null;
  /** 성취도비율 보간 차트용 데이터 (있을 때만 표시) */
  achievement?: {
    ratioA: number;
    ratioB: number;
    ratioC: number;
    ratioD: number;
    ratioE: number;
    level: string;
    rawScore: number;
  } | null;
};

export default function ScoreConfidenceChart({
  percentile,
  gradeSystem,
  meta,
  convertedGrade9,
  achievement,
}: ScoreConfidenceChartProps) {
  const [open, setOpen] = useState(false);

  const grade9 = convertedGrade9 ?? 5;
  const is5Grade = gradeSystem === 5;
  const grade5 = is5Grade ? percentileToGrade5(percentile) : null;

  const showAchievement =
    achievement &&
    achievement.level &&
    achievement.ratioA + achievement.ratioB + achievement.ratioC +
      achievement.ratioD + achievement.ratioE > 0;

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        산출 근거 {open ? "숨기기" : "보기"}
      </button>

      {/* Collapsible content — grid-rows transition for smooth open/close */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
        <div className="mt-3 space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          {/* ❶ 등급 구간 — 2열 그리드 (5등급+9등급 나란히) */}
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
              등급 구간
            </p>
            <div className={`grid gap-x-6 gap-y-4 ${is5Grade ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {is5Grade && grade5 !== null && (
                <GradeBandBar
                  percentile={percentile}
                  gradeSystem={5}
                  activeGrade={grade5}
                  label="원본 (5등급제)"
                />
              )}
              <GradeBandBar
                percentile={percentile}
                gradeSystem={9}
                activeGrade={grade9}
                label={is5Grade ? "9등급 환산" : undefined}
              />
            </div>
          </section>

          {/* ❷ 성취도비율 보간 (데이터 있을 때만) */}
          {showAchievement && achievement && (
            <section>
              <AchievementInterpolationBar
                ratioA={achievement.ratioA}
                ratioB={achievement.ratioB}
                ratioC={achievement.ratioC}
                ratioD={achievement.ratioD}
                ratioE={achievement.ratioE}
                achievementLevel={achievement.level}
                rawScore={achievement.rawScore}
                estimatedPercentile={percentile}
              />
            </section>
          )}

          {/* ❸ 정규분포 위치 — max-width 제한으로 적절한 크기 유지 */}
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              정규분포 위치 (9등급 기준)
            </p>
            <div className="mx-auto max-w-xl">
              <BellCurveSVG percentile={percentile} />
            </div>
          </section>

          {/* ❹ 산출 근거 */}
          <section className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <ConfidencePanel meta={meta} />
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
