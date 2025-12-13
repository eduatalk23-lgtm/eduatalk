"use client";

import React from "react";
import { Trash2, Edit, BookOpen, Video, Star } from "lucide-react";
import { ContentCardProps } from "@/lib/types/content-selection";
import { cn } from "@/lib/cn";

/**
 * ContentCard - 콘텐츠 카드 공통 컴포넌트
 *
 * 학생 콘텐츠와 추천 콘텐츠 모두에서 사용
 * Phase 3에서 중복 코드 제거를 위해 생성
 */
export const ContentCard = React.memo(function ContentCard({
  content,
  selected,
  disabled = false,
  readOnly = false,
  range,
  recommended,
  onToggle,
  onRemove,
  onEditRange,
}: ContentCardProps) {
  const isBook = content.id.startsWith("book") || !content.platform;
  const isLecture = !isBook;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-all",
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* 아이콘 */}
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
              isBook ? "bg-amber-100" : "bg-purple-100"
            )}
          >
            {isBook ? (
              <BookOpen className="h-5 w-5 text-amber-600" />
            ) : (
              <Video className="h-5 w-5 text-purple-600" />
            )}
          </div>

          {/* 콘텐츠 정보 */}
          <div className="flex flex-1 flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 truncate">
                {content.title}
              </h3>
              {recommended && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-600">
                    추천 {recommended.priority}
                  </span>
                </div>
              )}
            </div>

            {/* 메타데이터 */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              {content.subject && (
                <span className="rounded bg-gray-100 px-2 py-0.5">
                  {content.subject}
                </span>
              )}
              {content.semester && (
                <span className="rounded bg-gray-100 px-2 py-0.5">
                  {content.semester}
                </span>
              )}
              {content.difficulty && (
                <span className="rounded bg-gray-100 px-2 py-0.5">
                  {content.difficulty}
                </span>
              )}
              {content.publisher && (
                <span className="text-gray-600">{content.publisher}</span>
              )}
              {content.platform && (
                <span className="text-gray-600">{content.platform}</span>
              )}
            </div>

            {/* 범위 정보 */}
            {range && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-800">범위:</span>
                <span className="text-gray-600">
                  {range.start} ~ {range.end}
                </span>
              </div>
            )}

            {/* 추천 사유 */}
            {recommended && recommended.reason && (
              <div className="flex flex-col gap-0.5 rounded-lg bg-yellow-50 p-2 text-sm text-gray-600">
                <p className="font-medium text-yellow-800">추천 이유:</p>
                <p className="text-gray-600">{recommended.reason}</p>
              </div>
            )}

            {/* 성적 상세 (추천 콘텐츠) */}
            {recommended && recommended.scoreDetails && (
              <div className="flex flex-wrap gap-2 text-xs">
                {recommended.scoreDetails.schoolGrade !== null && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">
                    내신: {recommended.scoreDetails.schoolGrade}등급
                  </span>
                )}
                {recommended.scoreDetails.mockGrade !== null && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-green-700">
                    모의: {recommended.scoreDetails.mockGrade}등급
                  </span>
                )}
                {recommended.scoreDetails.riskScore !== undefined && (
                  <span
                    className={cn(
                      "rounded px-2 py-0.5",
                      recommended.scoreDetails.riskScore > 7
                        ? "bg-red-100 text-red-700"
                        : recommended.scoreDetails.riskScore > 4
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    위험도: {recommended.scoreDetails.riskScore}/10
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        {!readOnly && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {/* 범위 수정 버튼 */}
            {selected && onEditRange && (
              <button
                type="button"
                onClick={onEditRange}
                disabled={disabled}
                className={cn(
                  "rounded p-2 transition-colors hover:bg-gray-100",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                title="범위 수정"
              >
                <Edit className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {/* 삭제 버튼 */}
            {selected && onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className={cn(
                  "rounded p-2 transition-colors hover:bg-red-100",
                  disabled && "cursor-not-allowed opacity-50"
                )}
                title="삭제"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            )}

            {/* 선택/해제 버튼 */}
            {!selected && onToggle && (
              <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                className={cn(
                  "rounded-lg border-2 border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-white"
                )}
              >
                선택
              </button>
            )}
          </div>
        )}
      </div>

      {/* 읽기 전용 표시 */}
      {readOnly && selected && (
        <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">
          선택된 콘텐츠 (읽기 전용)
        </div>
      )}
    </div>
  );
});
