import { ContentDetailData, ContentMetadata } from "../types";
import { ContentRangeSelector } from "./ContentRangeSelector";
import { isFromMaster } from "@/lib/utils/contentMaster";

type ContentItemProps = {
  item: {
    id: string;
    title: string;
    subtitle?: string | null;
    master_content_id?: string | null;
    master_lecture_id?: string | null;
  };
  contentType: "book" | "lecture";
  isSelected: boolean;
  onToggle: () => void;
  metadata?: ContentMetadata;
  contentInfo?: ContentDetailData;
  isLoading?: boolean;
  range?: { start: string; end: string };
  startDetailId?: string;
  endDetailId?: string;
  onSetStartDetail: (id: string) => void;
  onSetEndDetail: (id: string) => void;
  onUpdateRange: (field: "start" | "end", value: string) => void;
  editable: boolean;
};

export function ContentItem({
  item,
  contentType,
  isSelected,
  onToggle,
  metadata,
  contentInfo,
  isLoading,
  range,
  startDetailId,
  endDetailId,
  onSetStartDetail,
  onSetEndDetail,
  onUpdateRange,
  editable,
}: ContentItemProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        isSelected
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={!editable}
        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-sm font-medium text-gray-900">
              {item.title}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span
                className={`rounded px-1.5 py-0.5 ${
                  contentType === "book"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {contentType === "book" ? "📚 교재" : "🎧 강의"}
              </span>
              {isFromMaster(item) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                  📦 마스터에서 가져옴
                </span>
              )}
              {metadata?.subject && (
                <>
                  <span>·</span>
                  <span>{metadata.subject}</span>
                </>
              )}
              {metadata?.semester && (
                <>
                  <span>·</span>
                  <span>{metadata.semester}</span>
                </>
              )}
              {metadata?.revision && (
                <>
                  <span>·</span>
                  <span className="font-medium text-indigo-600">
                    {metadata.revision}
                  </span>
                </>
              )}
              {metadata?.difficulty_level && (
                <>
                  <span>·</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                    {metadata.difficulty_level}
                  </span>
                </>
              )}
              {metadata?.publisher && (
                <>
                  <span>·</span>
                  <span>{metadata.publisher}</span>
                </>
              )}
              {metadata?.platform && (
                <>
                  <span>·</span>
                  <span>{metadata.platform}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 선택된 경우 상세 정보 표시 */}
        {isSelected && (
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="text-xs text-gray-600">
                상세 정보를 불러오는 중...
              </div>
            ) : contentInfo ? (
              <ContentRangeSelector
                contentId={item.id}
                contentType={contentType}
                contentInfo={contentInfo}
                range={range}
                startDetailId={startDetailId}
                endDetailId={endDetailId}
                onSetStartDetail={onSetStartDetail}
                onSetEndDetail={onSetEndDetail}
                onUpdateRange={onUpdateRange}
                editable={editable}
              />
            ) : null}
          </div>
        )}
      </div>
    </label>
  );
}
