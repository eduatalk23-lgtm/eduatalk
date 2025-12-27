"use client";

import { useState, useTransition } from "react";
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  Video,
  FileText,
  ChevronRight,
  ChevronLeft,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { DashboardPlan } from "@/lib/domains/plan/actions/adjustDashboard";
import { cn } from "@/lib/cn";

type PlanDetailModalProps = {
  plan: DashboardPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (planId: string, newDate: string) => void;
  onDelete?: (planId: string) => void;
  isMoving?: boolean;
};

const STATUS_CONFIG = {
  pending: {
    label: "예정",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  in_progress: {
    label: "진행 중",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  completed: {
    label: "완료",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
  },
};

const CONTENT_TYPE_ICONS = {
  book: BookOpen,
  lecture: Video,
  custom: FileText,
};

export function PlanDetailModal({
  plan,
  open,
  onOpenChange,
  onMove,
  onDelete,
  isMoving = false,
}: PlanDetailModalProps) {
  const [selectedDate, setSelectedDate] = useState(plan.planDate);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!open) return null;

  const statusConfig = STATUS_CONFIG[plan.status];
  const ContentIcon = CONTENT_TYPE_ICONS[plan.contentType] || FileText;
  const isPast = new Date(plan.planDate) < new Date(new Date().toISOString().split("T")[0]);
  const canEdit = plan.status === "pending" && !isPast;

  const handleDateChange = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    const newDate = date.toISOString().split("T")[0];

    // 과거 날짜로는 이동 불가
    const today = new Date().toISOString().split("T")[0];
    if (newDate >= today) {
      setSelectedDate(newDate);
    }
  };

  const handleApplyMove = () => {
    if (selectedDate !== plan.planDate) {
      onMove(plan.id, selectedDate);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(plan.id);
      onOpenChange(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: plan.color }}
            >
              <ContentIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                플랜 상세
              </h2>
              <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs", statusConfig.color)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot)} />
                {statusConfig.label}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-4">
          {/* 콘텐츠 정보 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">콘텐츠</h3>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {plan.contentTitle}
            </p>
            {plan.subject && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{plan.subject}</p>
            )}
          </div>

          {/* 범위 및 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen className="h-4 w-4" />
                범위
              </div>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {plan.rangeStart} - {plan.rangeEnd}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                예상 시간
              </div>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {plan.estimatedMinutes}분
              </p>
            </div>
          </div>

          {/* 날짜 변경 */}
          {canEdit ? (
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar className="h-4 w-4" />
                날짜 변경
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDateChange(-1)}
                  disabled={isMoving}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatDate(selectedDate)}
                  </p>
                  {selectedDate !== plan.planDate && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      ← {formatDate(plan.planDate)}에서 변경
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDateChange(1)}
                  disabled={isMoving}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                날짜
              </div>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatDate(plan.planDate)}
              </p>
              {!canEdit && (
                <p className="mt-1 text-xs text-gray-400">
                  {isPast ? "지난 날짜의 플랜은 이동할 수 없습니다." : "완료된 플랜은 이동할 수 없습니다."}
                </p>
              )}
            </div>
          )}

          {/* 삭제 확인 */}
          {showDeleteConfirm && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm font-medium">정말 이 플랜을 삭제할까요?</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-gray-200 p-4 dark:border-gray-700">
          {onDelete && canEdit && !showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              닫기
            </button>
            {canEdit && selectedDate !== plan.planDate && (
              <button
                type="button"
                onClick={handleApplyMove}
                disabled={isMoving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isMoving ? "이동 중..." : "날짜 변경"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
