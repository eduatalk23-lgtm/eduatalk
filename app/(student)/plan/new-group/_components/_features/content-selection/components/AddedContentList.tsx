import { isFromMaster } from "@/lib/utils/contentMaster";

type AddedContentListProps = {
  contents: {
    books: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
    }>;
    lectures: Array<{
      id: string;
      title: string;
      subtitle?: string | null;
      master_content_id?: string | null;
      master_lecture_id?: string | null;
    }>;
  };
  studentContents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
    start_range: number;
    end_range: number;
    title?: string;
    subject_category?: string;
  }>;
  onRemove: (index: number) => void;
  editable: boolean;
};

export function AddedContentList({
  contents,
  studentContents,
  onRemove,
  editable,
}: AddedContentListProps) {
  const getContentTitle = (
    contentType: "book" | "lecture",
    contentId: string,
    savedTitle?: string
  ): string => {
    if (savedTitle) return savedTitle;

    if (contentType === "book") {
      const content = contents.books.find((c) => c.id === contentId);
      return content?.title || "알 수 없음";
    } else {
      const content = contents.lectures.find((c) => c.id === contentId);
      return content?.title || "알 수 없음";
    }
  };

  const getContentSubtitle = (
    contentType: "book" | "lecture",
    contentId: string,
    savedSubtitle?: string
  ): string | null => {
    if (savedSubtitle) return savedSubtitle;

    if (contentType === "book") {
      const content = contents.books.find((c) => c.id === contentId);
      return content?.subtitle || null;
    } else {
      const content = contents.lectures.find((c) => c.id === contentId);
      return content?.subtitle || null;
    }
  };

  if (studentContents.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-600">추가된 콘텐츠가 없습니다.</p>
        <p className="text-xs text-gray-600">
          위 폼에서 콘텐츠를 선택하고 범위를 입력한 후 추가해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-medium text-gray-600">
        <span>추가된 학생 콘텐츠 ({studentContents.length}개)</span>
      </div>
      {studentContents.map((content, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-gray-900">
                {getContentTitle(
                  content.content_type,
                  content.content_id,
                  content.title
                )}
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                학생 콘텐츠
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>
                {content.content_type === "book" && "📚 책"}
                {content.content_type === "lecture" && "🎧 강의"}
              </span>
              {(() => {
                const contentType = content.content_type;
                const contentId = content.content_id;
                const foundContent =
                  contentType === "book"
                    ? contents.books.find((b) => b.id === contentId)
                    : contents.lectures.find((l) => l.id === contentId);
                return foundContent && isFromMaster(foundContent) ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                    📦 마스터에서 가져옴
                  </span>
                ) : null;
              })()}
              {getContentSubtitle(
                content.content_type,
                content.content_id,
                content.subject_category
              ) && (
                <>
                  <span>·</span>
                  <span>
                    {getContentSubtitle(
                      content.content_type,
                      content.content_id,
                      content.subject_category
                    )}
                  </span>
                </>
              )}
              <span>·</span>
              <span>
                {content.start_range} ~ {content.end_range}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={!editable}
            className={`text-sm ${
              !editable
                ? "cursor-not-allowed text-gray-600"
                : "text-red-600 hover:text-red-800"
            }`}
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}
