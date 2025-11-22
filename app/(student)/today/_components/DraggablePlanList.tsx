"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { updatePlanOrder } from "../actions/planOrderActions";
import { PlanTimerCard } from "./PlanTimerCard";
import { TodayPlanItem } from "./TodayPlanItem";
import { cn } from "@/lib/cn";
import type { Plan } from "@/lib/data/studentPlans";
import type { Book, Lecture, CustomContent } from "@/lib/data/studentContents";

type PlanWithContent = Plan & {
  content?: Book | Lecture | CustomContent;
  progress?: number | null;
  session?: { isPaused: boolean };
};

type DraggablePlanListProps = {
  plans: PlanWithContent[];
  planDate: string;
};

export function DraggablePlanList({ plans: initialPlans, planDate }: DraggablePlanListProps) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // block_index 기준으로 정렬
  const sortedPlans = [...plans].sort((a, b) => {
    const aIndex = a.block_index ?? 0;
    const bIndex = b.block_index ?? 0;
    return aIndex - bIndex;
  });

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newPlans = [...sortedPlans];
    const [draggedPlan] = newPlans.splice(draggedIndex, 1);
    newPlans.splice(dropIndex, 0, draggedPlan);

    // 새로운 block_index 계산
    const updates = newPlans.map((plan, index) => ({
      planId: plan.id,
      newBlockIndex: index + 1,
    }));

    // UI 즉시 업데이트
    setPlans(newPlans.map((plan, index) => ({
      ...plan,
      block_index: index + 1,
    })));

    // 서버에 업데이트
    startTransition(async () => {
      const result = await updatePlanOrder(planDate, updates);
      if (result.success) {
        router.refresh();
      } else {
        // 실패 시 원래 상태로 복구
        setPlans(initialPlans);
        alert(result.error || "플랜 순서 업데이트에 실패했습니다.");
      }
      setDraggedIndex(null);
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (sortedPlans.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-4 text-6xl">📚</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            오늘 배울 내용이 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            자동 스케줄러를 실행해보세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">오늘 플랜</h2>
      <div className="space-y-3">
        {sortedPlans.map((plan, index) => {
          const isActive = !!plan.actual_start_time && !plan.actual_end_time;
          const isCompleted = !!plan.actual_end_time;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          // 활성 플랜이거나 완료된 플랜은 PlanTimerCard 사용
          if (isActive || isCompleted) {
            return (
              <div
                key={plan.id}
                draggable={!isActive && !isCompleted}
                onDragStart={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDragStart(index);
                    e.dataTransfer.effectAllowed = "move";
                  } else {
                    e.preventDefault();
                  }
                }}
                onDragOver={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDragOver(e, index);
                  }
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDrop(e, index);
                  }
                }}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative",
                  isDragging && "opacity-50",
                  isDragOver && "ring-2 ring-indigo-500 ring-offset-2"
                )}
              >
                <PlanTimerCard
                  planId={plan.id}
                  planTitle={plan.content?.title || "제목 없음"}
                  contentType={plan.content_type}
                  startTime={null}
                  endTime={null}
                  actualStartTime={plan.actual_start_time}
                  actualEndTime={plan.actual_end_time}
                  totalDurationSeconds={plan.total_duration_seconds}
                  pausedDurationSeconds={plan.paused_duration_seconds}
                  pauseCount={plan.pause_count}
                  activeSessionId={plan.session ? plan.id : null}
                  isPaused={plan.session?.isPaused || false}
                  currentPausedAt={plan.session ? (plan.session as any).pausedAt : null}
                />
              </div>
            );
          }

          // 대기 중인 플랜은 드래그 가능한 TodayPlanItem 사용
          return (
            <div
              key={plan.id}
              draggable={!isPending}
              onDragStart={(e) => {
                if (!isPending) {
                  handleDragStart(index);
                  e.dataTransfer.effectAllowed = "move";
                } else {
                  e.preventDefault();
                }
              }}
              onDragOver={(e) => {
                if (!isPending) {
                  handleDragOver(e, index);
                }
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                if (!isPending) {
                  handleDrop(e, index);
                }
              }}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition",
                isDragging && "opacity-50 cursor-grabbing",
                isDragOver && "ring-2 ring-indigo-500 ring-offset-2",
                !isPending && "hover:shadow-md cursor-grab"
              )}
            >
              <div
                className={cn(
                  "mt-1 text-gray-400 transition",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
              >
                <GripVertical className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <TodayPlanItem
                  plan={{
                    ...plan,
                    content: plan.content,
                    progress: plan.progress,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {isPending && (
        <div className="mt-2 text-center text-sm text-gray-500">
          순서를 저장하는 중...
        </div>
      )}
    </div>
  );
}

