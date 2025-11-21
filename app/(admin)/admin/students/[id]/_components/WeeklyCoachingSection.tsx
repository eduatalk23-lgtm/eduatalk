import { getWeeklyCoaching } from "@/app/(student)/report/weekly/coachingAction";
import type { WeeklyCoaching } from "@/lib/coaching/engine";

type WeeklyCoachingSectionProps = {
  studentId: string;
};

export async function WeeklyCoachingSection({ studentId }: WeeklyCoachingSectionProps) {
  const coachingResult = await getWeeklyCoaching(studentId);

  if (!coachingResult.success || !coachingResult.data) {
    return null;
  }

  const coaching = coachingResult.data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">주간 코칭 요약</h2>

      {/* Summary */}
      <div className="mb-6 rounded-lg bg-indigo-50 p-4">
        <p className="text-lg font-medium text-indigo-900">{coaching.summary}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Highlights */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">잘한 점</h3>
          {coaching.highlights.length > 0 ? (
            <ul className="space-y-2">
              {coaching.highlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 text-green-600">✓</span>
                  <span className="text-sm text-gray-700">{highlight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">이번주 잘한 점이 없습니다.</p>
          )}
        </div>

        {/* Warnings */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">주의할 점</h3>
          {coaching.warnings.length > 0 ? (
            <ul className="space-y-2">
              {coaching.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 text-red-600">⚠</span>
                  <span className="text-sm text-red-700">{warning}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">특별히 주의할 점이 없습니다.</p>
          )}
        </div>

        {/* Next Week Guide */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">다음주 가이드</h3>
          {coaching.nextWeekGuide.length > 0 ? (
            <ul className="space-y-2">
              {coaching.nextWeekGuide.map((guide, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 text-yellow-600">→</span>
                  <span className="text-sm text-yellow-800">{guide}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">다음주 가이드가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

