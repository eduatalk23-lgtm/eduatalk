"use client";

import React, { useMemo } from "react";
import { AlertCircle, BookOpen, Video } from "lucide-react";
import {
  ContentRangeInputProps,
  BookDetail,
  LectureEpisode,
} from "@/lib/types/content-selection";
import { cn } from "@/lib/cn";

/**
 * ContentRangeInput - 콘텐츠 범위 선택 입력
 *
 * - 책: 페이지 번호 선택
 * - 강의: 에피소드 번호 선택
 * - 시작/끝 범위 검증
 */
export const ContentRangeInput = React.memo(function ContentRangeInput({
  type,
  details,
  startDetailId,
  endDetailId,
  startRange,
  endRange,
  totalPages,
  totalEpisodes,
  onStartChange,
  onEndChange,
  onStartRangeChange,
  onEndRangeChange,
  loading = false,
  error = null,
}: ContentRangeInputProps) {
  const isBook = type === "book";
  const hasDetails = details.length > 0;
  const maxValue = isBook ? totalPages : totalEpisodes;

  // 시작/끝 인덱스
  const startIndex = useMemo(() => {
    return details.findIndex((d) => d.id === startDetailId);
  }, [details, startDetailId]);

  const endIndex = useMemo(() => {
    return details.findIndex((d) => d.id === endDetailId);
  }, [details, endDetailId]);

  // 범위 검증
  const isValidRange =
    startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex;

  // 선택 가능한 종료 옵션 (시작점 이후만)
  const availableEndDetails = useMemo(() => {
    if (startIndex === -1) return details;
    return details.slice(startIndex);
  }, [details, startIndex]);

  // 옵션 레이블 생성
  const getOptionLabel = (detail: BookDetail | LectureEpisode) => {
    if (isBook) {
      const bookDetail = detail as BookDetail;
      return `p.${bookDetail.page_number}${
        bookDetail.major_unit ? ` - ${bookDetail.major_unit}` : ""
      }${bookDetail.minor_unit ? ` > ${bookDetail.minor_unit}` : ""}`;
    } else {
      const lectureDetail = detail as LectureEpisode;
      return `${lectureDetail.episode_number}강${
        lectureDetail.episode_title ? ` - ${lectureDetail.episode_title}` : ""
      }`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-800">상세 정보 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-red-900">오류가 발생했습니다</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // 상세 정보가 없을 때 직접 입력 모드
  if (!hasDetails) {
    // 로그 제거 (RangeSettingModal에서 이미 로그 출력)

    // 빈 값을 허용하도록 수정 (기본값으로 대체하지 않음)
    const currentStart = startRange ?? "";
    const currentEnd = endRange ?? "";

    return (
      <div className="space-y-4">
        {/* 안내 메시지 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-800">
            상세 정보가 없습니다
          </p>
          <p className="mt-1 text-xs text-blue-800">
            {isBook
              ? "페이지 범위를 직접 입력해주세요."
              : "회차 범위를 직접 입력해주세요."}
          </p>
          {maxValue && (
            <p className="mt-1 text-xs text-blue-800">
              {isBook
                ? `총 페이지수: ${maxValue}페이지`
                : `총 회차: ${maxValue}회차`}
            </p>
          )}
        </div>

        {/* 시작 범위 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            시작 {isBook ? "페이지" : "회차"}
          </label>
          <input
            type="number"
            min="1"
            max={maxValue || undefined}
            value={currentStart}
            onChange={(e) => {
              if (onStartRangeChange) {
                // 빈 값도 허용
                onStartRangeChange(e.target.value);
              }
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="예: 1"
          />
        </div>

        {/* 종료 범위 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            종료 {isBook ? "페이지" : "회차"}
          </label>
          <input
            type="number"
            min="1"
            max={maxValue || undefined}
            value={currentEnd}
            onChange={(e) => {
              if (onEndRangeChange) {
                // 빈 값도 허용
                onEndRangeChange(e.target.value);
              }
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={maxValue ? `예: ${maxValue}` : "예: 100"}
          />
        </div>

        {/* 범위 요약 */}
        {currentStart &&
          currentEnd &&
          Number(currentStart) > 0 &&
          Number(currentEnd) > 0 && (
            <div className="flex flex-col gap-1 rounded-lg bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-800">선택된 범위</p>
              <p className="text-sm text-blue-800">
                {isBook
                  ? `${currentStart}페이지 ~ ${currentEnd}페이지`
                  : `${currentStart}회차 ~ ${currentEnd}회차`}
              </p>
              {Number(currentStart) && Number(currentEnd) && (
                <p className="text-xs text-blue-800">
                  총 {Number(currentEnd) - Number(currentStart) + 1}
                  {isBook ? "페이지" : "회차"}
                </p>
              )}
            </div>
          )}

        {/* 범위 검증 */}
        {currentStart &&
          currentEnd &&
          Number(currentStart) > 0 &&
          Number(currentEnd) > 0 &&
          Number(currentStart) > Number(currentEnd) && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-800">
                시작이 종료보다 뒤에 있습니다. 범위를 다시 입력해주세요.
              </p>
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 타입 표시 */}
      <div className="flex items-center gap-2 text-sm text-gray-800">
        {isBook ? (
          <>
            <BookOpen className="h-4 w-4" />
            <span>교재 페이지 범위</span>
          </>
        ) : (
          <>
            <Video className="h-4 w-4" />
            <span>강의 에피소드 범위</span>
          </>
        )}
      </div>

      {/* 시작 범위 */}
      <div>
        <label className="block text-sm font-medium text-gray-800">
          시작 {isBook ? "페이지" : "강"}
        </label>
        <select
          value={startDetailId || ""}
          onChange={(e) => onStartChange(e.target.value)}
          className={cn(
            "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            !startDetailId && "text-gray-600"
          )}
        >
          <option value="" disabled>
            {isBook ? "시작 페이지를 선택하세요" : "시작 강을 선택하세요"}
          </option>
          {details.map((detail) => (
            <option key={detail.id} value={detail.id}>
              {getOptionLabel(detail)}
            </option>
          ))}
        </select>
      </div>

      {/* 종료 범위 */}
      <div>
        <label className="block text-sm font-medium text-gray-800">
          종료 {isBook ? "페이지" : "강"}
        </label>
        <select
          value={endDetailId || ""}
          onChange={(e) => onEndChange(e.target.value)}
          disabled={!startDetailId}
          className={cn(
            "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            !endDetailId && "text-gray-600",
            !startDetailId && "cursor-not-allowed opacity-50"
          )}
        >
          <option value="" disabled>
            {isBook ? "종료 페이지를 선택하세요" : "종료 강을 선택하세요"}
          </option>
          {availableEndDetails.map((detail) => (
            <option key={detail.id} value={detail.id}>
              {getOptionLabel(detail)}
            </option>
          ))}
        </select>
        {!startDetailId && (
          <p className="text-xs text-gray-800">
            먼저 시작 {isBook ? "페이지" : "강"}를 선택하세요
          </p>
        )}
      </div>

      {/* 범위 요약 */}
      {isValidRange && startDetailId && endDetailId && (
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">선택된 범위</p>
          <p className="mt-1 text-sm text-blue-700">
            {getOptionLabel(details[startIndex])} ~{" "}
            {getOptionLabel(details[endIndex])}
          </p>
          {isBook && (
            <p className="mt-1 text-xs text-blue-800">
              총{" "}
              {(details[endIndex] as BookDetail).page_number -
                (details[startIndex] as BookDetail).page_number +
                1}
              페이지
            </p>
          )}
          {!isBook && (
            <p className="mt-1 text-xs text-blue-800">
              총{" "}
              {(details[endIndex] as LectureEpisode).episode_number -
                (details[startIndex] as LectureEpisode).episode_number +
                1}
              강
            </p>
          )}
        </div>
      )}

      {/* 범위 오류 */}
      {startDetailId && endDetailId && !isValidRange && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            시작이 종료보다 뒤에 있습니다. 범위를 다시 선택해주세요.
          </p>
        </div>
      )}
    </div>
  );
});
