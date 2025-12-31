"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Filter,
  Clock,
  User,
  ChevronRight,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { campAlertsQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampTemplate } from "@/lib/domains/camp/types";
import type { StudentAlert, AlertSeverity, AlertCategory } from "@/app/api/admin/camps/alerts/route";
import { CampSelector } from "../../camp-attendance/_components/CampSelector";

type CampAlertsDashboardProps = {
  initialCamps: CampTemplate[];
};

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { icon: typeof AlertTriangle; color: string; bgColor: string; label: string }
> = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    label: "심각",
  },
  warning: {
    icon: AlertCircle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    label: "경고",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    label: "정보",
  },
};

const CATEGORY_CONFIG: Record<
  AlertCategory,
  { icon: typeof User; label: string }
> = {
  attendance: { icon: CheckCircle2, label: "출석" },
  learning: { icon: BookOpen, label: "학습" },
  progress: { icon: Clock, label: "진행" },
};

export function CampAlertsDashboard({ initialCamps }: CampAlertsDashboardProps) {
  // 선택된 캠프 ID들
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>(() =>
    initialCamps.slice(0, 5).map((c) => c.id)
  );

  // 필터 상태
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | "all">("all");
  const [filterCategory, setFilterCategory] = useState<AlertCategory | "all">("all");

  // 데이터 조회
  const {
    data: alertsData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery(campAlertsQueryOptions(selectedCampIds));

  // 필터링된 알림
  const filteredAlerts = useMemo(() => {
    if (!alertsData?.alerts) return [];

    return alertsData.alerts.filter((alert) => {
      if (filterSeverity !== "all" && alert.severity !== filterSeverity) return false;
      if (filterCategory !== "all" && alert.category !== filterCategory) return false;
      return true;
    });
  }, [alertsData?.alerts, filterSeverity, filterCategory]);

  // 캠프 선택 변경
  const handleCampSelectionChange = (campId: string, selected: boolean) => {
    setSelectedCampIds((prev) => {
      if (selected) {
        return [...prev, campId];
      }
      return prev.filter((id) => id !== campId);
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedCampIds(initialCamps.map((c) => c.id));
    } else {
      setSelectedCampIds([]);
    }
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              이상 징후 감지
            </h1>
            <p className="text-sm text-gray-500">
              주의가 필요한 학생들을 자동으로 감지하고 관리하세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50",
                isFetching && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              새로고침
            </button>
            <Link
              href="/admin/camp-templates"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              캠프 목록
            </Link>
          </div>
        </div>

        {/* 캠프 선택 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <CampSelector
            camps={initialCamps}
            selectedCampIds={selectedCampIds}
            onSelectionChange={handleCampSelectionChange}
            onSelectAll={handleSelectAll}
          />
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="text-sm text-gray-500">이상 징후를 분석하는 중...</p>
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-800">{error.message}</p>
          </div>
        )}

        {/* 선택된 캠프 없음 */}
        {!isLoading && selectedCampIds.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <Filter className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              이상 징후를 확인할 캠프를 선택해주세요.
            </p>
          </div>
        )}

        {/* 데이터 표시 */}
        {!isLoading && alertsData && selectedCampIds.length > 0 && (
          <>
            {/* 요약 통계 카드 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <AlertCircle className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">전체 알림</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {alertsData.summary.total}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-red-600">심각</p>
                    <p className="text-2xl font-bold text-red-700">
                      {alertsData.summary.critical}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-100 p-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-yellow-600">경고</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {alertsData.summary.warning}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">정보</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {alertsData.summary.info}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 카테고리별 통계 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">출석 관련</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {alertsData.summary.byCategory.attendance}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">학습 관련</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {alertsData.summary.byCategory.learning}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">진행 관련</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {alertsData.summary.byCategory.progress}
                </p>
              </div>
            </div>

            {/* 필터 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">심각도:</span>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(["all", "critical", "warning", "info"] as const).map((severity) => (
                    <button
                      key={severity}
                      onClick={() => setFilterSeverity(severity)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition",
                        filterSeverity === severity
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {severity === "all"
                        ? "전체"
                        : SEVERITY_CONFIG[severity].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">카테고리:</span>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(["all", "attendance", "learning", "progress"] as const).map(
                    (category) => (
                      <button
                        key={category}
                        onClick={() => setFilterCategory(category)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium transition",
                          filterCategory === category
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        {category === "all"
                          ? "전체"
                          : CATEGORY_CONFIG[category].label}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  알림 목록 ({filteredAlerts.length})
                </h2>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-300" />
                  <p className="mt-4 text-gray-500">
                    {alertsData.alerts.length === 0
                      ? "감지된 이상 징후가 없습니다."
                      : "선택한 필터에 해당하는 알림이 없습니다."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredAlerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AlertItem({ alert }: { alert: StudentAlert }) {
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const categoryConfig = CATEGORY_CONFIG[alert.category];
  const SeverityIcon = severityConfig.icon;
  const CategoryIcon = categoryConfig.icon;

  return (
    <div
      className={cn(
        "px-6 py-4 hover:bg-gray-50 transition",
        alert.severity === "critical" && "bg-red-50/30"
      )}
    >
      <div className="flex items-start gap-4">
        {/* 심각도 아이콘 */}
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            alert.severity === "critical" && "bg-red-100",
            alert.severity === "warning" && "bg-yellow-100",
            alert.severity === "info" && "bg-blue-100"
          )}
        >
          <SeverityIcon
            className={cn(
              "h-5 w-5",
              severityConfig.color
            )}
          />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/camp-students/${alert.studentId}`}
              className="text-base font-semibold text-gray-900 hover:text-indigo-600 hover:underline"
            >
              {alert.studentName}
            </Link>
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-600">{alert.campName}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                severityConfig.bgColor
              )}
            >
              {severityConfig.label}
            </span>
          </div>

          <p className="mt-1 text-sm font-medium text-gray-800">{alert.title}</p>
          <p className="mt-0.5 text-sm text-gray-600">{alert.description}</p>

          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CategoryIcon className="h-3.5 w-3.5" />
              {categoryConfig.label}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(alert.detectedAt).toLocaleString("ko-KR")}
            </span>
          </div>
        </div>

        {/* 액션 */}
        <Link
          href={`/admin/camp-students/${alert.studentId}`}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition"
        >
          상세보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
