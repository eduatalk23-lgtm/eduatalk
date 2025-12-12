"use client";

import { ProgressBar } from "@/components/atoms/ProgressBar";

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
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">콘텐츠 진행률</h3>
        <div className="flex flex-col gap-4">
          {progressList.map((item, index) => (
            <div
              key={`${item.contentType}:${item.contentId}:${index}`}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
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
                <ProgressBar value={item.progress} height="md" />
                {item.progressChange > 0 && (
                  <p className="text-xs text-green-600">이번 달 +{item.progressChange}% 증가</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

