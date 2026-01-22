"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { updatePlanOrder } from "../actions/planOrderActions";
import { PlanTimerCard } from "./PlanTimerCard";
import { TodayPlanItem } from "./TodayPlanItem";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import type { PlanWithContent } from "../_utils/planGroupUtils";

type DraggablePlanListProps = {
  plans: PlanWithContent[];
  planDate: string;
  serverNow?: number;
  campMode?: boolean;
};

export function DraggablePlanList({ plans: initialPlans, planDate, serverNow = Date.now(), campMode = false }: DraggablePlanListProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [plans, setPlans] = useState(initialPlans);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 터치 드래그 상태
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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
        showToast("순서가 변경되었습니다.", "success");
      } else {
        // 실패 시 원래 상태로 복구
        setPlans(initialPlans);
        showToast(result.error || "플랜 순서 업데이트에 실패했습니다.", "error");
      }
      setDraggedIndex(null);
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 키보드로 아이템 이동
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= sortedPlans.length) return;
    if (isPending) return;

    const newPlans = [...sortedPlans];
    const [movedPlan] = newPlans.splice(fromIndex, 1);
    newPlans.splice(toIndex, 0, movedPlan);

    const updates = newPlans.map((plan, index) => ({
      planId: plan.id,
      newBlockIndex: index + 1,
    }));

    setPlans(newPlans.map((plan, index) => ({
      ...plan,
      block_index: index + 1,
    })));

    setFocusedIndex(toIndex);

    // 포커스 이동
    setTimeout(() => {
      itemRefs.current[toIndex]?.focus();
    }, 0);

    startTransition(async () => {
      const result = await updatePlanOrder(planDate, updates);
      if (result.success) {
        router.refresh();
        showToast("순서가 변경되었습니다.", "success");
      } else {
        setPlans(initialPlans);
        showToast(result.error || "플랜 순서 업데이트에 실패했습니다.", "error");
      }
    });
  }, [sortedPlans, isPending, planDate, initialPlans, router, showToast]);

  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, canMove: boolean) => {
    if (!canMove) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey || e.metaKey) {
          // Alt/Cmd + ArrowUp: 위로 이동
          moveItem(index, index - 1);
        } else {
          // ArrowUp: 이전 아이템으로 포커스 이동
          const prevIndex = Math.max(0, index - 1);
          itemRefs.current[prevIndex]?.focus();
          setFocusedIndex(prevIndex);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey || e.metaKey) {
          // Alt/Cmd + ArrowDown: 아래로 이동
          moveItem(index, index + 1);
        } else {
          // ArrowDown: 다음 아이템으로 포커스 이동
          const nextIndex = Math.min(sortedPlans.length - 1, index + 1);
          itemRefs.current[nextIndex]?.focus();
          setFocusedIndex(nextIndex);
        }
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        setDraggedIndex(draggedIndex === index ? null : index);
        break;
      case "Escape":
        e.preventDefault();
        setDraggedIndex(null);
        setFocusedIndex(null);
        break;
    }
  }, [moveItem, sortedPlans.length, draggedIndex]);

  // 터치 드래그 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    if (isPending) return;
    touchStartY.current = e.touches[0].clientY;
    setTouchDragIndex(index);
  }, [isPending]);

  const handleTouchMove = useCallback((e: React.TouchEvent, index: number) => {
    if (touchDragIndex === null || touchStartY.current === null) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // 50px 이상 이동시 위/아래로 재정렬
    if (Math.abs(deltaY) > 50) {
      if (deltaY < 0 && index > 0) {
        moveItem(index, index - 1);
        touchStartY.current = currentY;
      } else if (deltaY > 0 && index < sortedPlans.length - 1) {
        moveItem(index, index + 1);
        touchStartY.current = currentY;
      }
    }
  }, [touchDragIndex, moveItem, sortedPlans.length]);

  const handleTouchEnd = useCallback(() => {
    setTouchDragIndex(null);
    touchStartY.current = null;
  }, []);

  if (sortedPlans.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <div className="mx-auto flex flex-col gap-2 max-w-md">
          <div className="text-6xl">📚</div>
          <h3 className="text-lg font-semibold text-gray-900">
            오늘 배울 내용이 없습니다
          </h3>
          <p className="text-sm text-gray-500">
            학습 플랜을 생성해보세요.
          </p>
        </div>
      </div>
    );
  }

  const primaryPlanIds = (() => {
    const ids = new Set<string>();
    const seen = new Set<number>();
    sortedPlans.forEach((plan) => {
      if (plan.plan_number === null || plan.plan_number === undefined) {
        ids.add(plan.id);
        return;
      }
      if (!seen.has(plan.plan_number)) {
        ids.add(plan.id);
        seen.add(plan.plan_number);
      }
    });
    return ids;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="plan-list-label" className="text-lg font-semibold text-gray-900">선택 날짜 플랜</h2>
        <p id="drag-instructions" className="text-xs text-gray-500 hidden sm:block">
          ↑↓ 탐색 • Alt+↑↓ 이동
        </p>
      </div>
      <div
        ref={listRef}
        role="listbox"
        aria-labelledby="plan-list-label"
        aria-describedby="drag-instructions"
        aria-activedescendant={focusedIndex !== null ? `plan-item-${sortedPlans[focusedIndex]?.id}` : undefined}
        className="space-y-3"
      >
        {sortedPlans.map((plan, index) => {
          const isActive = !!plan.actual_start_time && !plan.actual_end_time;
          const isCompleted = !!plan.actual_end_time;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          // 활성 플랜이거나 완료된 플랜은 PlanTimerCard 사용
          const canDrag = !isActive && !isCompleted && !isPending;

          if (isActive || isCompleted) {
            return (
              <div
                key={plan.id}
                id={`plan-item-${plan.id}`}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="option"
                aria-selected={focusedIndex === index}
                aria-grabbed={isDragging}
                aria-label={`${plan.content?.title || "플랜"}, ${isActive ? "진행 중" : "완료됨"}, ${index + 1}번째`}
                tabIndex={canDrag ? 0 : -1}
                draggable={canDrag}
                onKeyDown={(e) => handleKeyDown(e, index, canDrag)}
                onDragStart={(e) => {
                  if (canDrag) {
                    handleDragStart(index);
                    e.dataTransfer.effectAllowed = "move";
                  } else {
                    e.preventDefault();
                  }
                }}
                onDragOver={(e) => {
                  if (canDrag) {
                    handleDragOver(e, index);
                  }
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  if (canDrag) {
                    handleDrop(e, index);
                  }
                }}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => canDrag && handleTouchStart(e, index)}
                onTouchMove={(e) => canDrag && handleTouchMove(e, index)}
                onTouchEnd={handleTouchEnd}
                className={cn(
                  "relative outline-none",
                  isDragging && "opacity-50",
                  isDragOver && "ring-2 ring-indigo-500 ring-offset-2",
                  focusedIndex === index && "ring-2 ring-indigo-400 ring-offset-1",
                  touchDragIndex === index && "scale-[1.02] shadow-lg"
                )}
              >
                <PlanTimerCard
                  planId={plan.id}
                  planTitle={plan.content?.title || "제목 없음"}
                  contentType={plan.content_type as "book" | "lecture" | "custom"}
                  startTime={null}
                  endTime={null}
                  actualStartTime={plan.actual_start_time}
                  actualEndTime={plan.actual_end_time}
                  totalDurationSeconds={plan.total_duration_seconds}
                  pausedDurationSeconds={plan.paused_duration_seconds}
                  pauseCount={plan.pause_count}
                  activeSessionId={plan.session ? plan.id : null}
                  isPaused={plan.session?.isPaused || false}
                  currentPausedAt={plan.session?.pausedAt ?? null}
                  allowTimerControl={primaryPlanIds.has(plan.id)}
                  sessionStartedAt={plan.session?.startedAt ?? null}
                  sessionPausedDurationSeconds={plan.session?.pausedDurationSeconds ?? null}
                  serverNow={serverNow}
                  campMode={campMode}
                />
              </div>
            );
          }

          // 대기 중인 플랜은 드래그 가능한 TodayPlanItem 사용
          const canMove = !isPending;
          const isTouchDragging = touchDragIndex === index;

          return (
            <div
              key={plan.id}
              id={`plan-item-${plan.id}`}
              ref={(el) => { itemRefs.current[index] = el; }}
              role="option"
              aria-selected={focusedIndex === index}
              aria-grabbed={isDragging}
              aria-dropeffect={isDragOver ? "move" : "none"}
              aria-label={`${plan.content?.title || "플랜"}, 대기 중, ${index + 1}번째, ${canMove ? "Alt+화살표로 순서 변경 가능" : "순서 변경 중"}`}
              tabIndex={0}
              draggable={canMove}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              onKeyDown={(e) => handleKeyDown(e, index, canMove)}
              onDragStart={(e) => {
                if (canMove) {
                  handleDragStart(index);
                  e.dataTransfer.effectAllowed = "move";
                } else {
                  e.preventDefault();
                }
              }}
              onDragOver={(e) => {
                if (canMove) {
                  handleDragOver(e, index);
                }
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                if (canMove) {
                  handleDrop(e, index);
                }
              }}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => canMove && handleTouchStart(e, index)}
              onTouchMove={(e) => canMove && handleTouchMove(e, index)}
              onTouchEnd={handleTouchEnd}
              className={cn(
                "relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all outline-none",
                isDragging && "opacity-50 cursor-grabbing",
                isDragOver && "ring-2 ring-indigo-500 ring-offset-2",
                !isPending && "hover:ring-1 hover:ring-gray-200 hover:shadow-md cursor-grab",
                focusedIndex === index && "ring-2 ring-indigo-400 ring-offset-1",
                isTouchDragging && "scale-[1.02] shadow-lg touch-none"
              )}
            >
              {/* 모바일용 순서 변경 버튼 */}
              <div className="flex flex-col gap-1 sm:hidden">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0 || isPending}
                  aria-label="위로 이동"
                  className={cn(
                    "p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition",
                    (index === 0 || isPending) && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === sortedPlans.length - 1 || isPending}
                  aria-label="아래로 이동"
                  className={cn(
                    "p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition",
                    (index === sortedPlans.length - 1 || isPending) && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1">
                <TodayPlanItem
                  plan={{
                    ...plan,
                    content: plan.content,
                    progress: plan.progress,
                  }}
                  campMode={campMode}
                />
              </div>
            </div>
          );
        })}
      </div>
      {isPending && (
        <div role="status" aria-live="polite" className="text-center text-sm text-gray-500">
          순서를 저장하는 중...
        </div>
      )}
      {/* 스크린 리더용 live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {draggedIndex !== null && `${sortedPlans[draggedIndex]?.content?.title || "플랜"} 선택됨`}
        {focusedIndex !== null && `${sortedPlans[focusedIndex]?.content?.title || "플랜"}, ${focusedIndex + 1}번째 항목`}
      </div>
    </div>
  );
}

