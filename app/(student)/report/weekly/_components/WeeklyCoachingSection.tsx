import { getWeeklyCoaching } from "@/app/(student)/report/weekly/coachingAction";
import type { WeeklyCoaching } from "@/lib/coaching/engine";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
} from "@/lib/utils/darkMode";

type WeeklyCoachingSectionProps = {
  coaching: WeeklyCoaching;
};

export function WeeklyCoachingSection({ coaching }: WeeklyCoachingSectionProps) {
  return (
    <div className={cn("flex flex-col gap-6 rounded-xl border p-6 shadow-sm", borderDefaultVar, bgSurfaceVar)}>
      <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>이번주 코칭 요약</h2>

      {/* Summary */}
      <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-4">
        <p className="text-lg font-medium text-indigo-900 dark:text-indigo-200">{coaching.summary}</p>
      </div>

      {/* Highlights */}
      {coaching.highlights.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={cn("text-sm font-semibold", textSecondaryVar)}>잘한 점</h3>
          <ul className="flex flex-col gap-2">
            {coaching.highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className={cn("text-sm", textSecondaryVar)}>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {coaching.warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={cn("text-sm font-semibold", textSecondaryVar)}>주의할 점</h3>
          <ul className="flex flex-col gap-2">
            {coaching.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400">⚠</span>
                <span className="text-sm text-red-700 dark:text-red-300">{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Week Guide */}
      {coaching.nextWeekGuide.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={cn("text-sm font-semibold", textSecondaryVar)}>다음주 가이드</h3>
          <ul className="flex flex-col gap-2">
            {coaching.nextWeekGuide.map((guide, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400">→</span>
                <span className="text-sm text-yellow-800 dark:text-yellow-200">{guide}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

