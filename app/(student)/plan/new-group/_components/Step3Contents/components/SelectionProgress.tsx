type SelectionProgressProps = {
  totalCount: number;
  studentCount: number;
  recommendedCount: number;
  isCampMode: boolean;
  canAddMore: boolean;
  remainingSlots: number;
};

export function SelectionProgress({
  totalCount,
  studentCount,
  recommendedCount,
  isCampMode,
  canAddMore,
  remainingSlots,
}: SelectionProgressProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            학습 대상 콘텐츠
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            플랜에 포함할 교재와 강의를 선택하고 학습 범위를 지정해주세요. (최대
            9개)
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            {totalCount}/9
          </div>
          <div className="text-xs text-gray-600">
            학생 {studentCount}개
            {!isCampMode &&
              recommendedCount > 0 &&
              ` / 추천 ${recommendedCount}개`}
          </div>
        </div>
      </div>
      {/* 진행 바 */}
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(totalCount / 9) * 100}%` }}
          />
        </div>
      </div>
      {!canAddMore && !isCampMode && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            ⚠️ 최대 9개의 콘텐츠를 모두 선택하셨습니다. 추천 콘텐츠는 받을 수
            없습니다.
          </p>
        </div>
      )}
      {!canAddMore && isCampMode && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            ⚠️ 최대 9개의 콘텐츠를 모두 선택하셨습니다.
          </p>
        </div>
      )}
      {canAddMore && totalCount > 0 && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            💡 {remainingSlots}개의 콘텐츠를 더 선택할 수 있습니다.{" "}
            {!isCampMode &&
              studentCount < 9 &&
              "다음 단계에서 추천 콘텐츠를 받을 수 있습니다."}
            {isCampMode &&
              "제출 후 관리자가 전략과목/취약과목을 설정하고 플랜을 생성합니다."}
          </p>
        </div>
      )}
    </div>
  );
}
