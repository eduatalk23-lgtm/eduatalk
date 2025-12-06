"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { pausePlan, resumePlan } from "@/app/(student)/today/actions/todayActions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buildPlanExecutionUrl } from "@/app/(student)/today/_utils/navigationUtils";

type ActivePlan = {
  id: string;
  title: string;
  contentType: "book" | "lecture" | "custom";
  actualStartTime: string;
  pausedDurationSeconds: number;
  pauseCount: number;
  isPaused: boolean;
};

type ActiveLearningWidgetProps = {
  activePlan: ActivePlan | null;
  campMode?: boolean;
};

export function ActiveLearningWidget({ activePlan: initialActivePlan, campMode = false }: ActiveLearningWidgetProps) {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState(initialActivePlan);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activePlan || activePlan.isPaused) {
      return;
    }

    const calculateElapsed = () => {
      const start = new Date(activePlan.actualStartTime);
      const now = new Date();
      const total = Math.floor((now.getTime() - start.getTime()) / 1000);
      const paused = activePlan.pausedDurationSeconds || 0;
      return Math.max(0, total - paused);
    };

    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [activePlan]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분 ${secs}초`;
  };

  const handlePause = async () => {
    if (!activePlan) return;
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || activePlan.isPaused) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await pausePlan(activePlan.id);
      if (result.success) {
        setActivePlan((prev) => prev ? { ...prev, isPaused: true } : null);
        router.refresh();
      } else {
        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          console.error("[ActiveLearningWidget] 일시정지 실패:", result.error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!activePlan) return;
    setIsLoading(true);
    try {
      const result = await resumePlan(activePlan.id);
      if (result.success) {
        setActivePlan((prev) => prev ? { ...prev, isPaused: false } : null);
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!activePlan) {
    return null;
  }

  const contentTypeIcon = {
    book: "📚",
    lecture: "🎧",
    custom: "📝",
  }[activePlan.contentType];

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h3 className="text-lg font-semibold text-gray-900">현재 학습 중</h3>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">{contentTypeIcon}</span>
          <h4 className="font-semibold text-gray-900">{activePlan.title}</h4>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="font-medium">학습 시간: {formatTime(elapsedSeconds)}</span>
          </div>
          {activePlan.pauseCount > 0 && (
            <div className="flex items-center gap-1">
              <Pause className="h-4 w-4" />
              <span>일시정지 {activePlan.pauseCount}회</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {activePlan.isPaused ? (
          <button
            onClick={handleResume}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            다시시작
          </button>
        ) : (
          <button
            onClick={handlePause}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
          >
            <Pause className="h-4 w-4" />
            일시정지
          </button>
        )}
        <Link
          href={buildPlanExecutionUrl(activePlan.id, campMode)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </Link>
      </div>
    </div>
  );
}

