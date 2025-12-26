"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { studentCampProfileQueryOptions } from "@/lib/query-options/multiCampStats";
import type { CampParticipation } from "@/app/api/admin/camps/students/[studentId]/route";

type StudentCampProfileViewProps = {
  studentId: string;
};

export function StudentCampProfileView({ studentId }: StudentCampProfileViewProps) {
  const {
    data: profile,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery(studentCampProfileQueryOptions(studentId));

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-gray-500">프로필을 불러오는 중...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-800">{error.message}</p>
          <Link
            href="/admin/camp-alerts"
            className="mt-4 inline-flex items-center gap-2 text-sm text-red-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Link>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <User className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">학생 정보를 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/camp-alerts"
              className="rounded-lg border border-gray-300 bg-white p-2 hover:bg-gray-50 transition"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <p className="text-sm font-medium text-gray-500">학생 통합 프로필</p>
              <h1 className="text-3xl font-semibold text-gray-900">
                {profile.studentName}
              </h1>
            </div>
          </div>
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
        </div>

        {/* 전체 통계 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="총 캠프"
            value={profile.overallStats.totalCamps}
            icon={Calendar}
            color="gray"
          />
          <StatCard
            label="진행 중"
            value={profile.overallStats.activeCamps}
            icon={BookOpen}
            color="indigo"
          />
          <StatCard
            label="완료"
            value={profile.overallStats.completedCamps}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            label="출석률"
            value={`${profile.overallStats.overallAttendanceRate}%`}
            icon={TrendingUp}
            color="blue"
          />
          <StatCard
            label="완료율"
            value={`${profile.overallStats.overallCompletionRate}%`}
            icon={CheckCircle2}
            color="purple"
          />
          <StatCard
            label="총 학습"
            value={formatDuration(profile.overallStats.totalStudyMinutes)}
            icon={Clock}
            color="orange"
          />
        </div>

        {/* 캠프 참여 목록 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              캠프 참여 현황 ({profile.participations.length})
            </h2>
          </div>

          {profile.participations.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">참여 중인 캠프가 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {profile.participations.map((participation) => (
                <CampParticipationCard
                  key={participation.campId}
                  participation={participation}
                />
              ))}
            </div>
          )}
        </div>

        {/* 최근 활동 타임라인 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              최근 활동 타임라인
            </h2>
          </div>

          {profile.timeline.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">최근 활동 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="relative border-l-2 border-gray-200 pl-6">
                {profile.timeline.map((day, idx) => (
                  <div key={day.date} className="mb-6 last:mb-0">
                    <div className="absolute -left-2 h-4 w-4 rounded-full border-2 border-gray-300 bg-white" />
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(day.date).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </p>
                    <div className="mt-2 space-y-2">
                      {day.events.map((event, eventIdx) => (
                        <div
                          key={`${event.campId}-${event.type}-${eventIdx}`}
                          className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2"
                        >
                          {event.type === "attendance" && (
                            <CheckCircle2
                              className={cn(
                                "h-4 w-4",
                                event.status === "present" && "text-green-500",
                                event.status === "late" && "text-yellow-500",
                                event.status === "absent" && "text-red-500"
                              )}
                            />
                          )}
                          {event.type === "plan_start" && (
                            <BookOpen className="h-4 w-4 text-blue-500" />
                          )}
                          {event.type === "plan_complete" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-sm text-gray-700">
                            <span className="font-medium">{event.campName}</span>
                            {" - "}
                            {event.type === "attendance" && `출석 (${getStatusLabel(event.status || "")})`}
                            {event.type === "plan_start" && "플랜 시작"}
                            {event.type === "plan_complete" && "플랜 완료"}
                          </span>
                          {event.time && (
                            <span className="text-xs text-gray-400">
                              {formatTime(event.time)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof User;
  color: "gray" | "indigo" | "green" | "blue" | "purple" | "orange";
}) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-600",
    indigo: "bg-indigo-100 text-indigo-600",
    green: "bg-green-100 text-green-600",
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", colorClasses[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CampParticipationCard({
  participation,
}: {
  participation: CampParticipation;
}) {
  const statusConfig = {
    active: { label: "진행 중", color: "bg-green-100 text-green-700" },
    draft: { label: "준비 중", color: "bg-gray-100 text-gray-700" },
    archived: { label: "종료", color: "bg-gray-100 text-gray-500" },
  };

  const campStatusConfig = statusConfig[participation.campStatus as keyof typeof statusConfig] || {
    label: participation.campStatus,
    color: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* 캠프 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900">
              {participation.campName}
            </h3>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                campStatusConfig.color
              )}
            >
              {campStatusConfig.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {participation.startDate} ~ {participation.endDate}
          </p>

          {/* 알림 */}
          {participation.alerts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {participation.alerts.map((alert, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                    alert.severity === "critical" && "bg-red-100 text-red-700",
                    alert.severity === "warning" && "bg-yellow-100 text-yellow-700"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {alert.message}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 통계 */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {participation.stats.attendanceRate}%
            </p>
            <p className="text-xs text-gray-500">출석률</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {participation.stats.planCompletionRate}%
            </p>
            <p className="text-xs text-gray-500">완료율</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">
              {participation.stats.completedPlans}/{participation.stats.totalPlans}
            </p>
            <p className="text-xs text-gray-500">플랜</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-600">
              {formatDuration(participation.stats.totalStudyMinutes)}
            </p>
            <p className="text-xs text-gray-500">학습시간</p>
          </div>
        </div>

        {/* 상세 링크 */}
        <Link
          href={`/admin/camp-templates/${participation.campId}/participants`}
          className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition"
        >
          캠프 보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 최근 활동 (간략) */}
      {participation.recentActivity.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">최근 활동</p>
          <div className="flex flex-wrap gap-2">
            {participation.recentActivity.slice(0, 5).map((activity, idx) => (
              <span
                key={idx}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                  activity.type === "attendance" && activity.status === "present" && "bg-green-50 text-green-700",
                  activity.type === "attendance" && activity.status === "late" && "bg-yellow-50 text-yellow-700",
                  activity.type === "attendance" && activity.status === "absent" && "bg-red-50 text-red-700",
                  activity.type === "plan" && activity.status === "completed" && "bg-indigo-50 text-indigo-700",
                  activity.type === "plan" && activity.status !== "completed" && "bg-gray-50 text-gray-700"
                )}
              >
                {activity.type === "attendance" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <BookOpen className="h-3 w-3" />
                )}
                {activity.date}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    present: "출석",
    late: "지각",
    absent: "결석",
    excused: "허가",
  };
  return labels[status] || status;
}
