"use client";

/**
 * Phase 6 P3 개선: 플랜 그룹 자동 복구 기능 추가
 *
 * - 문제 카테고리에 복구 버튼 추가
 * - 누락된 플랜 그룹 자동 생성
 */

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { recoverMissingPlanGroupsAction } from "@/lib/domains/camp/actions";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingDown,
  FileX,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Participant, ParticipantsStats } from "./types";

type ProblemCategory = {
  id: string;
  label: string;
  description: string;
  count: number;
  severity: "critical" | "warning" | "info";
  participants: Participant[];
  canRecover?: boolean; // Phase 6 P3: 복구 가능 여부
};

type CampOverviewDashboardProps = {
  templateId: string; // Phase 6 P3: 복구 액션에 필요
  stats: ParticipantsStats;
  participants: Participant[];
  needsActionParticipants: Participant[];
  onQuickAction: (action: "bulk_plan" | "send_reminder" | "bulk_activate") => void;
  onReload?: () => void; // Phase 6 P3: 복구 후 새로고침
  isPending: boolean;
  selectedCount: number;
};

/**
 * 캠프 통합 대시보드 컴포넌트
 * - 핵심 지표 요약
 * - 문제 참여자 카테고리별 하이라이트
 * - 빠른 액션 버튼
 */
export function CampOverviewDashboard({
  templateId,
  stats,
  participants,
  needsActionParticipants,
  onQuickAction,
  onReload,
  isPending,
  selectedCount,
}: CampOverviewDashboardProps) {
  const toast = useToast();
  const [isRecovering, startRecoveryTransition] = useTransition();
  const [recoveryResult, setRecoveryResult] = useState<{
    success: boolean;
    recoveredCount: number;
    failedCount: number;
  } | null>(null);

  // 참여자별 문제 카테고리 분석
  const problemCategories = useMemo<ProblemCategory[]>(() => {
    const categories: ProblemCategory[] = [];

    // 1. 플랜 생성 필요 (수락했지만 플랜 없음)
    const needsPlanCreation = participants.filter(
      (p) =>
        (p.invitation_status === "accepted" || p.display_status === "submitted") &&
        p.plan_group_id &&
        !p.hasPlans
    );
    if (needsPlanCreation.length > 0) {
      categories.push({
        id: "needs_plan",
        label: "플랜 생성 필요",
        description: "참여를 수락했지만 학습 플랜이 아직 생성되지 않았습니다.",
        count: needsPlanCreation.length,
        severity: "critical",
        participants: needsPlanCreation,
      });
    }

    // 2. 초대 응답 대기 (pending 상태가 3일 이상)
    const pendingTooLong = participants.filter((p) => {
      if (p.invitation_status !== "pending") return false;
      if (!p.invited_at) return false;
      const invitedDate = new Date(p.invited_at);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - invitedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays >= 3;
    });
    if (pendingTooLong.length > 0) {
      categories.push({
        id: "pending_long",
        label: "응답 대기 (3일+)",
        description: "초대 후 3일 이상 응답이 없는 학생입니다. 리마인더를 보내세요.",
        count: pendingTooLong.length,
        severity: "warning",
        participants: pendingTooLong,
      });
    }

    // 3. 낮은 출석률 (50% 미만)
    const lowAttendance = participants.filter(
      (p) =>
        p.hasPlans &&
        p.attendance_rate !== null &&
        p.attendance_rate !== undefined &&
        p.attendance_rate < 50
    );
    if (lowAttendance.length > 0) {
      categories.push({
        id: "low_attendance",
        label: "낮은 출석률",
        description: "출석률이 50% 미만인 학생입니다.",
        count: lowAttendance.length,
        severity: "warning",
        participants: lowAttendance,
      });
    }

    // 4. 낮은 완료율 (30% 미만)
    const lowCompletion = participants.filter(
      (p) =>
        p.hasPlans &&
        p.plan_completion_rate !== null &&
        p.plan_completion_rate !== undefined &&
        p.plan_completion_rate < 30
    );
    if (lowCompletion.length > 0) {
      categories.push({
        id: "low_completion",
        label: "낮은 플랜 완료율",
        description: "플랜 완료율이 30% 미만인 학생입니다.",
        count: lowCompletion.length,
        severity: "warning",
        participants: lowCompletion,
      });
    }

    // 5. 플랜 그룹 누락 (수락했지만 plan_group_id 없음) - Phase 6 P3: 복구 가능
    const missingPlanGroup = participants.filter(
      (p) =>
        (p.invitation_status === "accepted" || p.display_status === "submitted") &&
        !p.plan_group_id
    );
    if (missingPlanGroup.length > 0) {
      categories.push({
        id: "missing_group",
        label: "플랜 그룹 누락",
        description: "플랜 그룹이 생성되지 않았습니다. 복구가 필요합니다.",
        count: missingPlanGroup.length,
        severity: "critical",
        participants: missingPlanGroup,
        canRecover: true, // Phase 6 P3
      });
    }

    return categories;
  }, [participants]);

  // Phase 6 P3: 플랜 그룹 복구 핸들러
  const handleRecoverMissingGroups = () => {
    startRecoveryTransition(async () => {
      try {
        const result = await recoverMissingPlanGroupsAction(templateId);

        setRecoveryResult({
          success: result.success,
          recoveredCount: result.recoveredCount,
          failedCount: result.failedCount,
        });

        if (result.success && result.recoveredCount > 0) {
          toast.showSuccess(
            `${result.recoveredCount}명의 플랜 그룹이 복구되었습니다.`
          );
          onReload?.();
        } else if (result.recoveredCount === 0 && result.failedCount === 0) {
          toast.showInfo("복구할 플랜 그룹이 없습니다.");
        } else if (result.failedCount > 0) {
          toast.showError(
            `복구 완료: 성공 ${result.recoveredCount}명, 실패 ${result.failedCount}명`
          );
        }
      } catch (error) {
        console.error("[CampOverviewDashboard] 복구 실패:", error);
        toast.showError("플랜 그룹 복구 중 오류가 발생했습니다.");
      }
    });
  };

  // 전체 학습 통계 계산
  const learningStats = useMemo(() => {
    const withStats = participants.filter(
      (p) => p.hasPlans && p.study_minutes !== null && p.study_minutes !== undefined
    );

    if (withStats.length === 0) {
      return {
        totalStudyMinutes: 0,
        avgStudyMinutes: 0,
        avgAttendanceRate: 0,
        avgCompletionRate: 0,
      };
    }

    const totalStudyMinutes = withStats.reduce(
      (sum, p) => sum + (p.study_minutes || 0),
      0
    );
    const avgStudyMinutes = Math.round(totalStudyMinutes / withStats.length);

    const withAttendance = withStats.filter(
      (p) => p.attendance_rate !== null && p.attendance_rate !== undefined
    );
    const avgAttendanceRate =
      withAttendance.length > 0
        ? Math.round(
            withAttendance.reduce((sum, p) => sum + (p.attendance_rate || 0), 0) /
              withAttendance.length
          )
        : 0;

    const withCompletion = withStats.filter(
      (p) => p.plan_completion_rate !== null && p.plan_completion_rate !== undefined
    );
    const avgCompletionRate =
      withCompletion.length > 0
        ? Math.round(
            withCompletion.reduce((sum, p) => sum + (p.plan_completion_rate || 0), 0) /
              withCompletion.length
          )
        : 0;

    return {
      totalStudyMinutes,
      avgStudyMinutes,
      avgAttendanceRate,
      avgCompletionRate,
    };
  }, [participants]);

  // 시간 포맷팅
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  const hasCriticalIssues = problemCategories.some((c) => c.severity === "critical");
  const hasWarnings = problemCategories.some((c) => c.severity === "warning");

  // Phase 6 P3: 카테고리별 아이콘
  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case "needs_plan":
        return FileX;
      case "pending_long":
        return Clock;
      case "low_attendance":
      case "low_completion":
        return TrendingDown;
      case "missing_group":
        return AlertTriangle;
      default:
        return AlertTriangle;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 핵심 지표 요약 (2행) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* 참여자 현황 */}
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">전체 참여자</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.total}명</div>
          <div className="text-xs text-gray-500">
            수락 {stats.accepted} / 대기 {stats.pending} / 거절 {stats.declined}
          </div>
        </div>

        {/* 플랜 진행률 */}
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">플랜 생성 완료</div>
          <div className="text-2xl font-semibold text-blue-600">
            {participants.filter((p) => p.hasPlans).length}명
          </div>
          <div className="text-xs text-gray-500">
            {stats.accepted > 0
              ? Math.round(
                  (participants.filter((p) => p.hasPlans).length / stats.accepted) * 100
                )
              : 0}
            % 완료
          </div>
        </div>

        {/* 평균 출석률 */}
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">평균 출석률</div>
          <div
            className={cn(
              "text-2xl font-semibold",
              learningStats.avgAttendanceRate >= 80
                ? "text-green-600"
                : learningStats.avgAttendanceRate >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
            )}
          >
            {learningStats.avgAttendanceRate}%
          </div>
          <div className="text-xs text-gray-500">
            플랜 완료율 {learningStats.avgCompletionRate}%
          </div>
        </div>

        {/* 총 학습 시간 */}
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">총 학습 시간</div>
          <div className="text-2xl font-semibold text-purple-600">
            {formatMinutes(learningStats.totalStudyMinutes)}
          </div>
          <div className="text-xs text-gray-500">
            평균 {formatMinutes(learningStats.avgStudyMinutes)}/인
          </div>
        </div>
      </div>

      {/* 문제 참여자 하이라이트 */}
      {problemCategories.length > 0 && (
        <div
          className={cn(
            "rounded-lg border p-4",
            hasCriticalIssues
              ? "border-red-200 bg-red-50"
              : hasWarnings
                ? "border-yellow-200 bg-yellow-50"
                : "border-blue-200 bg-blue-50"
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle
              className={cn(
                "h-5 w-5",
                hasCriticalIssues
                  ? "text-red-600"
                  : hasWarnings
                    ? "text-yellow-600"
                    : "text-blue-600"
              )}
            />
            <h3
              className={cn(
                "text-sm font-semibold",
                hasCriticalIssues
                  ? "text-red-900"
                  : hasWarnings
                    ? "text-yellow-900"
                    : "text-blue-900"
              )}
            >
              주의가 필요한 참여자
            </h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {problemCategories.map((category) => {
              const Icon = getCategoryIcon(category.id);
              return (
                <div
                  key={category.id}
                  className={cn(
                    "rounded-md border p-3",
                    category.severity === "critical"
                      ? "border-red-300 bg-white"
                      : category.severity === "warning"
                        ? "border-yellow-300 bg-white"
                        : "border-blue-300 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          category.severity === "critical"
                            ? "text-red-600"
                            : category.severity === "warning"
                              ? "text-yellow-600"
                              : "text-blue-600"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          category.severity === "critical"
                            ? "text-red-700"
                            : category.severity === "warning"
                              ? "text-yellow-700"
                              : "text-blue-700"
                        )}
                      >
                        {category.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        category.severity === "critical"
                          ? "bg-red-100 text-red-800"
                          : category.severity === "warning"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {category.count}명
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{category.description}</p>

                  {/* Phase 6 P3: 복구 버튼 */}
                  {category.canRecover && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleRecoverMissingGroups}
                        disabled={isRecovering || isPending}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                          "bg-red-600 text-white hover:bg-red-700",
                          "disabled:cursor-not-allowed disabled:opacity-50"
                        )}
                      >
                        {isRecovering ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            복구 중...
                          </>
                        ) : (
                          <>
                            <Wrench className="h-3.5 w-3.5" />
                            플랜 그룹 복구
                          </>
                        )}
                      </button>
                      {recoveryResult && recoveryResult.recoveredCount > 0 && (
                        <span className="ml-2 text-xs text-green-600">
                          {recoveryResult.recoveredCount}명 복구 완료
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빠른 액션 버튼 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <span className="text-sm font-medium text-gray-700">빠른 작업:</span>

        <button
          onClick={() => onQuickAction("bulk_plan")}
          disabled={isPending || needsActionParticipants.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          플랜 일괄 생성 ({needsActionParticipants.length})
        </button>

        <button
          onClick={() => onQuickAction("send_reminder")}
          disabled={isPending || stats.pending === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          대기중 리마인더 ({stats.pending})
        </button>

        {selectedCount > 0 && (
          <button
            onClick={() => onQuickAction("bulk_activate")}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            선택 활성화 ({selectedCount})
          </button>
        )}
      </div>
    </div>
  );
}
