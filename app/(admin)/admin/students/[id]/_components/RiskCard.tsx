import { getStudentRiskScore } from "@/lib/risk/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RiskCardProps = {
  studentId: string;
};

export async function RiskCard({ studentId }: RiskCardProps) {
  const supabase = await createSupabaseServerClient();
  const risk = await getStudentRiskScore(supabase, studentId);

  const levelColors = {
    high: "border-red-500 bg-red-50",
    medium: "border-yellow-500 bg-yellow-50",
    low: "border-green-500 bg-green-50",
  };

  const levelBadgeColors = {
    high: "bg-red-500 text-white",
    medium: "bg-yellow-500 text-white",
    low: "bg-green-500 text-white",
  };

  const levelLabels = {
    high: "높음",
    medium: "보통",
    low: "낮음",
  };

  const { thisWeekMinutes, lastWeekMinutes, changePercent, changeMinutes } = risk.metrics.studyTime;
  const studyTimeChange = changeMinutes > 0 ? `+${changeMinutes}` : `${changeMinutes}`;
  const studyTimeChangePercent = changePercent > 0 ? `+${changePercent}` : `${changePercent}`;

  return (
    <div className={`rounded-lg border-2 p-6 shadow-sm ${levelColors[risk.level]}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">위험도 평가</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${levelBadgeColors[risk.level]}`}
        >
          {levelLabels[risk.level]}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">위험 점수</span>
          <span className="text-2xl font-bold text-gray-900">{risk.riskScore}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all ${
              risk.level === "high"
                ? "bg-red-500"
                : risk.level === "medium"
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${risk.riskScore}%` }}
          />
        </div>
      </div>

      {risk.reasons.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">위험 요인</h3>
          <ul className="space-y-1">
            {risk.reasons.map((reason, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1 text-red-500">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">지난주 대비 학습 변화</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">이번주</span>
            <p className="font-semibold text-gray-900">{Math.floor(thisWeekMinutes / 60)}시간</p>
          </div>
          <div>
            <span className="text-gray-500">지난주</span>
            <p className="font-semibold text-gray-900">{Math.floor(lastWeekMinutes / 60)}시간</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">변화</span>
            <p
              className={`font-semibold ${
                changeMinutes > 0 ? "text-green-600" : changeMinutes < 0 ? "text-red-600" : "text-gray-600"
              }`}
            >
              {studyTimeChange}분 ({studyTimeChangePercent}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

