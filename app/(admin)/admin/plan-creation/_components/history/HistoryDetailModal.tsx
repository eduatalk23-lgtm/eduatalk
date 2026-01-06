"use client";

/**
 * 생성 이력 상세 모달
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  X,
  History,
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  Users,
  Loader2,
  ExternalLink,
  Calendar,
  Sparkles,
  Zap,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import type { PlanCreationHistory, HistoryStatus, HistoryResultItem } from "../../_types/historyTypes";
import type { CreationMethod } from "../../_types";
import { getHistory } from "../../_actions";

interface HistoryDetailModalProps {
  historyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  HistoryStatus,
  { icon: typeof CheckCircle2; label: string; className: string }
> = {
  pending: {
    icon: Clock,
    label: "대기 중",
    className: "text-gray-500",
  },
  processing: {
    icon: Loader2,
    label: "처리 중",
    className: "text-blue-500",
  },
  completed: {
    icon: CheckCircle2,
    label: "완료",
    className: "text-emerald-500",
  },
  failed: {
    icon: XCircle,
    label: "실패",
    className: "text-red-500",
  },
  cancelled: {
    icon: SkipForward,
    label: "취소됨",
    className: "text-amber-500",
  },
};

const METHOD_CONFIG: Record<
  CreationMethod,
  { icon: typeof Sparkles; label: string; className: string }
> = {
  ai: {
    icon: Sparkles,
    label: "AI 플랜",
    className: "text-purple-600 dark:text-purple-400",
  },
  planGroup: {
    icon: Calendar,
    label: "플랜 그룹",
    className: "text-indigo-600 dark:text-indigo-400",
  },
  quickPlan: {
    icon: Zap,
    label: "빠른 플랜",
    className: "text-amber-600 dark:text-amber-400",
  },
  contentAdd: {
    icon: BookOpen,
    label: "콘텐츠 추가",
    className: "text-emerald-600 dark:text-emerald-400",
  },
};

const RESULT_STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
    bgClassName: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  error: {
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
    bgClassName: "bg-red-50 dark:bg-red-900/20",
  },
  skipped: {
    icon: SkipForward,
    className: "text-amber-600 dark:text-amber-400",
    bgClassName: "bg-amber-50 dark:bg-amber-900/20",
  },
};

export function HistoryDetailModal({ historyId, isOpen, onClose }: HistoryDetailModalProps) {
  const [history, setHistory] = useState<PlanCreationHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 이력 상세 로드
  const loadHistory = useCallback(async () => {
    if (!historyId) return;

    setIsLoading(true);
    const { data, error } = await getHistory(historyId);
    if (!error && data) {
      setHistory(data);
    }
    setIsLoading(false);
  }, [historyId]);

  useEffect(() => {
    if (isOpen && historyId) {
      loadHistory();
    }
  }, [isOpen, historyId, loadHistory]);

  // 시간 포맷
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // 소요 시간 계산
  const getDuration = (start: Date, end: Date | null) => {
    if (!end) return "진행 중";
    const diff = end.getTime() - start.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 ${seconds % 60}초`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 ${minutes % 60}분`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 */}
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl shadow-xl",
          "bg-white dark:bg-gray-900",
          "border",
          borderInput
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className={cn("font-semibold", textPrimary)}>생성 이력 상세</h3>
              <p className={cn("text-sm", textSecondary)}>
                {history ? formatDate(history.startedAt) : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "rounded-lg p-2 transition",
              textSecondary,
              "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : history ? (
            <div className="p-6 space-y-6">
              {/* 요약 정보 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 생성 방법 */}
                <div className={cn("rounded-lg border p-4", borderInput)}>
                  <div className={cn("text-sm mb-1", textSecondary)}>생성 방법</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = METHOD_CONFIG[history.creationMethod];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={cn("h-5 w-5", config.className)} />
                          <span className={cn("font-medium", textPrimary)}>
                            {config.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* 상태 */}
                <div className={cn("rounded-lg border p-4", borderInput)}>
                  <div className={cn("text-sm mb-1", textSecondary)}>상태</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = STATUS_CONFIG[history.status];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={cn("h-5 w-5", config.className)} />
                          <span className={cn("font-medium", textPrimary)}>
                            {config.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* 대상 학생 */}
                <div className={cn("rounded-lg border p-4", borderInput)}>
                  <div className={cn("text-sm mb-1", textSecondary)}>대상 학생</div>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-400" />
                    <span className={cn("font-medium", textPrimary)}>
                      {history.totalCount}명
                    </span>
                  </div>
                </div>

                {/* 소요 시간 */}
                <div className={cn("rounded-lg border p-4", borderInput)}>
                  <div className={cn("text-sm mb-1", textSecondary)}>소요 시간</div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className={cn("font-medium", textPrimary)}>
                      {getDuration(history.startedAt, history.completedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 결과 요약 */}
              <div className={cn("rounded-lg border p-4", borderInput)}>
                <div className={cn("text-sm mb-3", textSecondary)}>결과 요약</div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className={cn("font-medium", textPrimary)}>
                      성공: {history.successCount}명
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className={cn("font-medium", textPrimary)}>
                      실패: {history.failedCount}명
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-5 w-5 text-amber-500" />
                    <span className={cn("font-medium", textPrimary)}>
                      스킵: {history.skippedCount}명
                    </span>
                  </div>
                </div>
              </div>

              {/* 상세 결과 */}
              {history.results && history.results.length > 0 && (
                <div>
                  <h4 className={cn("font-medium mb-3", textPrimary)}>학생별 결과</h4>
                  <div className={cn("rounded-lg border overflow-hidden", borderInput)}>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50">
                          <th className={cn("px-4 py-2 text-left text-sm font-medium", textSecondary)}>
                            학생명
                          </th>
                          <th className={cn("px-4 py-2 text-left text-sm font-medium", textSecondary)}>
                            상태
                          </th>
                          <th className={cn("px-4 py-2 text-left text-sm font-medium", textSecondary)}>
                            메시지
                          </th>
                          <th className={cn("px-4 py-2 text-right text-sm font-medium", textSecondary)}>
                            액션
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {history.results.map((result: HistoryResultItem) => {
                          const config = RESULT_STATUS_CONFIG[result.status];
                          const Icon = config.icon;

                          return (
                            <tr key={result.studentId} className={config.bgClassName}>
                              <td className={cn("px-4 py-2 font-medium", textPrimary)}>
                                {result.studentName}
                              </td>
                              <td className="px-4 py-2">
                                <Icon className={cn("h-4 w-4", config.className)} />
                              </td>
                              <td className={cn("px-4 py-2 text-sm", textSecondary)}>
                                {result.message || "-"}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {result.status === "success" && result.planGroupId && (
                                  <Link
                                    href={`/admin/students/${result.studentId}/plans`}
                                    className={cn(
                                      "inline-flex items-center gap-1 text-sm font-medium",
                                      "text-purple-600 hover:text-purple-700",
                                      "dark:text-purple-400 dark:hover:text-purple-300"
                                    )}
                                  >
                                    플랜 보기
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={cn("py-16 text-center", textSecondary)}>
              이력을 불러올 수 없습니다
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              "bg-gray-100 dark:bg-gray-800",
              textPrimary,
              "hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
