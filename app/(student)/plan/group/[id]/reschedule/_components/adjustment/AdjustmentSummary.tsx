"use client";

import type { AdjustmentSummaryProps, PlanContent, AdjustmentInput } from "./types";

/**
 * 변경 사항 요약 컴포넌트
 */
export function AdjustmentSummary({
  adjustments,
  contents,
}: AdjustmentSummaryProps) {
  const adjustmentsArray = Array.from(adjustments.values());

  const rangeCount = adjustmentsArray.filter(
    (adj) => adj.change_type === "range"
  ).length;

  const replaceCount = adjustmentsArray.filter(
    (adj) => adj.change_type === "replace"
  ).length;

  const fullCount = adjustmentsArray.filter(
    (adj) => adj.change_type === "full"
  ).length;

  const getContentName = (content: PlanContent | undefined) => {
    if (!content) return "알 수 없음";
    switch (content.content_type) {
      case "book":
        return "📚 교재";
      case "lecture":
        return "🎥 강의";
      default:
        return "📝 커스텀";
    }
  };

  const getChangeTypeLabel = (changeType: AdjustmentInput["change_type"]) => {
    switch (changeType) {
      case "range":
        return "범위 수정";
      case "replace":
        return "콘텐츠 교체";
      case "full":
        return "전체 재생성";
      default:
        return "알 수 없음";
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">변경 사항 요약</h3>

      {adjustments.size === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          <SummaryStats
            rangeCount={rangeCount}
            replaceCount={replaceCount}
            fullCount={fullCount}
          />

          <ChangeDetails
            adjustments={adjustmentsArray}
            contents={contents}
            getContentName={getContentName}
            getChangeTypeLabel={getChangeTypeLabel}
          />
        </div>
      )}
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
function EmptyState() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
      변경 사항이 없습니다. 범위를 수정하거나 콘텐츠를 교체해주세요.
    </div>
  );
}

/**
 * 요약 통계 컴포넌트
 */
function SummaryStats({
  rangeCount,
  replaceCount,
  fullCount,
}: {
  rangeCount: number;
  replaceCount: number;
  fullCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-xs text-gray-600">범위 수정</div>
        <div className="text-lg font-bold text-gray-900">{rangeCount}개</div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="text-xs text-blue-700">콘텐츠 교체</div>
        <div className="text-lg font-bold text-blue-600">{replaceCount}개</div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 p-3">
        <div className="text-xs text-green-700">전체 재생성</div>
        <div className="text-lg font-bold text-green-600">{fullCount}개</div>
      </div>
    </div>
  );
}

/**
 * 변경 내역 상세 컴포넌트
 */
function ChangeDetails({
  adjustments,
  contents,
  getContentName,
  getChangeTypeLabel,
}: {
  adjustments: AdjustmentInput[];
  contents: PlanContent[];
  getContentName: (content: PlanContent | undefined) => string;
  getChangeTypeLabel: (changeType: AdjustmentInput["change_type"]) => string;
}) {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
        변경 내역 상세 보기 ({adjustments.length}개)
      </summary>
      <div className="border-t border-gray-200 p-3">
        <div className="flex flex-col gap-2 text-xs">
          {adjustments.map((adj, index) => {
            const content = contents.find(
              (c) => (c.id || c.content_id) === adj.plan_content_id
            );

            return (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {getContentName(content)}
                  </span>
                  <span className="text-gray-600">
                    {getChangeTypeLabel(adj.change_type)}
                  </span>
                </div>
                <div className="text-gray-600">
                  {adj.before.range.start}~{adj.before.range.end} →{" "}
                  {adj.after.range.start}~{adj.after.range.end}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}
