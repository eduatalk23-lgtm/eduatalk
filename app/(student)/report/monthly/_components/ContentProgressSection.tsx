"use client";

type ContentProgressSectionProps = {
  progressList: Array<{
    contentType: "book" | "lecture" | "custom";
    contentId: string;
    title: string;
    subject: string | null;
    progress: number;
    progressChange: number;
  }>;
};

const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
};

export function ContentProgressSection({ progressList }: ContentProgressSectionProps) {
  if (progressList.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">콘텐츠 진행률</h3>
      <div className="space-y-4">
        {progressList.map((item) => (
          <div key={`${item.contentType}:${item.contentId}`} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{contentTypeLabels[item.contentType]}</span>
                <h4 className="text-sm font-semibold text-gray-900">{item.title}</h4>
                {item.subject && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {item.subject}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{item.progress}%</span>
            </div>
            <div className="mb-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    item.progress >= 100
                      ? "bg-green-600"
                      : item.progress >= 50
                      ? "bg-indigo-600"
                      : "bg-orange-600"
                  }`}
                  style={{ width: `${Math.min(100, item.progress)}%` }}
                />
              </div>
            </div>
            {item.progressChange > 0 && (
              <p className="text-xs text-green-600">이번 달 +{item.progressChange}% 증가</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

