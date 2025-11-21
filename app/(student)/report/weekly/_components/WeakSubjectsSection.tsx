"use client";

type WeakSubjectsSectionProps = {
  subjects: Array<{
    subject: string;
    riskScore: number;
    trend: "improving" | "declining" | "stable";
    reason: string;
    studyTimeMinutes: number;
    studyTimeChange: number;
    scoreChange: number | null;
  }>;
};

const trendIcons: Record<string, string> = {
  improving: "📈",
  declining: "📉",
  stable: "➡️",
};

const trendLabels: Record<string, string> = {
  improving: "개선 중",
  declining: "하락 중",
  stable: "유지",
};

export function WeakSubjectsSection({ subjects }: WeakSubjectsSectionProps) {
  if (subjects.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">취약과목 추천</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {subjects.map((subject) => {
          const riskColor =
            subject.riskScore >= 70
              ? "border-red-300 bg-red-50"
              : subject.riskScore >= 50
              ? "border-orange-300 bg-orange-50"
              : "border-yellow-300 bg-yellow-50";

          return (
            <div key={subject.subject} className={`rounded-lg border p-4 ${riskColor}`}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-base font-semibold text-gray-900">{subject.subject}</h4>
                <span className="text-2xl">{trendIcons[subject.trend]}</span>
              </div>
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-600">위험도</span>
                  <span className="font-semibold text-gray-900">{subject.riskScore}점</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full ${
                      subject.riskScore >= 70
                        ? "bg-red-600"
                        : subject.riskScore >= 50
                        ? "bg-orange-600"
                        : "bg-yellow-600"
                    }`}
                    style={{ width: `${subject.riskScore}%` }}
                  />
                </div>
              </div>
              <p className="mb-2 text-xs text-gray-700">{subject.reason}</p>
              <div className="space-y-1 text-xs text-gray-600">
                <div>이번 주 학습: {subject.studyTimeMinutes}분</div>
                {subject.studyTimeChange !== 0 && (
                  <div
                    className={subject.studyTimeChange > 0 ? "text-green-600" : "text-red-600"}
                  >
                    {subject.studyTimeChange > 0 ? "▲" : "▼"} {Math.abs(subject.studyTimeChange)}분
                    (지난주 대비)
                  </div>
                )}
                {subject.scoreChange !== null && (
                  <div
                    className={subject.scoreChange < 0 ? "text-green-600" : "text-red-600"}
                  >
                    {subject.scoreChange < 0 ? "▲" : "▼"} 등급 변화
                  </div>
                )}
                <div className="text-gray-500">트렌드: {trendLabels[subject.trend]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

