"use client";

/**
 * 생성 이력 목록 컴포넌트
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  History,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Calendar,
  Users,
  Sparkles,
  Zap,
  BookOpen,
} from "lucide-react";
import type { HistoryListItem, HistoryStatus } from "../../_types/historyTypes";
import type { CreationMethod } from "../../_types";
import { getHistoryList } from "../../_actions";
import { HistoryDetailModal } from "./HistoryDetailModal";

interface HistoryListProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
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
    className: "text-blue-500 animate-spin",
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
    icon: AlertCircle,
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
    className: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
  },
  planGroup: {
    icon: Calendar,
    label: "플랜 그룹",
    className: "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
  },
  quickPlan: {
    icon: Zap,
    label: "빠른 플랜",
    className: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
  },
  contentAdd: {
    icon: BookOpen,
    label: "콘텐츠 추가",
    className: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  },
};

export function HistoryList({ className, limit = 10, showHeader = true }: HistoryListProps) {
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 이력 로드
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await getHistoryList({ limit });
    if (!error && data) {
      setHistory(data);
    }
    setIsLoading(false);
  }, [limit]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 시간 포맷
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
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
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 ${minutes % 60}분`;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <History className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className={cn("text-sm", textSecondary)}>생성 이력이 없습니다</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-gray-400" />
          <h3 className={cn("font-medium", textPrimary)}>최근 생성 이력</h3>
        </div>
      )}

      <div className="space-y-2">
        {history.map((item) => {
          const statusConfig = STATUS_CONFIG[item.status];
          const methodConfig = METHOD_CONFIG[item.creationMethod];
          const StatusIcon = statusConfig.icon;
          const MethodIcon = methodConfig.icon;

          return (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-4",
                borderInput,
                "bg-white dark:bg-gray-800",
                "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                "transition text-left"
              )}
            >
              <div className="flex items-center gap-4">
                {/* 메서드 아이콘 */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    methodConfig.className
                  )}
                >
                  <MethodIcon className="h-5 w-5" />
                </div>

                {/* 정보 */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", textPrimary)}>
                      {methodConfig.label}
                    </span>
                    <span className={cn("flex items-center gap-1 text-sm", statusConfig.className)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className={cn("flex items-center gap-3 text-sm", textSecondary)}>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {item.totalCount}명
                    </span>
                    <span>
                      {item.successCount}성공 / {item.failedCount}실패
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {getDuration(item.startedAt, item.completedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn("text-sm", textSecondary)}>
                  {formatDate(item.startedAt)}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 상세 모달 */}
      <HistoryDetailModal
        historyId={selectedId}
        isOpen={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
