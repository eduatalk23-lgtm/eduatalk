"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import {
  CheckCircle,
  XCircle,
  Clock,
  Database,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { BatchResult } from "@/lib/domains/plan/llm/actions/coldStart/batch/types";

interface BatchResultsSectionProps {
  result: BatchResult | null;
}

function BatchResultsSectionComponent({ result }: BatchResultsSectionProps) {
  if (!result) return null;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`;
    }
    return `${seconds}초`;
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            "rounded-lg p-2",
            result.success
              ? "bg-emerald-100 dark:bg-emerald-900/50"
              : "bg-amber-100 dark:bg-amber-900/50"
          )}
        >
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div>
          <h3 className="text-h3 text-gray-900 dark:text-gray-100">
            배치 처리 결과
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(result.completedAt).toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="flex flex-col p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">전체</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {result.stats.total}
          </span>
        </div>
        <div className="flex flex-col p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400">성공</span>
          </div>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {result.stats.succeeded}
          </span>
        </div>
        <div className="flex flex-col p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400">실패</span>
          </div>
          <span className="text-2xl font-bold text-red-700 dark:text-red-300">
            {result.stats.failed}
          </span>
        </div>
        <div className="flex flex-col p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">소요 시간</span>
          </div>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatDuration(result.totalDurationMs)}
          </span>
        </div>
      </div>

      {/* 추가 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <Database className="w-5 h-5 text-indigo-500" />
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">새로 저장</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {result.stats.totalNewlySaved}개
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <FileText className="w-5 h-5 text-gray-500" />
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">중복 스킵</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {result.stats.totalDuplicatesSkipped}개
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Fallback 사용</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {result.stats.usedFallback}회
            </div>
          </div>
        </div>
      </div>

      {/* 개별 결과 테이블 */}
      {result.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">
                  대상
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-500 dark:text-gray-400">
                  상태
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">
                  추천
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">
                  저장
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">
                  시간
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {result.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2 px-3">
                    <div className="flex flex-col">
                      <span className="text-gray-900 dark:text-gray-100">
                        {item.target.subjectCategory}
                        {item.target.subject && ` > ${item.target.subject}`}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.target.difficulty && `${item.target.difficulty} · `}
                        {item.target.contentType}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {item.success ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="w-3 h-3" />
                        성공
                        {item.usedFallback && (
                          <span className="text-amber-600 dark:text-amber-400">(FB)</span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        <XCircle className="w-3 h-3" />
                        실패
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-900 dark:text-gray-100">
                    {item.recommendationCount}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-900 dark:text-gray-100">
                    {item.newlySaved}
                    {item.duplicatesSkipped > 0 && (
                      <span className="text-gray-400 text-xs ml-1">
                        (+{item.duplicatesSkipped} 중복)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">
                    {(item.durationMs / 1000).toFixed(1)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 에러 목록 */}
      {result.errors.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">
            에러 목록 ({result.errors.length}건)
          </h4>
          <div className="space-y-2">
            {result.errors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm"
              >
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-700 dark:text-red-300">
                    {error.target.subjectCategory}
                    {error.target.subject && ` > ${error.target.subject}`}
                  </div>
                  <div className="text-red-600 dark:text-red-400 text-xs mt-1">
                    {error.error}
                    {error.isRateLimitError && (
                      <span className="ml-2 text-amber-600">(Rate Limit)</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const BatchResultsSection = memo(BatchResultsSectionComponent);
export default BatchResultsSection;
