"use client";

import type { ContentAdjustmentCardProps } from "./types";

/**
 * 개별 콘텐츠 조정 카드
 */
export function ContentAdjustmentCard({
  content,
  contentId,
  adjustment,
  currentRange,
  rangeInputs,
  validationErrors,
  replacedContentInfo,
  onRangeInputChange,
  onRangeBlur,
  onReplacedRangeInputChange,
  onReplacedRangeBlur,
  onReplaceClick,
  onCancelReplace,
}: ContentAdjustmentCardProps) {
  const isReplaced = adjustment?.change_type === "replace";

  // 교체된 콘텐츠 정보
  const replacedContent = isReplaced
    ? {
        content_id: adjustment.after.content_id,
        content_type: adjustment.after.content_type,
        info: replacedContentInfo.get(contentId),
      }
    : null;

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "book":
        return "📚 교재";
      case "lecture":
        return "🎥 강의";
      default:
        return "📝 커스텀";
    }
  };

  const getUnitLabel = (type: string) => {
    switch (type) {
      case "book":
        return "페이지";
      case "lecture":
        return "회차";
      default:
        return "";
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isReplaced ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">
            {getContentTypeLabel(content.content_type)}
          </h3>
          {isReplaced && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              교체됨
            </span>
          )}
        </div>

        {isReplaced && replacedContent ? (
          <ReplacedContentDisplay
            content={content}
            currentRange={currentRange}
            replacedContent={replacedContent}
          />
        ) : (
          <p className="text-sm text-gray-600">
            {content.start_range} ~ {content.end_range}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {!isReplaced && (
          <RangeInputSection
            contentId={contentId}
            content={content}
            currentRange={currentRange}
            rangeInputs={rangeInputs}
            validationErrors={validationErrors}
            onRangeInputChange={onRangeInputChange}
            onRangeBlur={onRangeBlur}
          />
        )}

        {isReplaced && (
          <ReplacedRangeInputSection
            contentId={contentId}
            currentRange={currentRange}
            rangeInputs={rangeInputs}
            onRangeInputChange={onReplacedRangeInputChange}
            onRangeBlur={onReplacedRangeBlur}
          />
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => onReplaceClick(contentId)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {isReplaced ? "다시 교체" : "콘텐츠 교체"}
          </button>
          {isReplaced && (
            <button
              onClick={() => onCancelReplace(contentId)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              교체 취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 교체된 콘텐츠 표시
 */
function ReplacedContentDisplay({
  content,
  currentRange,
  replacedContent,
}: {
  content: ContentAdjustmentCardProps["content"];
  currentRange: { start: number; end: number };
  replacedContent: {
    content_id: string;
    content_type: string;
    info?: { title: string; total_page_or_time: number | null };
  };
}) {
  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case "book":
        return "📚 교재";
      case "lecture":
        return "🎥 강의";
      default:
        return "📝 커스텀";
    }
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-2">
        <div className="text-xs text-gray-500">교체 전</div>
        <div className="text-gray-700">
          {getContentTypeLabel(content.content_type)} {content.start_range} ~{" "}
          {content.end_range}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-2">
        <div className="text-xs text-blue-700">교체 후</div>
        <div className="font-medium text-blue-900">
          {getContentTypeLabel(replacedContent.content_type)}
          {replacedContent.info?.title && (
            <span className="pl-2">{replacedContent.info.title}</span>
          )}
        </div>
        <div className="text-blue-700">
          범위: {currentRange.start} ~ {currentRange.end}
          {replacedContent.info?.total_page_or_time !== null &&
            replacedContent.info?.total_page_or_time !== undefined && (
              <span className="pl-2 text-xs text-blue-600">
                (총{" "}
                {replacedContent.content_type === "book"
                  ? `${replacedContent.info.total_page_or_time}페이지`
                  : replacedContent.content_type === "lecture"
                  ? `${replacedContent.info.total_page_or_time}분`
                  : `${replacedContent.info.total_page_or_time}`}
                )
              </span>
            )}
        </div>
      </div>
    </div>
  );
}

/**
 * 범위 입력 섹션 (일반)
 */
function RangeInputSection({
  contentId,
  content,
  currentRange,
  rangeInputs,
  validationErrors,
  onRangeInputChange,
  onRangeBlur,
}: {
  contentId: string;
  content: ContentAdjustmentCardProps["content"];
  currentRange: { start: number; end: number };
  rangeInputs: ContentAdjustmentCardProps["rangeInputs"];
  validationErrors: Map<string, string>;
  onRangeInputChange: ContentAdjustmentCardProps["onRangeInputChange"];
  onRangeBlur: ContentAdjustmentCardProps["onRangeBlur"];
}) {
  const hasError = validationErrors.has(contentId);
  const unitLabel =
    content.content_type === "book"
      ? "페이지"
      : content.content_type === "lecture"
      ? "회차"
      : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">시작 범위:</label>
        <input
          type="number"
          value={rangeInputs.get(contentId)?.start ?? String(currentRange.start)}
          onChange={(e) => onRangeInputChange(contentId, "start", e.target.value)}
          onBlur={() => onRangeBlur(contentId, "start")}
          className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
            hasError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          }`}
          min={1}
          aria-label="시작 범위 입력"
          aria-invalid={hasError}
          aria-describedby={hasError ? `error-${contentId}` : undefined}
        />
        <span className="text-xs text-gray-500">{unitLabel}</span>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">끝 범위:</label>
        <input
          type="number"
          value={rangeInputs.get(contentId)?.end ?? String(currentRange.end)}
          onChange={(e) => onRangeInputChange(contentId, "end", e.target.value)}
          onBlur={() => onRangeBlur(contentId, "end")}
          className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
            hasError
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          }`}
          min={currentRange.start}
          aria-label="끝 범위 입력"
          aria-invalid={hasError}
          aria-describedby={hasError ? `error-${contentId}` : undefined}
        />
        <span className="text-xs text-gray-500">{unitLabel}</span>
      </div>

      {/* 범위 미리보기 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
        범위: {currentRange.start} ~ {currentRange.end} (
        {currentRange.end - currentRange.start + 1}
        {unitLabel})
      </div>

      {/* 검증 오류 메시지 */}
      {hasError && (
        <div
          id={`error-${contentId}`}
          className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
          role="alert"
          aria-live="polite"
        >
          ⚠️ {validationErrors.get(contentId)}
        </div>
      )}
    </div>
  );
}

/**
 * 교체된 콘텐츠 범위 입력 섹션
 */
function ReplacedRangeInputSection({
  contentId,
  currentRange,
  rangeInputs,
  onRangeInputChange,
  onRangeBlur,
}: {
  contentId: string;
  currentRange: { start: number; end: number };
  rangeInputs: ContentAdjustmentCardProps["rangeInputs"];
  onRangeInputChange: ContentAdjustmentCardProps["onReplacedRangeInputChange"];
  onRangeBlur: ContentAdjustmentCardProps["onReplacedRangeBlur"];
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">시작 범위:</label>
        <input
          type="number"
          value={rangeInputs.get(contentId)?.start ?? String(currentRange.start)}
          onChange={(e) => onRangeInputChange(contentId, "start", e.target.value)}
          onBlur={() => onRangeBlur(contentId, "start")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          min={1}
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">끝 범위:</label>
        <input
          type="number"
          value={rangeInputs.get(contentId)?.end ?? String(currentRange.end)}
          onChange={(e) => onRangeInputChange(contentId, "end", e.target.value)}
          onBlur={() => onRangeBlur(contentId, "end")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          min={currentRange.start}
        />
      </div>
    </>
  );
}
