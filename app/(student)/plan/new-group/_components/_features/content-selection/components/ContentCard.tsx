"use client";

import React from "react";
import { Trash2, Edit, BookOpen, Video, Star, FileText } from "lucide-react";
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
  isLoadingMetadata = false,
  metadataError,
  onToggle,
  onRemove,
  onEditRange,
}: ContentCardProps) {
  // contentType을 우선 사용, 없으면 기존 로직으로 판단
  const contentType = content.contentType ||
    (content.id.startsWith("book") || !content.platform ? "book" : "lecture");
  const isBook = contentType === "book";
  const isLecture = contentType === "lecture";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--elevation-1)] transition-base",
        selected
          ? "border-blue-500 bg-blue-50 shadow-[var(--elevation-4)]"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-[var(--elevation-4)]",
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
              isBook ? "bg-amber-100" : isLecture ? "bg-purple-100" : "bg-gray-100"
            )}
          >
            {isBook ? (
              <BookOpen className="h-5 w-5 text-amber-600" />
            ) : isLecture ? (
              <Video className="h-5 w-5 text-purple-600" />
            ) : (
              <FileText className="h-5 w-5 text-gray-600" />
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
              {isLoadingMetadata ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                  <span>정보 불러오는 중...</span>
                </div>
              ) : metadataError ? (
                <span className="text-red-600 text-xs">{metadataError}</span>
              ) : (
                <>
                  {/* 콘텐츠 타입 배지 */}
                  {isBook ? (
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                      📚 교재
                    </span>
                  ) : isLecture ? (
                    <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
                      🎧 강의
                    </span>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
                      📄 커스텀
                    </span>
                  )}
                  
                  {/* 교과 그룹명 */}
                  {content.subject_group_name && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                      {content.subject_group_name}
                    </span>
                  )}
                  
                  {/* 세부 과목 */}
                  {content.subject && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                      {content.subject}
                    </span>
                  )}
                  
                  {/* 학기 */}
                  {content.semester && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                      {content.semester}
                    </span>
                  )}
                  
                  {/* 개정교육과정 */}
                  {content.revision && (
                    <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
                      {content.revision}
                    </span>
                  )}
                  
                  {/* 난이도 */}
                  {content.difficulty && (
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">
                      {content.difficulty}
                    </span>
                  )}
                  
                  {/* 출판사 */}
                  {content.publisher && (
                    <span className="text-gray-600">{content.publisher}</span>
                  )}
                  
                  {/* 플랫폼 */}
                  {content.platform && (
                    <span className="text-gray-600">{content.platform}</span>
                  )}
                </>
              )}
            </div>

            {/* 범위 정보 */}
            {range && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-800">범위:</span>
                <span className="text-gray-600">
                  {isBook
                    ? `${range.start}페이지 ~ ${range.end}페이지`
                    : `${range.start}회차 ~ ${range.end}회차`}
                </span>
              </div>
            )}

            {/* 리뷰 점수 (콜드 스타트) */}
            {recommended?.reviewScore !== undefined && recommended.reviewScore !== null && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-3.5 w-3.5",
                        star <= Math.round(recommended.reviewScore!)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200"
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {recommended.reviewScore.toFixed(1)}
                </span>
                {recommended.reviewCount !== undefined && recommended.reviewCount > 0 && (
                  <span className="text-xs text-gray-500">
                    ({recommended.reviewCount.toLocaleString()}개 리뷰)
                  </span>
                )}
              </div>
            )}

            {/* 대상 학생 유형 (콜드 스타트) */}
            {recommended?.targetStudents && recommended.targetStudents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recommended.targetStudents.slice(0, 3).map((target, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                  >
                    {target}
                  </span>
                ))}
              </div>
            )}

            {/* 추천 사유 */}
            {recommended && recommended.reason && (
              <div className="flex flex-col gap-1 rounded-lg bg-yellow-50 p-2 text-sm">
                <p className="font-medium text-yellow-800">추천 이유:</p>
                <p className="text-gray-600">{recommended.reason}</p>
                {/* 추가 추천 이유 (콜드 스타트) */}
                {recommended.recommendationReasons && recommended.recommendationReasons.length > 1 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                    {recommended.recommendationReasons.slice(1, 3).map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-yellow-600">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
                  "rounded p-2 transition-base hover:bg-gray-100",
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
                  "rounded p-2 transition-base hover:bg-red-100",
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
                  "rounded-lg border-2 border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition-base hover:bg-blue-50",
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
