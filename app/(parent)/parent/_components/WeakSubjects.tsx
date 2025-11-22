import type { SubjectRiskAnalysis } from "@/app/(student)/analysis/_utils";

type WeakSubjectsProps = {
  subjects: SubjectRiskAnalysis[];
};

export function WeakSubjects({ subjects }: WeakSubjectsProps) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-orange-900">
          ⚠️ 취약 과목 경고
        </h3>
        <div className="flex flex-col gap-3">
          {subjects.map((subject) => (
            <div
              key={subject.subject}
              className="rounded-lg border border-orange-200 bg-white p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900">
                    {subject.subject}
                  </span>
                  <span className="text-sm font-bold text-orange-600">
                    위험도 {Math.round(subject.risk_score)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all"
                    style={{ width: `${subject.risk_score}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600">
                  최근 평균 등급: {subject.recent3AvgGrade.toFixed(1)}등급 | 일관성:{" "}
                  {subject.consistency_score.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

