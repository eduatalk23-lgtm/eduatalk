
import { WizardData } from "../PlanGroupWizard";
import { ContentInfo, BookDetail, LectureEpisode } from "./types";

type ContentListProps = {
  type: "student" | "recommended";
  contents: WizardData["student_contents"] | WizardData["recommended_contents"];
  contentInfos: ContentInfo[];
  recommendedRanges: Map<
    string,
    { start: number; end: number; reason: string }
  >;
  rangeUnavailableReasons: Map<string, string>;
  editingRangeIndex: { type: "student" | "recommended"; index: number } | null;
  editingRange: { start: string; end: string } | null;
  contentDetails: Map<
    string,
    { details: BookDetail[] | LectureEpisode[]; type: "book" | "lecture" }
  >;
  loadingDetails: Set<string>;
  startDetailId: Map<string, string>;
  endDetailId: Map<string, string>;
  onUpdateContents: (
    newContents:
      | WizardData["student_contents"]
      | WizardData["recommended_contents"]
  ) => void;
  // editing callbacks
  setEditingRangeIndex: (
    value: { type: "student" | "recommended"; index: number } | null
  ) => void;
  setEditingRange: (value: { start: string; end: string } | null) => void;
  setStartRange: (detailId: string) => void;
  setEndRange: (detailId: string) => void;
};

export function ContentList({
  type,
  contents,
  contentInfos,
  recommendedRanges,
  rangeUnavailableReasons,
  editingRangeIndex,
  editingRange,
  contentDetails,
  loadingDetails,
  startDetailId,
  endDetailId,
  onUpdateContents,
  setEditingRangeIndex,
  setEditingRange,
  setStartRange,
  setEndRange,
}: ContentListProps) {
  if (contents.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {type === "student" ? "추가한 학생 콘텐츠" : "추천 콘텐츠"}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            type === "student"
              ? "bg-blue-100 text-blue-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {contents.length}개
        </span>
      </div>
      <div className="space-y-2">
        {contents.map((content, index) => {
          const info = contentInfos.find(
            (c) =>
              c.content_id === content.content_id &&
              c.isRecommended === (type === "recommended")
          );
          if (!info) return null;

          const isEditing =
            editingRangeIndex?.type === type &&
            editingRangeIndex.index === index;
          const contentKey = `${type}-${index}`;

          return (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900">
                    {info.title}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      type === "student"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {type === "student" ? "학생 콘텐츠" : "추천 콘텐츠"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {content.content_type === "book" && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                      📚 교재
                    </span>
                  )}
                  {content.content_type === "lecture" && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                      🎧 강의
                    </span>
                  )}
                  {info.subject && (
                    <>
                      <span>·</span>
                      <span>{info.subject}</span>
                    </>
                  )}
                  {info.semester && (
                    <>
                      <span>·</span>
                      <span>{info.semester}</span>
                    </>
                  )}
                  {info.revision && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-indigo-600">
                        {info.revision} 개정판
                      </span>
                    </>
                  )}
                  {info.difficulty_level && (
                    <>
                      <span>·</span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                        {info.difficulty_level}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  {isEditing ? (
                    (() => {
                      const contentInfo = contentDetails.get(contentKey);
                      const isLoading = loadingDetails.has(contentKey);
                      const selectedStartId = startDetailId.get(contentKey);
                      const selectedEndId = endDetailId.get(contentKey);
                      const recommendedRange =
                        recommendedRanges.get(contentKey);

                      return (
                        <div className="space-y-3">
                          {recommendedRange && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-xs font-medium text-blue-800">
                                    💡 추천 범위: {recommendedRange.start} ~{" "}
                                    {recommendedRange.end}
                                    {content.content_type === "book"
                                      ? " 페이지"
                                      : " 회차"}
                                  </div>
                                  <div className="text-xs text-blue-800">
                                    {recommendedRange.reason}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRange({
                                      start: String(recommendedRange.start),
                                      end: String(recommendedRange.end),
                                    });
                                  }}
                                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  적용
                                </button>
                              </div>
                            </div>
                          )}

                          {isLoading ? (
                            <div className="text-xs text-gray-600">
                              상세 정보를 불러오는 중...
                            </div>
                          ) : contentInfo && contentInfo.details.length > 0 ? (
                            <div className="space-y-3">
                              {/* 시작 범위 선택 */}
                              <div className="flex flex-col gap-2">
                                <div className="text-xs font-medium text-gray-600">
                                  시작 범위 선택
                                </div>
                                <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                  <div className="flex flex-col gap-1">
                                    {contentInfo.type === "book"
                                      ? (
                                          contentInfo.details as BookDetail[]
                                        ).map((detail) => {
                                          const isSelected =
                                            selectedStartId === detail.id;
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
                                                name={`start-${type}-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setStartRange(detail.id)
                                                }
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  페이지 {detail.page_number}
                                                </span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-600">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit &&
                                                      ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      : (
                                          contentInfo.details as LectureEpisode[]
                                        ).map((episode) => {
                                          const isSelected =
                                            selectedStartId === episode.id;
                                          return (
                                            <label
                                              key={episode.id}
                                              className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                                isSelected
                                                  ? "border-blue-500 bg-blue-50"
                                                  : "border-gray-200 hover:bg-gray-50"
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`start-${type}-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setStartRange(episode.id)
                                                }
                                                className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  {episode.episode_number}회차
                                                </span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-600">
                                                    · {episode.episode_title}
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
                                <div className="text-xs font-medium text-gray-600">
                                  끝 범위 선택
                                </div>
                                <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                                  <div className="flex flex-col gap-1">
                                    {contentInfo.type === "book"
                                      ? (
                                          contentInfo.details as BookDetail[]
                                        ).map((detail) => {
                                          const isSelected =
                                            selectedEndId === detail.id;
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
                                                name={`end-${type}-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setEndRange(detail.id)
                                                }
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  페이지 {detail.page_number}
                                                </span>
                                                {detail.major_unit && (
                                                  <span className="ml-2 text-gray-600">
                                                    · {detail.major_unit}
                                                    {detail.minor_unit &&
                                                      ` - ${detail.minor_unit}`}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })
                                      : (
                                          contentInfo.details as LectureEpisode[]
                                        ).map((episode) => {
                                          const isSelected =
                                            selectedEndId === episode.id;
                                          return (
                                            <label
                                              key={episode.id}
                                              className={`flex cursor-pointer items-center gap-2 rounded border p-1.5 transition-colors ${
                                                isSelected
                                                  ? "border-green-500 bg-green-50"
                                                  : "border-gray-200 hover:bg-gray-50"
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`end-${type}-${index}`}
                                                checked={isSelected}
                                                onChange={() =>
                                                  setEndRange(episode.id)
                                                }
                                                className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                              />
                                              <div className="flex-1 text-xs">
                                                <span className="font-medium">
                                                  {episode.episode_number}회차
                                                </span>
                                                {episode.episode_title && (
                                                  <span className="ml-2 text-gray-600">
                                                    · {episode.episode_title}
                                                  </span>
                                                )}
                                              </div>
                                            </label>
                                          );
                                        })}
                                  </div>
                                </div>
                              </div>
                              {/* 선택된 범위 및 포함된 상세정보 표시 */}
                              {editingRange && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                  <div className="text-xs font-medium text-gray-600">
                                    선택된 범위: {editingRange.start} ~{" "}
                                    {editingRange.end}
                                    {content.content_type === "book"
                                      ? " 페이지"
                                      : " 회차"}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={
                                  editingRange?.start || content.start_range
                                }
                                onChange={(e) =>
                                  setEditingRange({
                                    start: e.target.value,
                                    end:
                                      editingRange?.end ||
                                      String(content.end_range),
                                  })
                                }
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                placeholder="시작"
                              />
                              <span>~</span>
                              <input
                                type="number"
                                min={1}
                                value={editingRange?.end || content.end_range}
                                onChange={(e) =>
                                  setEditingRange({
                                    start:
                                      editingRange?.start ||
                                      String(content.start_range),
                                    end: e.target.value,
                                  })
                                }
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
                                placeholder="종료"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (editingRange) {
                                  const start = Number(editingRange.start);
                                  const end = Number(editingRange.end);
                                  if (
                                    !isNaN(start) &&
                                    !isNaN(end) &&
                                    start <= end &&
                                    start > 0
                                  ) {
                                    // 기존 contents 배열을 복사
                                    const updated = [...contents];
                                    const startDetailIdValue =
                                      startDetailId.get(contentKey) || null;
                                    const endDetailIdValue =
                                      endDetailId.get(contentKey) || null;
                                    
                                    // any 타입으로 캐스팅하여 업데이트 (WizardData 타입 호환성)
                                    // 실제로는 student_contents와 recommended_contents 타입이 거의 동일함
                                    updated[index] = {
                                      ...content,
                                      start_range: start,
                                      end_range: end,
                                      start_detail_id: startDetailIdValue,
                                      end_detail_id: endDetailIdValue,
                                    } as any;

                                    onUpdateContents(updated);
                                    setEditingRangeIndex(null);
                                    setEditingRange(null);
                                    // 상세정보 선택 초기화는 상위 컴포넌트에서 editingRangeIndex 변경 감지로 처리되거나 여기서 직접 처리?
                                    // 상위 컴포넌트의 useContentDetails가 editingRangeIndex에 의존하므로 null로 설정하면 reset됨 (hook 내부적으로는 아님, hook 내부 state는 별도)
                                    // 상위에서 처리하는게 맞지만 여기서 hook의 set 함수를 호출했으므로, 
                                    // hook을 사용하는 쪽에서 editingRangeIndex가 null이 되면 state를 정리하는 로직이 있으면 좋음.
                                    // 현재 useContentDetails는 editingRangeIndex가 있으면 fetch하지만 없으면?
                                    // 여기서는 그냥 닫기.
                                  } else {
                                    alert(
                                      "올바른 범위를 입력해주세요. (시작 ≤ 종료, 양수)"
                                    );
                                  }
                                }
                              }}
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRangeIndex(null);
                                setEditingRange(null);
                              }}
                              className="rounded bg-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-400"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="font-medium">
                      {content.start_range} ~ {content.end_range}
                      {content.content_type === "book" ? " 페이지" : " 회차"}
                    </span>
                  )}
                </div>
              </div>
              {!isEditing &&
                (() => {
                  const recommendedRange = recommendedRanges.get(contentKey);
                  const unavailableReason =
                    rangeUnavailableReasons.get(contentKey);
                  const range = content.end_range - content.start_range + 1;
                  const recRange = recommendedRange
                    ? recommendedRange.end - recommendedRange.start + 1
                    : null;
                  const difference =
                    recRange !== null ? range - recRange : null;

                  return (
                    <div className="flex flex-col items-end gap-2">
                       {recommendedRange ? (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs">
                          <div className="font-medium text-blue-800">
                            💡 추천: {recommendedRange.start} ~{" "}
                            {recommendedRange.end}
                            {content.content_type === "book"
                              ? " 페이지"
                              : " 회차"}
                          </div>
                          {difference !== null && difference !== 0 && (
                            <div
                              className={`text-xs ${
                                difference > 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {difference > 0 ? "+" : ""}
                              {difference}{" "}
                              {content.content_type === "book"
                                ? "페이지"
                                : "회차"}{" "}
                              차이
                            </div>
                          )}
                        </div>
                      ) : unavailableReason ? (
                        <div className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                          <div className="text-gray-600">추천 범위 없음</div>
                          <div className="text-gray-600">
                            ({unavailableReason})
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRangeIndex({
                              type,
                              index,
                            });
                            setEditingRange({
                              start: String(content.start_range),
                              end: String(content.end_range),
                            });
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          범위 수정
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = contents.filter(
                              (_, i) => i !== index
                            );
                            onUpdateContents(updated);
                          }}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
