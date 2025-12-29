"use client";

import { EmptyState, EmptyStateProps } from "@/components/molecules/EmptyState";
import { BookOpen, Calendar, Clock, Target, FileText, Layers } from "lucide-react";

/**
 * 플랜 모듈 빈 상태 프리셋
 *
 * 일관된 메시지와 액션을 제공하여 사용자 경험을 통일합니다.
 */

type PresetType =
  | "planGroup"
  | "planList"
  | "content"
  | "schedule"
  | "blockSet"
  | "exclusion"
  | "academy"
  | "stats";

type EmptyStatePreset = Omit<EmptyStateProps, "className" | "headingLevel">;

const PRESETS: Record<PresetType, EmptyStatePreset> = {
  planGroup: {
    icon: <Layers className="h-12 w-12 text-gray-400" />,
    title: "등록된 플랜 그룹이 없습니다",
    description: "새로운 플랜 그룹을 만들어 기간별 학습 계획을 세워보세요.",
    actionLabel: "플랜 그룹 만들기",
    actionHref: "/plan/new-group",
  },
  planList: {
    icon: <FileText className="h-12 w-12 text-gray-400" />,
    title: "등록된 플랜이 없습니다",
    description: "이 그룹에 아직 학습 플랜이 없습니다. 콘텐츠를 추가하여 플랜을 생성하세요.",
    actionLabel: "콘텐츠 추가하기",
  },
  content: {
    icon: <BookOpen className="h-12 w-12 text-gray-400" />,
    title: "등록된 콘텐츠가 없습니다",
    description: "학습할 교재, 강의, 또는 커스텀 콘텐츠를 먼저 등록해주세요.",
    actionLabel: "콘텐츠 등록하기",
    actionHref: "/content",
  },
  schedule: {
    icon: <Calendar className="h-12 w-12 text-gray-400" />,
    title: "표시할 스케줄이 없습니다",
    description: "학습 기간과 요일을 설정하면 스케줄이 자동으로 생성됩니다.",
  },
  blockSet: {
    icon: <Clock className="h-12 w-12 text-gray-400" />,
    title: "등록된 블록 세트가 없습니다",
    description: "학습 가능한 시간대를 정의하는 블록 세트를 만들어보세요.",
    actionLabel: "블록 세트 만들기",
  },
  exclusion: {
    icon: <Calendar className="h-12 w-12 text-gray-400" />,
    title: "등록된 제외일이 없습니다",
    description: "시험, 여행 등 학습이 어려운 날을 제외일로 설정할 수 있습니다.",
  },
  academy: {
    icon: <Clock className="h-12 w-12 text-gray-400" />,
    title: "등록된 학원 일정이 없습니다",
    description: "학원 일정을 등록하면 해당 시간은 자동으로 제외됩니다.",
  },
  stats: {
    icon: <Target className="h-12 w-12 text-gray-400" />,
    title: "아직 학습 데이터가 없습니다",
    description: "플랜을 완료하면 여기에서 학습 통계를 확인할 수 있습니다.",
    actionLabel: "오늘 할 일 보기",
    actionHref: "/today",
  },
};

type PlanEmptyStateProps = {
  /** 프리셋 타입 */
  preset: PresetType;
  /** 프리셋 값 오버라이드 */
  overrides?: Partial<EmptyStatePreset>;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 액션 클릭 핸들러 (actionHref보다 우선) */
  onAction?: () => void;
};

/**
 * 플랜 모듈용 통합 빈 상태 컴포넌트
 *
 * @example
 * ```tsx
 * <PlanEmptyState preset="planGroup" />
 * <PlanEmptyState preset="content" compact />
 * <PlanEmptyState
 *   preset="planList"
 *   overrides={{ actionLabel: "콘텐츠 추가" }}
 *   onAction={() => setShowModal(true)}
 * />
 * ```
 */
export function PlanEmptyState({
  preset,
  overrides,
  compact = false,
  className,
  onAction,
}: PlanEmptyStateProps) {
  const presetConfig = PRESETS[preset];

  return (
    <EmptyState
      icon={overrides?.icon ?? presetConfig.icon}
      title={overrides?.title ?? presetConfig.title}
      description={overrides?.description ?? presetConfig.description}
      actionLabel={overrides?.actionLabel ?? presetConfig.actionLabel}
      actionHref={onAction ? undefined : (overrides?.actionHref ?? presetConfig.actionHref)}
      onAction={onAction ?? overrides?.onAction}
      variant={compact ? "compact" : "default"}
      className={className}
    />
  );
}

/**
 * 인라인 빈 상태 (간단한 텍스트만)
 */
type InlineEmptyStateProps = {
  message: string;
  className?: string;
};

export function InlineEmptyState({ message, className }: InlineEmptyStateProps) {
  return (
    <div
      className={`
        rounded-lg border border-dashed border-gray-300
        bg-gray-50 p-4 text-center text-sm text-gray-500
        dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400
        ${className ?? ""}
      `}
    >
      {message}
    </div>
  );
}
