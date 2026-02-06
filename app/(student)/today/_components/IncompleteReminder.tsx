"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, X, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/cn";
import type { IncompletePlanInfo } from "@/lib/services/planReminderService";

interface IncompleteReminderProps {
  /** 오늘 미완료 플랜 */
  todayIncomplete: IncompletePlanInfo[];
  /** 지연된 플랜 */
  delayedPlans: IncompletePlanInfo[];
  /** 주간 요약 */
  weeklySummary?: {
    totalIncomplete: number;
    bySubject: Record<string, number>;
  };
  /** 닫기 콜백 */
  onDismiss?: () => void;
  /** 자동 숨김 여부 */
  autoDismiss?: boolean;
  /** 자동 숨김 시간 (ms) */
  autoDismissMs?: number;
  className?: string;
}

/**
 * 미완료 플랜 알림 배너 컴포넌트
 *
 * 오늘 미완료 플랜이나 지연된 플랜이 있을 때 표시
 */
export function IncompleteReminder({
  todayIncomplete,
  delayedPlans,
  weeklySummary,
  onDismiss,
  autoDismiss = false,
  autoDismissMs = 10000,
  className,
}: IncompleteReminderProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // 자동 숨김
  useEffect(() => {
    if (autoDismiss && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissMs, isVisible, onDismiss]);

  // 표시할 내용이 없으면 렌더링하지 않음
  if (
    todayIncomplete.length === 0 &&
    delayedPlans.length === 0 &&
    (!weeklySummary || weeklySummary.totalIncomplete === 0)
  ) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handlePlanClick = (planId: string) => {
    router.push(`/today/plan/${planId}`);
  };

  // 지연 플랜이 있으면 경고 스타일
  const hasDelayed = delayedPlans.length > 0;
  const hasTodayIncomplete = todayIncomplete.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 shadow-sm",
        hasDelayed
          ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50"
          : "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50",
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              hasDelayed ? "bg-orange-100" : "bg-blue-100"
            )}
          >
            {hasDelayed ? (
              <AlertTriangle
                className={cn("h-5 w-5", hasDelayed ? "text-orange-600" : "text-blue-600")}
              />
            ) : (
              <Clock className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <h3
              className={cn(
                "text-sm font-bold",
                hasDelayed ? "text-orange-800" : "text-blue-800"
              )}
            >
              {hasDelayed
                ? `미완료 플랜이 ${delayedPlans.length}건 있어요`
                : `오늘 ${todayIncomplete.length}개의 플랜이 남았어요`}
            </h3>
            <p
              className={cn(
                "mt-0.5 text-xs",
                hasDelayed ? "text-orange-600" : "text-blue-600"
              )}
            >
              {hasDelayed
                ? `가장 오래된 플랜: ${delayedPlans[0].daysDelayed}일 전`
                : "지금 시작해볼까요?"}
            </p>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={handleDismiss}
          className={cn(
            "shrink-0 rounded-full p-1.5 transition-colors",
            hasDelayed
              ? "text-orange-400 hover:bg-orange-100 hover:text-orange-600"
              : "text-blue-400 hover:bg-blue-100 hover:text-blue-600"
          )}
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 플랜 목록 (접기/펼치기) */}
      {(hasTodayIncomplete || hasDelayed) && (
        <div className="mt-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              hasDelayed
                ? "bg-orange-100/50 text-orange-700 hover:bg-orange-100"
                : "bg-blue-100/50 text-blue-700 hover:bg-blue-100"
            )}
          >
            <span>
              {showDetails ? "목록 접기" : "플랜 목록 보기"}
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                showDetails && "rotate-90"
              )}
            />
          </button>

          {showDetails && (
            <div className="mt-2 space-y-2">
              {/* 지연 플랜 */}
              {hasDelayed && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-orange-700">
                    미완료 플랜
                  </p>
                  {delayedPlans.slice(0, 3).map((plan) => (
                    <button
                      key={plan.planId}
                      onClick={() => handlePlanClick(plan.planId)}
                      className="flex w-full items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {plan.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {plan.subject && <span>{plan.subject}</span>}
                          <span className="text-orange-600">
                            {plan.daysDelayed}일 전
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                  ))}
                  {delayedPlans.length > 3 && (
                    <p className="px-3 text-xs text-orange-600">
                      +{delayedPlans.length - 3}개 더
                    </p>
                  )}
                </div>
              )}

              {/* 오늘 미완료 플랜 */}
              {hasTodayIncomplete && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-blue-700">
                    오늘 남은 플랜
                  </p>
                  {todayIncomplete.slice(0, 3).map((plan) => (
                    <button
                      key={plan.planId}
                      onClick={() => handlePlanClick(plan.planId)}
                      className="flex w-full items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {plan.title}
                        </p>
                        {plan.subject && (
                          <p className="text-xs text-gray-500">{plan.subject}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                    </button>
                  ))}
                  {todayIncomplete.length > 3 && (
                    <p className="px-3 text-xs text-blue-600">
                      +{todayIncomplete.length - 3}개 더
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 주간 요약 (옵션) */}
      {weeklySummary && weeklySummary.totalIncomplete > 0 && !hasDelayed && !hasTodayIncomplete && (
        <div className="mt-3 rounded-lg bg-white/60 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Calendar className="h-3.5 w-3.5" />
            <span>이번 주 미완료: {weeklySummary.totalIncomplete}개</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(weeklySummary.bySubject).map(([subject, count]) => (
              <span
                key={subject}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {subject} {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 시작 버튼 */}
      {(hasTodayIncomplete || hasDelayed) && (
        <button
          onClick={() => {
            const firstPlan = hasDelayed ? delayedPlans[0] : todayIncomplete[0];
            handlePlanClick(firstPlan.planId);
          }}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors",
            hasDelayed
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-blue-600 hover:bg-blue-700"
          )}
        >
          <span>
            {hasDelayed ? "미완료 플랜 처리하기" : "지금 시작하기"}
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * 컴팩트 버전 - 작은 배너 형태
 */
export function IncompleteReminderCompact({
  count,
  hasDelayed = false,
  onClick,
  className,
}: {
  count: number;
  hasDelayed?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        hasDelayed
          ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
          : "bg-blue-100 text-blue-700 hover:bg-blue-200",
        className
      )}
    >
      {hasDelayed ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      <span>
        {hasDelayed ? `미완료 ${count}건` : `${count}건 남음`}
      </span>
    </button>
  );
}
