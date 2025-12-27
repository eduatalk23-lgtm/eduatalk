"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { Flame, Check, Minus, Plus, MoreVertical, Pencil, Trash2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { checkInHabit, uncheckHabit, updateHabit, deleteHabit } from "@/lib/domains/habit";
import type { HabitWithLogs } from "@/lib/domains/habit/types";

interface HabitCardProps {
  habit: HabitWithLogs;
  today: string;
  onEdit?: (habit: HabitWithLogs) => void;
}

export function HabitCard({ habit, today, onEdit }: HabitCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);

  const todayLog = habit.todayLog;
  const completedCount = todayLog?.completedCount ?? 0;
  const isCompleted = completedCount >= habit.targetCount;
  const progress = Math.min(completedCount / habit.targetCount, 1);

  // Dynamic icon component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[habit.icon] || Icons.Check;

  const handleCheckIn = () => {
    startTransition(async () => {
      const result = await checkInHabit({
        habitId: habit.id,
        logDate: today,
      });

      if (result.success) {
        if (result.data?.isCompleted && !isCompleted) {
          showToast(`"${habit.title}" 완료!`, "success");
        }
        router.refresh();
      } else {
        showToast(result.error || "체크인 실패", "error");
      }
    });
  };

  const handleUncheck = () => {
    if (completedCount === 0) return;

    startTransition(async () => {
      const result = await uncheckHabit(habit.id, today);

      if (result.success) {
        router.refresh();
      } else {
        showToast(result.error || "체크인 취소 실패", "error");
      }
    });
  };

  const handlePause = () => {
    startTransition(async () => {
      const result = await updateHabit(habit.id, {
        status: habit.status === "paused" ? "active" : "paused",
      });

      if (result.success) {
        showToast(
          habit.status === "paused" ? "습관을 재개했습니다." : "습관을 일시정지했습니다.",
          "success"
        );
        router.refresh();
      } else {
        showToast(result.error || "상태 변경 실패", "error");
      }
    });
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (!confirm("이 습관을 삭제하시겠습니까? 모든 기록이 함께 삭제됩니다.")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteHabit(habit.id);

      if (result.success) {
        showToast("습관이 삭제되었습니다.", "success");
        router.refresh();
      } else {
        showToast(result.error || "삭제 실패", "error");
      }
    });
    setShowMenu(false);
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white p-4 shadow-sm transition-all",
        isCompleted && "bg-green-50 border-green-200",
        habit.status === "paused" && "opacity-60",
        isPending && "opacity-50 pointer-events-none"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              isCompleted ? "bg-green-100" : "bg-gray-100"
            )}
            style={{ backgroundColor: isCompleted ? undefined : `${habit.color}20` }}
          >
            <IconComponent
              className="w-5 h-5"
              style={{ color: isCompleted ? "#22C55E" : habit.color }}
            />
          </div>

          {/* Title & Streak */}
          <div>
            <h3 className="font-medium text-gray-900">{habit.title}</h3>
            {habit.currentStreak > 0 && (
              <div className="flex items-center gap-1 text-xs text-orange-500">
                <Flame className="w-3 h-3" />
                <span>{habit.currentStreak}일 연속</span>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border rounded-lg shadow-lg py-1 min-w-[120px]">
                <button
                  onClick={() => {
                    onEdit?.(habit);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" />
                  수정
                </button>
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50"
                >
                  {habit.status === "paused" ? (
                    <>
                      <Play className="w-4 h-4" />
                      재개
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      일시정지
                    </>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 rounded-full bg-gray-100 mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: isCompleted ? "#22C55E" : habit.color,
          }}
        />
      </div>

      {/* Counter & Actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {completedCount} / {habit.targetCount}회
        </span>

        <div className="flex items-center gap-2">
          {habit.targetCount > 1 && (
            <button
              onClick={handleUncheck}
              disabled={completedCount === 0 || isPending}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                completedCount > 0
                  ? "bg-gray-100 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
              )}
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleCheckIn}
            disabled={isPending}
            className={cn(
              "flex items-center justify-center gap-1 px-4 py-2 rounded-full font-medium text-sm transition-all",
              isCompleted
                ? "bg-green-500 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            )}
          >
            {isCompleted ? (
              <>
                <Check className="w-4 h-4" />
                완료
              </>
            ) : habit.targetCount > 1 ? (
              <>
                <Plus className="w-4 h-4" />
                추가
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                체크
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
