"use client";

/**
 * 검증 결과 및 AI 추천 컴포넌트
 *
 * 각 행의 검증 상태 표시 + 누락 필드 AI 추천 적용
 */

import Button from "@/components/atoms/Button";
import type { ContentType, BulkImportValidationResult } from "@/lib/domains/content-research/types";

interface ParsedRow {
  originalData: Record<string, unknown>;
  aiSuggestions?: Record<string, unknown>;
  appliedData: Record<string, unknown>;
  selected: boolean;
}

interface ValidationResultsProps {
  result: BulkImportValidationResult;
  parsedRows: ParsedRow[];
  contentType: ContentType;
  onApplySuggestion: (rowIndex: number, field: string) => void;
  onApplyAllSuggestions: () => void;
  onToggleRow: (rowIndex: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ValidationResults({
  result,
  parsedRows,
  contentType,
  onApplySuggestion,
  onApplyAllSuggestions,
  onToggleRow,
  onBack,
  onNext,
}: ValidationResultsProps) {
  const hasAiSuggestions = parsedRows.some((row) => row.aiSuggestions && Object.keys(row.aiSuggestions).length > 0);
  const selectedCount = parsedRows.filter((r) => r.selected).length;

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="총 행"
          value={result.totalRows}
          color="gray"
        />
        <SummaryCard
          label="유효"
          value={result.validRows}
          color="green"
        />
        <SummaryCard
          label="검토 필요"
          value={result.needsReviewRows}
          color="yellow"
        />
        <SummaryCard
          label="무효"
          value={result.invalidRows}
          color="red"
        />
      </div>

      {/* AI 추천 일괄 적용 */}
      {hasAiSuggestions && (
        <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div>
            <p className="font-medium text-purple-800">
              🤖 AI 추천값이 있습니다
            </p>
            <p className="text-sm text-purple-600">
              누락된 필드에 대해 AI가 추정값을 제안했습니다.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyAllSuggestions}
          >
            모든 추천 적용
          </Button>
        </div>
      )}

      {/* 상세 결과 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  선택
                </th>
                <th className="w-12 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  과목
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  난이도
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {contentType === "book" ? "페이지" : "강의수"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  AI 추천
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {result.rows.map((row, idx) => {
                const parsed = parsedRows[idx];
                const isInvalid = row.status === "invalid";

                return (
                  <tr
                    key={idx}
                    className={`
                      ${isInvalid ? "bg-red-50" : ""}
                      ${row.status === "needs_review" ? "bg-yellow-50" : ""}
                    `}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={parsed.selected}
                        onChange={() => onToggleRow(idx)}
                        disabled={isInvalid}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                      {String(parsed.appliedData.title || "-")}
                    </td>
                    <td className="px-4 py-3">
                      <FieldCell
                        value={parsed.appliedData.subject}
                        suggestion={parsed.aiSuggestions?.subject}
                        onApply={() => onApplySuggestion(idx, "subject")}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <FieldCell
                        value={parsed.appliedData.difficulty_level}
                        suggestion={parsed.aiSuggestions?.difficulty}
                        onApply={() => onApplySuggestion(idx, "difficulty_level")}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {contentType === "book"
                        ? String(parsed.appliedData.total_pages || "-")
                        : String(parsed.appliedData.total_episodes || "-")}
                    </td>
                    <td className="px-4 py-3">
                      {parsed.aiSuggestions && Object.keys(parsed.aiSuggestions).length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {Object.keys(parsed.aiSuggestions).length}개 제안
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <p className="text-sm text-gray-600">
          {selectedCount}개 항목 선택됨
        </p>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={selectedCount === 0}
        >
          다음: 최종 확인
        </Button>
      </div>
    </div>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
  const styles = {
    valid: "bg-green-100 text-green-800",
    needs_review: "bg-yellow-100 text-yellow-800",
    invalid: "bg-red-100 text-red-800",
  };

  const labels = {
    valid: "유효",
    needs_review: "검토 필요",
    invalid: "무효",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status as keyof typeof styles] || styles.invalid
      }`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

// 필드 셀 (값 + AI 추천)
function FieldCell({
  value,
  suggestion,
  onApply,
}: {
  value: unknown;
  suggestion?: unknown;
  onApply: () => void;
}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  const hasSuggestion = suggestion !== undefined && suggestion !== null && suggestion !== "";

  if (hasValue) {
    return <span className="text-sm text-gray-900">{String(value)}</span>;
  }

  if (hasSuggestion) {
    return (
      <button
        onClick={onApply}
        className="group flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
      >
        <span className="border-b border-dashed border-purple-400">
          {String(suggestion)}
        </span>
        <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          ✓
        </span>
      </button>
    );
  }

  return <span className="text-sm text-gray-400">-</span>;
}

// 요약 카드
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "gray" | "green" | "yellow" | "red";
}) {
  const colors = {
    gray: "bg-gray-50 border-gray-200 text-gray-900",
    green: "bg-green-50 border-green-200 text-green-900",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-900",
    red: "bg-red-50 border-red-200 text-red-900",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
