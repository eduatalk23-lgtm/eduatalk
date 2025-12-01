/**
 * RecommendedContentsList
 * 추천 콘텐츠 목록 및 재추천 버튼 포함
 */

"use client";

import { RecommendedContent } from "../types";
import RecommendedContentCard from "./RecommendedContentCard";
import { RefreshCw } from "lucide-react";

type RecommendedContentsListProps = {
  recommendedContents: RecommendedContent[];
  selectedContentIds: Set<string>;
  selectedSubjects: Set<string>;
  recommendationCounts: Map<string, number>;
  requiredSubjectCategories: string[];
  selectedSubjectCategories: Set<string>;
  missingRequiredSubjects: Array<{
    name: string;
    current: number;
    required: number;
  }>;
  studentCount: number;
  recommendedCount: number;
  loading: boolean;
  onToggleSelection: (contentId: string) => void;
  onRefresh: () => Promise<void>;
  onAddSelectedContents: () => Promise<void>;
};

export default function RecommendedContentsList({
  recommendedContents,
  selectedContentIds,
  selectedSubjects,
  recommendationCounts,
  requiredSubjectCategories,
  selectedSubjectCategories,
  missingRequiredSubjects,
  studentCount,
  recommendedCount,
  loading,
  onToggleSelection,
  onRefresh,
  onAddSelectedContents,
}: RecommendedContentsListProps) {
  const totalCount = studentCount + recommendedCount;

  // 과목별 그룹화
  const contentsBySubject = new Map<string, RecommendedContent[]>();
  recommendedContents.forEach((content) => {
    const subject = content.subject_category || "기타";
    if (!contentsBySubject.has(subject)) {
      contentsBySubject.set(subject, []);
    }
    contentsBySubject.get(subject)!.push(content);
  });

  // 필수 과목 우선 정렬
  const sortedSubjects = Array.from(contentsBySubject.keys()).sort((a, b) => {
    const aIndex = requiredSubjectCategories.indexOf(a);
    const bIndex = requiredSubjectCategories.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4">
      {/* 재추천 버튼 */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            추천 콘텐츠 목록
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            추천 결과가 마음에 들지 않으면 다시 추천받을 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || selectedSubjects.size === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          추천 다시 받기
        </button>
      </div>

      {/* 과목별 그룹화된 추천 목록 */}
      <div className="space-y-6">
        {sortedSubjects.map((subject) => {
          const contents = contentsBySubject.get(subject) || [];
          const isRequired = requiredSubjectCategories.includes(subject);
          const isSelected = selectedSubjectCategories.has(subject);

          return (
            <div
              key={subject}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {subject}
                  </h3>
                  {isRequired && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      필수
                    </span>
                  )}
                  {isRequired && !isSelected && (
                    <span className="text-xs text-red-600">
                      (1개 이상 선택 필요)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {contents.length}개 추천
                  </span>
                  {contents.some(
                    (c) =>
                      c.scoreDetails?.riskScore &&
                      c.scoreDetails.riskScore >= 50
                  ) && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      ⚠️ 위험도 높음
                    </span>
                  )}
                  {contents.some((c) =>
                    c.reason.includes("취약 과목")
                  ) && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      취약 과목
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {contents.map((content) => {
                  const isSelected = selectedContentIds.has(content.id);
                  return (
                    <RecommendedContentCard
                      key={content.id}
                      content={content}
                      isSelected={isSelected}
                      onToggleSelection={onToggleSelection}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 선택 요약 및 추가 버튼 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              선택된 추천 콘텐츠: {selectedContentIds.size}개
              {totalCount > 0 && (
                <span className="ml-2 text-gray-500">
                  (전체 {totalCount}개 중 학생 {studentCount}개, 추천{" "}
                  {recommendedCount}개)
                </span>
              )}
            </div>
            {missingRequiredSubjects.length > 0 && (
              <div className="text-xs font-medium text-red-600">
                필수 과목 미충족:{" "}
                {missingRequiredSubjects
                  .map((m) => `${m.name} (${m.current}/${m.required})`)
                  .join(", ")}
              </div>
            )}
          </div>
          {selectedContentIds.size > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2">
              <div className="text-xs text-green-800">
                <span className="font-medium">선택된 추천 콘텐츠:</span>
                <div className="mt-1 space-y-1">
                  {Array.from(selectedContentIds).map((id) => {
                    const content = recommendedContents.find(
                      (c) => c.id === id
                    );
                    if (!content) return null;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="text-green-700">
                          {content.contentType === "book" ? "📚" : "🎧"}{" "}
                          {content.title}
                        </span>
                        {content.difficulty_level && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                            {content.difficulty_level}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAddSelectedContents}
          disabled={
            selectedContentIds.size === 0 ||
            missingRequiredSubjects.length > 0 ||
            totalCount + selectedContentIds.size > 9
          }
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          선택한 콘텐츠 추가하기 ({totalCount + selectedContentIds.size}/9)
        </button>
      </div>
    </div>
  );
}

