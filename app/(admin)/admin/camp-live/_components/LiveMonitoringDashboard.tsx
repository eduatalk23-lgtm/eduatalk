"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Radio,
  Users,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  RefreshCw,
  Filter,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { liveMonitoringQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampTemplate } from "@/lib/domains/camp/types";
import type { LiveStudentStatus } from "@/app/api/admin/camps/live/route";
import { CampSelector } from "../../camp-attendance/_components/CampSelector";

type LiveMonitoringDashboardProps = {
  initialCamps: CampTemplate[];
};

const STATUS_CONFIG = {
  in_progress: {
    label: "학습 중",
    color: "text-green-600",
    bgColor: "bg-green-100",
    borderColor: "border-green-200",
    icon: Play,
  },
  paused: {
    label: "일시정지",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-200",
    icon: Pause,
  },
  completed: {
    label: "완료",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
    icon: CheckCircle2,
  },
  not_started: {
    label: "미시작",
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
    icon: Clock,
  },
};

export function LiveMonitoringDashboard({
  initialCamps,
}: LiveMonitoringDashboardProps) {
  // 선택된 캠프 ID들
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>(() =>
    initialCamps.slice(0, 5).map((c) => c.id)
  );

  // 자동 갱신 상태
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 필터
  const [filterStatus, setFilterStatus] = useState<
    LiveStudentStatus["status"] | "all"
  >("all");

  // 마지막 업데이트 시간
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // 데이터 조회
  const {
    data: liveData,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    ...liveMonitoringQueryOptions(selectedCampIds),
    refetchInterval: autoRefresh ? 15000 : false,
  });

  // 마지막 업데이트 시간 갱신
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt).toLocaleTimeString("ko-KR"));
    }
  }, [dataUpdatedAt]);

  // 필터링된 학생 목록
  const filteredStudents =
    liveData?.students.filter(
      (s) => filterStatus === "all" || s.status === filterStatus
    ) || [];

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
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Radio className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">캠프 관리</p>
              <h1 className="text-3xl font-semibold text-gray-900">
                실시간 모니터링
              </h1>
              <p className="text-sm text-gray-500">
                학생들의 현재 학습 상태를 실시간으로 확인하세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* LIVE 표시 */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                autoRefresh
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )}
              />
              {autoRefresh ? "LIVE" : "중지됨"}
            </div>

            {/* 자동 갱신 토글 */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition",
                autoRefresh
                  ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  : "border-green-500 bg-green-500 text-white hover:bg-green-600"
              )}
            >
              {autoRefresh ? "자동 갱신 중지" : "자동 갱신 시작"}
            </button>

            {/* 수동 새로고침 */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50",
                isFetching && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
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

        {/* 마지막 업데이트 */}
        {lastUpdate && (
          <p className="text-sm text-gray-500">
            마지막 업데이트: {lastUpdate}
            {autoRefresh && " (15초마다 자동 갱신)"}
          </p>
        )}

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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              <p className="text-sm text-gray-500">실시간 데이터 로딩 중...</p>
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
              모니터링할 캠프를 선택해주세요.
            </p>
          </div>
        )}

        {/* 데이터 표시 */}
        {!isLoading && liveData && selectedCampIds.length > 0 && (
          <>
            {/* 실시간 요약 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <LiveStatCard
                label="학습 중"
                value={liveData.summary.totalActive}
                icon={Play}
                color="green"
                pulse
              />
              <LiveStatCard
                label="일시정지"
                value={liveData.summary.totalPaused}
                icon={Pause}
                color="yellow"
              />
              <LiveStatCard
                label="오늘 완료"
                value={liveData.summary.totalCompleted}
                icon={CheckCircle2}
                color="blue"
              />
              <LiveStatCard
                label="미시작"
                value={liveData.summary.totalNotStarted}
                icon={Clock}
                color="gray"
              />
            </div>

            {/* 캠프별 현황 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveData.campStats.map((camp) => (
                <div
                  key={camp.campId}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{camp.campName}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Users className="h-4 w-4" />
                      {camp.totalParticipants}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-600">{camp.activeNow}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span className="text-sm text-gray-600">{camp.pausedNow}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm text-gray-600">{camp.completedToday}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-sm text-gray-600">{camp.notStarted}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">상태:</span>
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                {(
                  ["all", "in_progress", "paused", "completed", "not_started"] as const
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition",
                      filterStatus === status
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {status === "all" ? "전체" : STATUS_CONFIG[status].label}
                    {status !== "all" && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({liveData.students.filter((s) => s.status === status).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 학생 목록 */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  학생 현황 ({filteredStudents.length})
                </h2>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">
                    해당 상태의 학생이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredStudents.map((student) => (
                    <StudentLiveRow key={student.studentId + student.campId} student={student} />
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

function LiveStatCard({
  label,
  value,
  icon: Icon,
  color,
  pulse,
}: {
  label: string;
  value: number;
  icon: typeof Play;
  color: "green" | "yellow" | "blue" | "gray";
  pulse?: boolean;
}) {
  const colorClasses = {
    green: {
      bg: "bg-green-50 border-green-200",
      icon: "bg-green-100 text-green-600",
      text: "text-green-600",
    },
    yellow: {
      bg: "bg-yellow-50 border-yellow-200",
      icon: "bg-yellow-100 text-yellow-600",
      text: "text-yellow-600",
    },
    blue: {
      bg: "bg-blue-50 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      text: "text-blue-600",
    },
    gray: {
      bg: "bg-gray-50 border-gray-200",
      icon: "bg-gray-100 text-gray-600",
      text: "text-gray-600",
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={cn("rounded-xl border p-5 shadow-sm", classes.bg)}>
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", classes.icon, pulse && "animate-pulse")}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className={cn("text-sm font-medium", classes.text)}>{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StudentLiveRow({ student }: { student: LiveStudentStatus }) {
  const config = STATUS_CONFIG[student.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "px-6 py-4 hover:bg-gray-50 transition",
        student.status === "in_progress" && "bg-green-50/30"
      )}
    >
      <div className="flex items-center gap-4">
        {/* 상태 아이콘 */}
        <div className={cn("rounded-lg p-2", config.bgColor)}>
          <StatusIcon className={cn("h-5 w-5", config.color)} />
        </div>

        {/* 학생 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/camp-students/${student.studentId}`}
              className="font-semibold text-gray-900 hover:text-indigo-600 hover:underline"
            >
              {student.studentName}
            </Link>
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-600">{student.campName}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                config.bgColor,
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-600">{student.contentTitle}</p>
        </div>

        {/* 시간 정보 */}
        <div className="flex items-center gap-6 text-sm">
          {student.status === "in_progress" && (
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">
                {formatDuration(student.elapsedMinutes)}
              </p>
              <p className="text-xs text-gray-500">진행 시간</p>
            </div>
          )}
          {student.status === "paused" && (
            <>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-700">
                  {formatDuration(student.elapsedMinutes)}
                </p>
                <p className="text-xs text-gray-500">학습 시간</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-600">
                  {formatDuration(student.pausedMinutes)}
                </p>
                <p className="text-xs text-gray-500">일시정지</p>
              </div>
            </>
          )}
          {student.status === "completed" && (
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600">
                {formatDuration(student.elapsedMinutes)}
              </p>
              <p className="text-xs text-gray-500">완료 시간</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-lg font-bold text-gray-700">
              {student.progressPercent}%
            </p>
            <p className="text-xs text-gray-500">진행률</p>
          </div>
        </div>

        {/* 상세 링크 */}
        <Link
          href={`/admin/camp-students/${student.studentId}`}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition"
        >
          상세
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
