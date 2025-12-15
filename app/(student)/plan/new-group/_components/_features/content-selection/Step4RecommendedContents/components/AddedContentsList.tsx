/**
 * AddedContentsList
 * 추가된 추천 콘텐츠 목록 (범위 편집 포함)
 */

"use client";

import { BookDetail, LectureEpisode, RecommendedContent } from "../types";
import { Pencil, Check, X, Trash2 } from "lucide-react";

type AddedContentsListProps = {
  contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    title?: string;
    subject_category?: string;
  }>;
  allRecommendedContents: RecommendedContent[];
  editingRangeIndex: number | null;
  editingRange: { start: string; end: string } | null;
  contentDetails: Map<
    number,
    { details: (BookDetail | LectureEpisode)[]; type: "book" | "lecture" }
  >;
  startDetailId: Map<number, string>;
  endDetailId: Map<number, string>;
  contentTotals: Map<number, number>;
  loadingDetails: Set<number>;
  onStartEditing: (index: number) => void;
  onSaveRange: () => void;
  onCancelEditing: () => void;
  onRemove: (index: number) => void;
  onStartDetailChange: (index: number, detailId: string) => void;
  onEndDetailChange: (index: number, detailId: string) => void;
  onRangeChange?: (start: string, end: string) => void;
};

export default function AddedContentsList({
  contents,
  allRecommendedContents,
  editingRangeIndex,
  editingRange,
  contentDetails,
  startDetailId,
  endDetailId,
  contentTotals,
  loadingDetails,
  onStartEditing,
  onSaveRange,
  onCancelEditing,
  onRemove,
  onStartDetailChange,
  onEndDetailChange,
  onRangeChange,
}: AddedContentsListProps) {
  if (contents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm font-medium text-gray-800">
        <span>
          {allRecommendedContents.length > 0
            ? `추가된 추천 콘텐츠 (${contents.length}개)`
            : `등록된 콘텐츠 (${contents.length}개)`}
        </span>
      </div>
      {contents.map((content, index) => {
        // 제목 및 과목 정보 조회
        let title = content.title;
        let subjectCategory = content.subject_category;

        // allRecommendedContents에서 조회
        const recommendedContent = allRecommendedContents.find(
          (c) => c.id === content.content_id
        );
        if (recommendedContent) {
          title = title || recommendedContent.title;
          subjectCategory =
            subjectCategory ||
            recommendedContent.subject_category ||
            undefined;
        }

        // 여전히 없으면 "알 수 없음"
        if (!title) {
          title = "알 수 없음";
        }

        const isEditing = editingRangeIndex === index;
        const contentInfo = contentDetails.get(index);
        const isLoading = loadingDetails.has(index);
        const selectedStartId = startDetailId.get(index);
        const selectedEndId = endDetailId.get(index);

        return (
          <div
            key={index}
            className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {title}
                    </div>
                    {allRecommendedContents.length > 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        추천 콘텐츠
                      </span>
                    )}
                    {allRecommendedContents.length === 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        학생 콘텐츠
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
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
                    {recommendedContent?.subject && (
                      <>
                        <span>·</span>
                        <span>{recommendedContent.subject}</span>
                      </>
                    )}
                    {recommendedContent?.semester && (
                      <>
                        <span>·</span>
                        <span>{recommendedContent.semester}</span>
                      </>
                    )}
                    {recommendedContent?.revision && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-indigo-600">
                          {recommendedContent.revision} 개정판
                        </span>
                      </>
                    )}
                    {recommendedContent?.difficulty_level && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                          {recommendedContent.difficulty_level}
                        </span>
                      </>
                    )}
                    {recommendedContent?.publisher && (
                      <>
                        <span>·</span>
                        <span>{recommendedContent.publisher}</span>
                      </>
                    )}
                    {recommendedContent?.platform && (
                      <>
                        <span>·</span>
                        <span>{recommendedContent.platform}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 범위 정보 또는 범위 편집 UI */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>·</span>
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    {/* 상세정보가 있는 경우 시작/끝 범위 각각 선택 */}
                    {isLoading ? (
                      <div className="text-xs text-gray-500">
                        상세 정보를 불러오는 중...
                      </div>
                    ) : contentInfo && contentInfo.details.length > 0 ? (
                      <div className="space-y-3">
                        {/* 시작 범위 선택 */}
                        <div className="flex flex-col gap-2">
                          <div className="text-xs font-medium text-gray-800">
                            시작 범위 선택
                          </div>
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                            <div className="space-y-1">
                              {contentInfo.type === "book"
                                ? (contentInfo.details as BookDetail[]).map(
                                    (detail) => {
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
                                            name={`start-recommended-${index}`}
                                            checked={isSelected}
                                            onChange={() =>
                                              onStartDetailChange(index, detail.id)
                                            }
                                            className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="flex flex-1 items-center gap-2 text-xs">
                                            <span className="font-medium">
                                              페이지 {detail.page_number}
                                            </span>
                                            {detail.major_unit && (
                                              <span className="text-gray-500">
                                                · {detail.major_unit}
                                                {detail.minor_unit &&
                                                  ` - ${detail.minor_unit}`}
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    }
                                  )
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
                                          name={`start-recommended-${index}`}
                                          checked={isSelected}
                                          onChange={() =>
                                            onStartDetailChange(index, episode.id)
                                          }
                                          className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-1 items-center gap-2 text-xs">
                                          <span className="font-medium">
                                            {episode.episode_number}회차
                                          </span>
                                          {episode.episode_title && (
                                            <span className="text-gray-500">
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
                          <div className="text-xs font-medium text-gray-800">
                            끝 범위 선택
                          </div>
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                            <div className="space-y-1">
                              {contentInfo.type === "book"
                                ? (contentInfo.details as BookDetail[]).map(
                                    (detail) => {
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
                                            name={`end-recommended-${index}`}
                                            checked={isSelected}
                                            onChange={() =>
                                              onEndDetailChange(index, detail.id)
                                            }
                                            className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                          />
                                          <div className="flex flex-1 items-center gap-2 text-xs">
                                            <span className="font-medium">
                                              페이지 {detail.page_number}
                                            </span>
                                            {detail.major_unit && (
                                              <span className="text-gray-500">
                                                · {detail.major_unit}
                                                {detail.minor_unit &&
                                                  ` - ${detail.minor_unit}`}
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    }
                                  )
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
                                          name={`end-recommended-${index}`}
                                          checked={isSelected}
                                          onChange={() =>
                                            onEndDetailChange(index, episode.id)
                                          }
                                          className="h-3 w-3 border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        <div className="flex flex-1 items-center gap-2 text-xs">
                                          <span className="font-medium">
                                            {episode.episode_number}회차
                                          </span>
                                          {episode.episode_title && (
                                            <span className="text-gray-500">
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

                        {/* 선택된 범위 표시 */}
                        {editingRange && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                            <span className="font-medium">선택된 범위:</span>{" "}
                            {content.content_type === "book"
                              ? `${editingRange.start}페이지 ~ ${editingRange.end}페이지`
                              : `${editingRange.start}회차 ~ ${editingRange.end}회차`}
                          </div>
                        )}

                        {/* 저장/취소 버튼 */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={onSaveRange}
                            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <Check className="h-3 w-3" />
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditing}
                            className="flex items-center gap-1 rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-300"
                          >
                            <X className="h-3 w-3" />
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          // 상세정보가 없는 경우 로깅 (정상 케이스)
                          const content = contents[editingRangeIndex!];
                          const originalContent = allRecommendedContents.find(
                            (c) => c.id === content.content_id
                          );
                          const total = contentTotals.get(editingRangeIndex!);
                          
                          if (process.env.NODE_ENV === "development") {
                            console.debug("[AddedContentsList] 상세정보 없음 (정상):", {
                              type: "NO_DETAILS",
                              contentType: content.content_type,
                              contentId: content.content_id,
                              title: originalContent?.title || "제목 없음",
                              editingRangeIndex,
                              total: total || "없음",
                              reason: "해당 콘텐츠에 목차/회차 정보가 없습니다. 총 페이지수/회차를 바탕으로 범위를 직접 입력할 수 있습니다.",
                            });
                          }
                          return null;
                        })()}
                        
                        {/* 총 페이지수/회차 정보 표시 */}
                        {(() => {
                          const content = contents[editingRangeIndex!];
                          const total = contentTotals.get(editingRangeIndex!);
                          
                          if (total) {
                            return (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                                <span className="font-medium">
                                  {content.content_type === "book" ? "총 페이지수" : "총 회차"}: {total}
                                  {content.content_type === "book" ? "페이지" : "회차"}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* 범위 직접 입력 */}
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-800">
                              시작 범위
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={contentTotals.get(editingRangeIndex!) || undefined}
                              value={editingRange?.start || "1"}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                const currentEnd = editingRange?.end || "1";
                                if (onRangeChange) {
                                  onRangeChange(newStart, currentEnd);
                                }
                              }}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="1"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-800">
                              끝 범위
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={contentTotals.get(editingRangeIndex!) || undefined}
                              value={editingRange?.end || "1"}
                              onChange={(e) => {
                                const newEnd = e.target.value;
                                const currentStart = editingRange?.start || "1";
                                if (onRangeChange) {
                                  onRangeChange(currentStart, newEnd);
                                }
                              }}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={contentTotals.get(editingRangeIndex!)?.toString() || "100"}
                            />
                          </div>
                          
                          {/* 선택된 범위 표시 */}
                          {editingRange && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                              <span className="font-medium">선택된 범위:</span>{" "}
                              {contents[editingRangeIndex!].content_type === "book"
                                ? `${editingRange.start}페이지 ~ ${editingRange.end}페이지`
                                : `${editingRange.start}회차 ~ ${editingRange.end}회차`}
                            </div>
                          )}

                          {/* 저장/취소 버튼 */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={onSaveRange}
                              className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <Check className="h-3 w-3" />
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={onCancelEditing}
                              className="flex items-center gap-1 rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-300"
                            >
                              <X className="h-3 w-3" />
                              취소
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span>
                    {content.content_type === "book"
                      ? `${content.start_range}페이지 ~ ${content.end_range}페이지`
                      : `${content.start_range}회차 ~ ${content.end_range}회차`}
                  </span>
                )}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => onStartEditing(index)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                  aria-label="범위 수정"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirm("이 콘텐츠를 제거하시겠습니까?")) {
                    onRemove(index);
                  }
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                aria-label="콘텐츠 제거"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

