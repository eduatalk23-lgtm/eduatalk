"use client";

/**
 * Import 최종 확인 컴포넌트
 *
 * 선택된 항목 미리보기 + 최종 등록 버튼
 */

import Button from "@/components/atoms/Button";
import type { ContentType } from "@/lib/domains/content-research";

interface ParsedRow {
  originalData: Record<string, unknown>;
  aiSuggestions?: Record<string, unknown>;
  appliedData: Record<string, unknown>;
  selected: boolean;
}

interface ImportConfirmationProps {
  parsedRows: ParsedRow[];
  contentType: ContentType;
  onBack: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export function ImportConfirmation({
  parsedRows,
  contentType,
  onBack,
  onConfirm,
  isLoading,
}: ImportConfirmationProps) {
  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          등록 확인
        </h3>
        <p className="text-blue-700">
          아래 <strong>{parsedRows.length}개</strong>의{" "}
          {contentType === "book" ? "교재" : "강의"}가 등록됩니다.
        </p>
      </div>

      {/* 미리보기 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  과목
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  난이도
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {contentType === "book" ? "페이지" : "강의수/시간"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {parsedRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] truncate">
                    {String(row.appliedData.title || "-")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatValue(row.appliedData.subject)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatValue(row.appliedData.subject_category)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <DifficultyBadge level={row.appliedData.difficulty_level as string} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {contentType === "book"
                      ? formatValue(row.appliedData.total_pages)
                      : `${formatValue(row.appliedData.total_episodes)}개 / ${formatValue(row.appliedData.total_duration)}분`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ 주의:</strong> 등록 후에는 개별적으로 수정해야 합니다.
          등록 전에 데이터를 다시 한 번 확인해주세요.
        </p>
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          이전
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          isLoading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? "등록 중..." : `${parsedRows.length}개 등록`}
        </Button>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return String(value);
}

function DifficultyBadge({ level }: { level?: string }) {
  if (!level) {
    return <span className="text-gray-400">-</span>;
  }

  const styles: Record<string, string> = {
    beginner: "bg-green-100 text-green-800",
    basic: "bg-green-100 text-green-800",
    intermediate: "bg-blue-100 text-blue-800",
    advanced: "bg-orange-100 text-orange-800",
    expert: "bg-red-100 text-red-800",
  };

  const labels: Record<string, string> = {
    beginner: "기초",
    basic: "기본",
    intermediate: "중급",
    advanced: "심화",
    expert: "최상급",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[level] || "bg-gray-100 text-gray-800"
      }`}
    >
      {labels[level] || level}
    </span>
  );
}
