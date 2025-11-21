import type { PlanContent } from "@/lib/types/plan";

const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
};

type Step4DetailViewProps = {
  contents: Array<PlanContent & {
    contentTitle: string;
    contentSubtitle: string | null;
    isRecommended: boolean;
  }>;
};

export function Step4DetailView({ contents }: Step4DetailViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">추천 콘텐츠</h2>
        <p className="mt-1 text-sm text-gray-500">
          시스템에서 추천한 학습 콘텐츠를 확인할 수 있습니다.
        </p>
      </div>

      {contents.length > 0 ? (
        <div className="space-y-3">
          {contents.map((content) => (
            <div
              key={content.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{contentTypeLabels[content.content_type]}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {content.contentTitle}
                    </span>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                      추천 콘텐츠
                    </span>
                  </div>
                  {content.contentSubtitle && (
                    <p className="mt-1 text-sm text-gray-600">{content.contentSubtitle}</p>
                  )}
                  <p className="mt-2 text-sm text-gray-700">
                    범위: {content.start_range} ~ {content.end_range}
                    {content.content_type === "book" && " 페이지"}
                    {content.content_type === "lecture" && " 회차"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">추천된 콘텐츠가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

