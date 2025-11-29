"use client";

import React, { useMemo } from "react";
import { AlertCircle, BookOpen, Video } from "lucide-react";
import { ContentRangeInputProps, BookDetail, LectureEpisode } from "@/lib/types/content-selection";
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
  onStartChange,
  onEndChange,
  loading = false,
  error = null,
}: ContentRangeInputProps) {
  const isBook = type === "book";

  // 시작/끝 인덱스
  const startIndex = useMemo(() => {
    return details.findIndex((d) => d.id === startDetailId);
  }, [details, startDetailId]);

  const endIndex = useMemo(() => {
    return details.findIndex((d) => d.id === endDetailId);
  }, [details, endDetailId]);

  // 범위 검증
  const isValidRange = startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex;

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
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="ml-3 text-sm text-gray-600">상세 정보 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-900">오류가 발생했습니다</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          상세 정보를 불러올 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 타입 표시 */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
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
        <label className="block text-sm font-medium text-gray-700">
          시작 {isBook ? "페이지" : "강"}
        </label>
        <select
          value={startDetailId || ""}
          onChange={(e) => onStartChange(e.target.value)}
          className={cn(
            "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            !startDetailId && "text-gray-400"
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
        <label className="block text-sm font-medium text-gray-700">
          종료 {isBook ? "페이지" : "강"}
        </label>
        <select
          value={endDetailId || ""}
          onChange={(e) => onEndChange(e.target.value)}
          disabled={!startDetailId}
          className={cn(
            "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            !endDetailId && "text-gray-400",
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
          <p className="mt-1 text-xs text-gray-500">
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
            <p className="mt-1 text-xs text-blue-600">
              총{" "}
              {(details[endIndex] as BookDetail).page_number -
                (details[startIndex] as BookDetail).page_number +
                1}
              페이지
            </p>
          )}
          {!isBook && (
            <p className="mt-1 text-xs text-blue-600">
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

