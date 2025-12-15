/**
 * RecommendedContentCard
 * 추천 콘텐츠 카드 컴포넌트
 */

"use client";

import { RecommendedContent } from "../types";
import { formatNumber } from "@/lib/utils/formatNumber";

type RecommendedContentCardProps = {
  content: RecommendedContent;
  isSelected: boolean;
  onToggleSelection: (contentId: string) => void;
};

export default function RecommendedContentCard({
  content,
  isSelected,
  onToggleSelection,
}: RecommendedContentCardProps) {
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
        onChange={() => onToggleSelection(content.id)}
        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
      />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-1 flex-col gap-1">
            {/* 제목 */}
            <div className="text-sm font-medium text-gray-900">
              {content.title}
            </div>

            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {/* 콘텐츠 타입 */}
              {content.contentType === "book" && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                  📚 교재
                </span>
              )}
              {content.contentType === "lecture" && (
                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                  🎧 강의
                </span>
              )}

              {/* 과목 */}
              {content.subject && (
                <>
                  <span>·</span>
                  <span>{content.subject}</span>
                </>
              )}

              {/* 학기 */}
              {content.semester && (
                <>
                  <span>·</span>
                  <span>{content.semester}</span>
                </>
              )}

              {/* 개정판 */}
              {content.revision && (
                <>
                  <span>·</span>
                  <span className="font-medium text-indigo-600">
                    {content.revision} 개정판
                  </span>
                </>
              )}

              {/* 난이도 */}
              {content.difficulty_level && (
                <>
                  <span>·</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800 text-xs">
                    {content.difficulty_level}
                  </span>
                </>
              )}

              {/* 출판사 */}
              {content.publisher && (
                <>
                  <span>·</span>
                  <span>{content.publisher}</span>
                </>
              )}

              {/* 플랫폼 */}
              {content.platform && (
                <>
                  <span>·</span>
                  <span>{content.platform}</span>
                </>
              )}
            </div>

            {/* 추천 이유 */}
            <div className="text-xs text-gray-600">
              <span className="font-medium">추천 이유:</span> {content.reason}
            </div>

            {/* 성적 데이터 */}
            {content.scoreDetails && (
              <div className="flex flex-wrap gap-1 text-xs">
                {/* 내신 평균 */}
                {content.scoreDetails.schoolAverageGrade !== null &&
                  content.scoreDetails.schoolAverageGrade !== undefined && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
                      내신 평균{" "}
                      {formatNumber(content.scoreDetails.schoolAverageGrade)}
                      등급
                    </span>
                  )}

                {/* 모의고사 백분위 */}
                {content.scoreDetails.mockPercentile !== null &&
                  content.scoreDetails.mockPercentile !== undefined && (
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-800">
                      모의고사{" "}
                      {formatNumber(content.scoreDetails.mockPercentile)}%
                    </span>
                  )}

                {/* 위험도 */}
                {content.scoreDetails.riskScore !== undefined &&
                  content.scoreDetails.riskScore >= 50 && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                      위험도 {formatNumber(content.scoreDetails.riskScore)}점
                    </span>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </label>
  );
}

