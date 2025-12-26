"use client";

import { useMemo } from "react";
import {
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";

type TimelineEvent = {
  time: string;
  type: "start" | "complete" | "pause" | "resume";
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planId: string;
  contentTitle: string | null;
  studyDuration?: number;
};

type StudentProgress = {
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planGroupId: string;
  planGroupStatus: string;
  plans: Array<{
    planId: string;
    planDate: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    totalStudyTime: number;
    contentTitle: string | null;
  }>;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
    totalStudyTime: number;
  };
};

type PlanTimelineProps = {
  timeline: TimelineEvent[];
  students: StudentProgress[];
  selectedDate: string;
};

export function PlanTimeline({
  timeline,
  students,
  selectedDate,
}: PlanTimelineProps) {
  // 시간 포맷
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 학습 시간 포맷
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}시간 ${mins}분`;
    }
    return `${minutes}분 ${secs}초`;
  };

  // 이벤트 타입별 아이콘 및 색상
  const getEventStyle = (type: string) => {
    switch (type) {
      case "start":
        return {
          icon: PlayCircle,
          color: "text-blue-500",
          bgColor: "bg-blue-100",
          label: "시작",
        };
      case "complete":
        return {
          icon: CheckCircle2,
          color: "text-green-500",
          bgColor: "bg-green-100",
          label: "완료",
        };
      case "pause":
        return {
          icon: PauseCircle,
          color: "text-yellow-500",
          bgColor: "bg-yellow-100",
          label: "일시정지",
        };
      case "resume":
        return {
          icon: PlayCircle,
          color: "text-indigo-500",
          bgColor: "bg-indigo-100",
          label: "재개",
        };
      default:
        return {
          icon: Clock,
          color: "text-gray-500",
          bgColor: "bg-gray-100",
          label: type,
        };
    }
  };

  // 오늘 날짜의 학생별 현황
  const todayStudents = useMemo(() => {
    return students.filter((student) =>
      student.plans.some((p) => p.planDate === selectedDate)
    ).map((student) => {
      const todayPlans = student.plans.filter((p) => p.planDate === selectedDate);
      const completed = todayPlans.filter((p) => p.status === "completed").length;
      const inProgress = todayPlans.filter(
        (p) => p.status === "in_progress" || p.status === "paused"
      ).length;
      const notStarted = todayPlans.filter((p) => p.status === "not_started").length;

      return {
        ...student,
        todayPlans,
        todaySummary: { completed, inProgress, notStarted, total: todayPlans.length },
      };
    });
  }, [students, selectedDate]);

  const dateObj = new Date(selectedDate);
  const formattedDate = dateObj.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 타임라인 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="font-semibold text-gray-900">실시간 타임라인</h3>
          <p className="text-sm text-gray-500">{formattedDate}</p>
        </div>

        <div className="max-h-[500px] overflow-y-auto p-6">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">
                해당 날짜에 기록된 활동이 없습니다.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* 타임라인 선 */}
              <div className="absolute left-6 top-0 h-full w-0.5 bg-gray-200" />

              <div className="flex flex-col gap-4">
                {timeline.map((event, index) => {
                  const style = getEventStyle(event.type);
                  const Icon = style.icon;

                  return (
                    <div key={`${event.planId}-${event.type}-${index}`} className="relative flex gap-4 pl-12">
                      {/* 타임라인 마커 */}
                      <div
                        className={cn(
                          "absolute left-4 flex h-5 w-5 items-center justify-center rounded-full",
                          style.bgColor
                        )}
                      >
                        <Icon className={cn("h-3 w-3", style.color)} />
                      </div>

                      {/* 이벤트 내용 */}
                      <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {event.studentName}
                            </span>
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                              {event.campName}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatTime(event.time)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          <span
                            className={cn("font-medium", style.color)}
                          >
                            {style.label}
                          </span>
                          {event.contentTitle && (
                            <span className="text-gray-500">
                              {" "}
                              - {event.contentTitle}
                            </span>
                          )}
                        </p>
                        {event.studyDuration && (
                          <p className="mt-1 text-xs text-gray-400">
                            학습 시간: {formatDuration(event.studyDuration)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 오늘의 학생별 현황 */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="font-semibold text-gray-900">학생별 진행 현황</h3>
          <p className="text-sm text-gray-500">{formattedDate} 플랜</p>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {todayStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">
                해당 날짜에 플랜이 있는 학생이 없습니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayStudents.map((student) => (
                <div
                  key={`${student.studentId}-${student.campId}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {student.studentName}
                      </p>
                      <p className="text-sm text-gray-500">{student.campName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* 진행 상태 */}
                    <div className="flex items-center gap-2">
                      {student.todaySummary.completed > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {student.todaySummary.completed}
                        </span>
                      )}
                      {student.todaySummary.inProgress > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          <PlayCircle className="h-3 w-3" />
                          {student.todaySummary.inProgress}
                        </span>
                      )}
                      {student.todaySummary.notStarted > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          <Clock className="h-3 w-3" />
                          {student.todaySummary.notStarted}
                        </span>
                      )}
                    </div>

                    {/* 완료율 */}
                    <div className="w-16 text-right">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          student.todaySummary.completed ===
                            student.todaySummary.total
                            ? "text-green-600"
                            : "text-gray-600"
                        )}
                      >
                        {student.todaySummary.completed}/
                        {student.todaySummary.total}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
