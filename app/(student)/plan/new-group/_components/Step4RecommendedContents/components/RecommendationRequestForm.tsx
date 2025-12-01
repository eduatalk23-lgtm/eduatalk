/**
 * RecommendationRequestForm
 * 추천 요청 폼 컴포넌트 - 교과 선택 및 개수 설정
 */

"use client";

import { AVAILABLE_SUBJECTS } from "../constants";

type RecommendationRequestFormProps = {
  selectedSubjects: Set<string>;
  recommendationCounts: Map<string, number>;
  autoAssignContents: boolean;
  currentStudentContentsCount: number;
  currentRecommendedContentsCount: number;
  onSubjectToggle: (subject: string) => void;
  onCountChange: (subject: string, count: number) => void;
  onAutoAssignChange: (value: boolean) => void;
  onSubmit: () => Promise<void>;
  disabled?: boolean;
};

export default function RecommendationRequestForm({
  selectedSubjects,
  recommendationCounts,
  autoAssignContents,
  currentStudentContentsCount,
  currentRecommendedContentsCount,
  onSubjectToggle,
  onCountChange,
  onAutoAssignChange,
  onSubmit,
  disabled = false,
}: RecommendationRequestFormProps) {
  const totalCount = currentStudentContentsCount + currentRecommendedContentsCount;
  const maxAvailable = 9 - totalCount;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          추천 받을 교과 선택
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          추천 받고 싶은 교과를 선택하세요. 여러 교과를 동시에 선택할 수
          있습니다.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {AVAILABLE_SUBJECTS.map((subject) => {
            const isSelected = selectedSubjects.has(subject);
            return (
              <button
                key={subject}
                type="button"
                onClick={() => onSubjectToggle(subject)}
                disabled={disabled}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {subject}
              </button>
            );
          })}
        </div>
      </div>

      {/* 교과별 추천 개수 설정 */}
      {selectedSubjects.size > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            교과별 추천 개수 설정
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            각 교과별로 몇 개의 콘텐츠를 추천 받을지 설정하세요.
          </p>
          <div className="space-y-2">
            {Array.from(selectedSubjects).map((subject) => {
              const currentCount = recommendationCounts.get(subject) || 1;
              // 다른 교과의 총합
              const totalSelectedCount = Array.from(
                recommendationCounts.values()
              ).reduce((sum, count) => sum + count, 0);
              const remainingForOthers =
                maxAvailable - (totalSelectedCount - currentCount);
              const maxForThis = Math.max(1, remainingForOthers);

              return (
                <div
                  key={subject}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {subject}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentCount > 1) {
                          onCountChange(subject, currentCount - 1);
                        }
                      }}
                      disabled={currentCount <= 1 || disabled}
                      className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900">
                      {currentCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentCount < maxForThis) {
                          onCountChange(subject, currentCount + 1);
                        }
                      }}
                      disabled={currentCount >= maxForThis || disabled}
                      className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                    >
                      +
                    </button>
                    <span className="ml-2 text-xs text-gray-500">
                      (최대 {maxForThis}개)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              현재 학생 콘텐츠: {currentStudentContentsCount}개, 추천 콘텐츠:{" "}
              {currentRecommendedContentsCount}개
              <br />
              추가 가능: {Math.max(0, maxAvailable)}개 / 전체 최대 9개
            </p>
          </div>
        </div>
      )}

      {/* 콘텐츠 자동 배정 옵션 */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoAssignContents}
            onChange={(e) => onAutoAssignChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-700">
            콘텐츠 자동 배정
          </span>
        </label>
        <p className="text-xs text-gray-500">
          선택 시 추천 받은 콘텐츠를 자동으로 추가 추천 콘텐츠로 이동합니다.
        </p>
      </div>

      {/* 추천받기 버튼 */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onSubmit}
          disabled={selectedSubjects.size === 0 || disabled}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          추천받기
        </button>
      </div>
    </div>
  );
}

