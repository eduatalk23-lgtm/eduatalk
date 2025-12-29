"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Zap, BookPlus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface PlanCreationMode {
  id: "full" | "content" | "quick";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  estimatedTime: string;
  href: string;
  color: string;
}

const MODES: PlanCreationMode[] = [
  {
    id: "full",
    title: "전체 플랜 생성",
    description: "블록세트, 제외일, 콘텐츠까지 완벽하게 설정하는 7단계 위저드",
    icon: CalendarDays,
    estimatedTime: "5-10분",
    href: "/plan/new-group",
    color: "blue",
  },
  {
    id: "quick",
    title: "빠른 생성",
    description: "오늘 할 일을 빠르게 추가하는 3단계 위저드",
    icon: Zap,
    estimatedTime: "30초",
    href: "/plan/quick-create",
    color: "green",
  },
  {
    id: "content",
    title: "콘텐츠로 플랜 추가",
    description: "기존 플랜 템플릿에 새 콘텐츠를 추가하는 4단계 위저드",
    icon: BookPlus,
    estimatedTime: "1-2분",
    href: "/plan",
    color: "purple",
  },
];

interface ModeSelectorProps {
  defaultMode?: "full" | "content" | "quick";
}

export function ModeSelector({ defaultMode }: ModeSelectorProps) {
  const router = useRouter();

  const handleSelect = (mode: PlanCreationMode) => {
    router.push(mode.href);
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          어떤 방식으로 플랜을 만들까요?
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          상황에 맞는 플랜 생성 방식을 선택하세요
        </p>
      </div>

      <div className="grid gap-4">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isRecommended = mode.id === "quick";

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleSelect(mode)}
              className={cn(
                "relative flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all",
                "hover:border-blue-500 hover:shadow-md",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                defaultMode === mode.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2 right-4 rounded-full bg-green-500 px-2 py-0.5 text-xs font-medium text-white">
                  추천
                </span>
              )}

              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                  mode.color === "blue" && "bg-blue-100 dark:bg-blue-900/50",
                  mode.color === "green" && "bg-green-100 dark:bg-green-900/50",
                  mode.color === "purple" && "bg-purple-100 dark:bg-purple-900/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    mode.color === "blue" && "text-blue-600 dark:text-blue-400",
                    mode.color === "green" && "text-green-600 dark:text-green-400",
                    mode.color === "purple" && "text-purple-600 dark:text-purple-400"
                  )}
                />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {mode.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {mode.description}
                </p>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  예상 소요 시간: {mode.estimatedTime}
                </p>
              </div>

              <ChevronRight className="h-5 w-5 shrink-0 self-center text-gray-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
