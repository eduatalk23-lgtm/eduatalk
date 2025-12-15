import { BookDetail, ContentDetailData, LectureEpisode } from "../types";

type ContentRangeSelectorProps = {
  contentId: string;
  contentType: "book" | "lecture";
  contentInfo: ContentDetailData;
  range: { start: string; end: string } | undefined;
  startDetailId: string | undefined;
  endDetailId: string | undefined;
  onSetStartDetail: (id: string) => void;
  onSetEndDetail: (id: string) => void;
  onUpdateRange: (field: "start" | "end", value: string) => void;
  editable: boolean;
};

export function ContentRangeSelector({
  contentId,
  contentType,
  contentInfo,
  range,
  startDetailId,
  endDetailId,
  onSetStartDetail,
  onSetEndDetail,
  onUpdateRange,
  editable,
}: ContentRangeSelectorProps) {
  if (contentInfo.details.length === 0) {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-gray-800">
            {contentType === "book" ? "시작 페이지" : "시작 강의 번호"}
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
            placeholder={contentType === "book" ? "예: 1" : "예: 1"}
            min={0}
            value={range?.start || ""}
            onChange={(e) => onUpdateRange("start", e.target.value)}
            disabled={!editable}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-gray-800">
            {contentType === "book" ? "종료 페이지" : "종료 강의 번호"}
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
            placeholder={contentType === "book" ? "예: 150" : "예: 20"}
            min={0}
            value={range?.end || ""}
            onChange={(e) => onUpdateRange("end", e.target.value)}
            disabled={!editable}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* 시작 범위 선택 */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-gray-800">
            시작 범위 선택
          </div>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
            <div className="space-y-1">
              {contentType === "book"
                ? (contentInfo.details as BookDetail[]).map((detail) => {
                    const isSelected = startDetailId === detail.id;
                    return (
                      <label
                        key={detail.id}
                        className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`start-${contentId}`}
                          checked={isSelected}
                          onChange={() => onSetStartDetail(detail.id)}
                          disabled={!editable}
                          className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="flex flex-1 items-center gap-1 text-xs">
                          <span className="font-medium">
                            페이지 {detail.page_number}
                          </span>
                          {detail.major_unit && (
                            <span className="text-gray-600">
                              · {detail.major_unit}
                              {detail.minor_unit && ` - ${detail.minor_unit}`}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                : (contentInfo.details as LectureEpisode[]).map((detail) => {
                    const isSelected = startDetailId === detail.id;
                    return (
                      <label
                        key={detail.id}
                        className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`start-${contentId}`}
                          checked={isSelected}
                          onChange={() => onSetStartDetail(detail.id)}
                          disabled={!editable}
                          className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="flex flex-1 items-center gap-1 text-xs">
                          <span className="font-medium">
                            {detail.episode_number}강
                          </span>
                          {detail.episode_title && (
                            <span className="text-gray-600">
                              · {detail.episode_title}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* 끝 범위 선택 */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-gray-800">
            끝 범위 선택
          </div>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
            <div className="space-y-1">
              {contentType === "book"
                ? (contentInfo.details as BookDetail[]).map((detail) => {
                    const isSelected = endDetailId === detail.id;
                    return (
                      <label
                        key={detail.id}
                        className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`end-${contentId}`}
                          checked={isSelected}
                          onChange={() => onSetEndDetail(detail.id)}
                          disabled={!editable}
                          className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="flex flex-1 items-center gap-1 text-xs">
                          <span className="font-medium">
                            페이지 {detail.page_number}
                          </span>
                          {detail.major_unit && (
                            <span className="text-gray-600">
                              · {detail.major_unit}
                              {detail.minor_unit && ` - ${detail.minor_unit}`}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                : (contentInfo.details as LectureEpisode[]).map((detail) => {
                    const isSelected = endDetailId === detail.id;
                    return (
                      <label
                        key={detail.id}
                        className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`end-${contentId}`}
                          checked={isSelected}
                          onChange={() => onSetEndDetail(detail.id)}
                          disabled={!editable}
                          className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="flex flex-1 items-center gap-1 text-xs">
                          <span className="font-medium">
                            {detail.episode_number}강
                          </span>
                          {detail.episode_title && (
                            <span className="text-gray-600">
                              · {detail.episode_title}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
            </div>
          </div>
        </div>
      </div>

      {range && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <div className="text-xs font-medium text-gray-800">
            선택된 범위: {range.start} ~ {range.end}{" "}
            {contentType === "book" ? "페이지" : "강"}
          </div>
          {(() => {
            if (contentType === "book") {
              const details = contentInfo.details as BookDetail[];
              const startPage = Number(range.start);
              const endPage = Number(range.end);
              const rangeDetails = details.filter(
                (d) => d.page_number >= startPage && d.page_number <= endPage
              );
              if (rangeDetails.length > 0) {
                return (
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <div className="font-medium">포함된 단원:</div>
                    <div className="flex flex-col gap-0.5">
                      {rangeDetails.map((d, idx) => (
                        <div key={idx}>
                          페이지 {d.page_number}
                          {d.major_unit && (
                            <span className="text-gray-600">
                              {" "}
                              · {d.major_unit}
                              {d.minor_unit && ` - ${d.minor_unit}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            } else {
              // Lecture range details display (optional, based on original)
              const episodes = contentInfo.details as LectureEpisode[];
              const startNum = Number(range.start);
              const endNum = Number(range.end);
              const rangeEpisodes = episodes.filter(
                (e) =>
                  e.episode_number >= startNum && e.episode_number <= endNum
              );
               if (rangeEpisodes.length > 0) {
                return (
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <div className="font-medium">포함된 강의:</div>
                    <div className="flex flex-col gap-0.5">
                      {rangeEpisodes.map((e, idx) => (
                        <div key={idx}>
                          {e.episode_number}강 
                          {e.episode_title && (
                             <span className="text-gray-600"> · {e.episode_title}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            }
            return null;
          })()}
        </div>
      )}
    </>
  );
}
