"use client";

/**
 * StreamingProgress - AI 생성 스트리밍 진행률 표시
 *
 * 실시간으로 AI 생성 진행 상황을 표시합니다.
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { Loader2, CheckCircle2, XCircle, Sparkles, Database, Brain, FileCheck } from "lucide-react";
import type { GenerationPhase } from "./hooks/useStreamingGeneration";

export interface StreamingProgressProps {
  /** 현재 단계 */
  phase: GenerationPhase;
  /** 진행률 (0-100) */
  progress: number;
  /** 현재 메시지 */
  message: string;
  /** 스트리밍된 텍스트 (선택) */
  streamedText?: string;
  /** 추가 클래스 */
  className?: string;
}

const PHASE_CONFIG: Record<
  GenerationPhase,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  idle: {
    label: "대기 중",
    icon: <Sparkles className="h-5 w-5" />,
    color: "text-gray-400",
  },
  starting: {
    label: "시작 중",
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
    color: "text-blue-500",
  },
  fetching: {
    label: "데이터 로딩",
    icon: <Database className="h-5 w-5 animate-pulse" />,
    color: "text-blue-500",
  },
  generating: {
    label: "AI 생성 중",
    icon: <Brain className="h-5 w-5 animate-pulse" />,
    color: "text-purple-500",
  },
  parsing: {
    label: "결과 분석",
    icon: <FileCheck className="h-5 w-5 animate-pulse" />,
    color: "text-indigo-500",
  },
  complete: {
    label: "완료",
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-green-500",
  },
  error: {
    label: "오류",
    icon: <XCircle className="h-5 w-5" />,
    color: "text-red-500",
  },
};

const STEPS: GenerationPhase[] = ["starting", "fetching", "generating", "parsing", "complete"];

export function StreamingProgress({
  phase,
  progress,
  message,
  streamedText,
  className,
}: StreamingProgressProps) {
  const config = PHASE_CONFIG[phase];
  const currentStepIndex = STEPS.indexOf(phase);

  return (
    <div className={cn("space-y-6", className)}>
      {/* 진행률 바 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-2", config.color)}>
            {config.icon}
            <span className="font-medium">{config.label}</span>
          </div>
          <span className={cn("text-sm", textMuted)}>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              phase === "error"
                ? "bg-red-500"
                : phase === "complete"
                  ? "bg-green-500"
                  : "bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between">
        {STEPS.slice(0, -1).map((step, index) => {
          const stepConfig = PHASE_CONFIG[step];
          const isActive = step === phase;
          const isCompleted = currentStepIndex > index;
          const isPending = currentStepIndex < index;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  isActive && "border-purple-500 bg-purple-50 text-purple-500 dark:bg-purple-900/20",
                  isPending && "border-gray-300 text-gray-400 dark:border-gray-600"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              {index < STEPS.length - 2 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 transition-colors",
                    isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 현재 메시지 */}
      <div className={cn("text-center text-sm", textSecondary)}>
        {message}
      </div>

      {/* 스트리밍 텍스트 미리보기 (선택) */}
      {streamedText && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-800">
          <pre className={cn("whitespace-pre-wrap", textMuted)}>
            {streamedText.slice(-500)}
            <span className="animate-pulse">▌</span>
          </pre>
        </div>
      )}

      {/* AI 생성 애니메이션 */}
      {(phase === "generating" || phase === "parsing") && (
        <div className="flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-purple-500"
              style={{
                animation: `pulse 1.5s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
