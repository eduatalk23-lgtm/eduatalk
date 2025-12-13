import type { WeeklyCoaching } from "@/lib/coaching/engine";

type ParentWeeklyCoachingSectionProps = {
  coaching: WeeklyCoaching;
};

export function ParentWeeklyCoachingSection({ coaching }: ParentWeeklyCoachingSectionProps) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">이번주 학습 코칭 요약</h2>

      {/* Summary */}
      <div className="rounded-lg bg-indigo-50 p-4">
        <p className="text-lg font-medium text-indigo-900">{coaching.summary}</p>
      </div>

      {/* Highlights */}
      {coaching.highlights.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-700">잘한 점</h3>
          <ul className="flex flex-col gap-2">
            {coaching.highlights.map((highlight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm text-gray-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {coaching.warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-700">주의가 필요한 부분</h3>
          <ul className="flex flex-col gap-2">
            {coaching.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-red-600">⚠</span>
                <span className="text-sm text-red-700">{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Week Guide */}
      {coaching.nextWeekGuide.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-700">다음주 학습 가이드</h3>
          <ul className="flex flex-col gap-2">
            {coaching.nextWeekGuide.map((guide, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-600">→</span>
                <span className="text-sm text-yellow-800">{guide}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

