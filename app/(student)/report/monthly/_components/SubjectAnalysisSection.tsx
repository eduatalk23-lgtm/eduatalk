"use client";

type SubjectAnalysisSectionProps = {
  strongSubjects: string[];
  weakSubjects: string[];
};

export function SubjectAnalysisSection({
  strongSubjects,
  weakSubjects,
}: SubjectAnalysisSectionProps) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">과목 분석</h3>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 강점 과목 */}
        <div className="flex flex-col gap-4">
          <h4 className="text-base font-medium text-green-700">강점 과목</h4>
          {strongSubjects.length > 0 ? (
            <div className="flex flex-col gap-2">
              {strongSubjects.map((subject) => (
                <div
                  key={subject}
                  className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800"
                >
                  {subject}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">강점 과목이 없습니다</p>
          )}
        </div>

        {/* 약점 과목 */}
        <div className="flex flex-col gap-4">
          <h4 className="text-base font-medium text-red-700">약점 과목</h4>
          {weakSubjects.length > 0 ? (
            <div className="flex flex-col gap-2">
              {weakSubjects.map((subject) => (
                <div
                  key={subject}
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"
                >
                  {subject}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">약점 과목이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}

