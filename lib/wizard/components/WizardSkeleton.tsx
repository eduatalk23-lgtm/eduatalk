"use client";

/**
 * WizardSkeleton - 통합 위저드 스켈레톤
 *
 * 위저드 단계 로딩 중 표시되는 스켈레톤 UI 컴포넌트
 *
 * @module lib/wizard/components/WizardSkeleton
 */

import { cn } from "@/lib/cn";

// ============================================
// 기본 스켈레톤 라인
// ============================================

export interface SkeletonLineProps {
  /** 너비 (CSS 값) */
  width?: string;
  /** 높이 클래스 */
  height?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * SkeletonLine
 *
 * 기본 스켈레톤 라인 컴포넌트
 */
export function SkeletonLine({
  width = "100%",
  height = "h-4",
  className,
}: SkeletonLineProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-200 dark:bg-gray-700",
        height,
        className
      )}
      style={{ width }}
      aria-hidden="true"
    />
  );
}

// ============================================
// 스켈레톤 카드
// ============================================

export interface SkeletonCardProps {
  /** 추가 클래스명 */
  className?: string;
}

/**
 * SkeletonCard
 *
 * 스켈레톤 카드 컴포넌트
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="70%" />
          <SkeletonLine width="50%" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// 위저드 스텝 스켈레톤
// ============================================

export interface WizardStepSkeletonProps {
  /** 스켈레톤 라인 수 */
  lines?: number;
  /** 제목 표시 여부 */
  showTitle?: boolean;
  /** 버튼 영역 표시 여부 */
  showButtons?: boolean;
  /** 단계 레이블 (접근성용) */
  stepLabel?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * WizardStepSkeleton
 *
 * 위저드 단계 로딩 스켈레톤
 */
export function WizardStepSkeleton({
  lines = 5,
  showTitle = true,
  showButtons = true,
  stepLabel = "콘텐츠",
  className,
}: WizardStepSkeletonProps) {
  return (
    <div
      className={cn("space-y-6 p-4", className)}
      role="status"
      aria-busy="true"
      aria-label={`${stepLabel} 로딩 중`}
    >
      {/* 스크린 리더용 로딩 메시지 */}
      <span className="sr-only">{stepLabel} 화면을 불러오는 중입니다...</span>

      {/* 제목 스켈레톤 */}
      {showTitle && (
        <div className="space-y-2">
          <SkeletonLine width="40%" height="h-8" />
          <SkeletonLine width="60%" height="h-4" />
        </div>
      )}

      {/* 컨텐츠 스켈레톤 */}
      <div className="space-y-4">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonLine width={`${70 + index * 5}%`} />
            <SkeletonLine width={`${50 + index * 8}%`} />
          </div>
        ))}
      </div>

      {/* 입력 필드 스켈레톤 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <SkeletonLine width="30%" height="h-4" />
          <SkeletonLine width="100%" height="h-10" />
        </div>
        <div className="space-y-2">
          <SkeletonLine width="25%" height="h-4" />
          <SkeletonLine width="100%" height="h-10" />
        </div>
      </div>

      {/* 버튼 스켈레톤 */}
      {showButtons && (
        <div className="flex justify-end gap-3 pt-4">
          <SkeletonLine width="80px" height="h-10" />
          <SkeletonLine width="100px" height="h-10" />
        </div>
      )}
    </div>
  );
}

// ============================================
// 특화된 스켈레톤 컴포넌트들
// ============================================

/**
 * FormSkeleton
 *
 * 폼 입력 스켈레톤
 */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="폼 로딩 중"
    >
      <span className="sr-only">폼을 불러오는 중입니다...</span>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <SkeletonLine width="30%" height="h-4" />
          <SkeletonLine width="100%" height="h-10" />
        </div>
      ))}
    </div>
  );
}

/**
 * ContentSelectionSkeleton
 *
 * 콘텐츠 선택 스켈레톤
 */
export function ContentSelectionSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="콘텐츠 선택 화면 로딩 중"
    >
      <span className="sr-only">콘텐츠 선택 화면을 불러오는 중입니다...</span>

      {/* 탭 스켈레톤 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        {[1, 2, 3].map((i) => (
          <SkeletonLine key={i} width="80px" height="h-8" />
        ))}
      </div>

      {/* 콘텐츠 카드 스켈레톤 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * SchedulePreviewSkeleton
 *
 * 스케줄 미리보기 스켈레톤
 */
export function SchedulePreviewSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="스케줄 미리보기 로딩 중"
    >
      <span className="sr-only">스케줄 미리보기를 불러오는 중입니다...</span>

      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <SkeletonLine width="200px" height="h-6" />
        <SkeletonLine width="100px" height="h-8" />
      </div>

      {/* 캘린더 스켈레톤 */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * SummarySkeleton
 *
 * 요약/확인 화면 스켈레톤
 */
export function SummarySkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="요약 화면 로딩 중"
    >
      <span className="sr-only">요약 화면을 불러오는 중입니다...</span>

      {/* 요약 카드 스켈레톤 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            aria-hidden="true"
          >
            <SkeletonLine width="60%" height="h-4" />
            <div className="mt-2">
              <SkeletonLine width="80%" height="h-8" />
            </div>
          </div>
        ))}
      </div>

      {/* 상세 정보 스켈레톤 */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine width="30%" height="h-5" />
            <SkeletonLine width="90%" />
            <SkeletonLine width="70%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ResultSkeleton
 *
 * 결과 화면 스켈레톤
 */
export function ResultSkeleton() {
  return (
    <div
      className="space-y-6 p-4"
      role="status"
      aria-busy="true"
      aria-label="결과 화면 로딩 중"
    >
      <span className="sr-only">결과를 불러오는 중입니다...</span>

      {/* 성공 아이콘 스켈레톤 */}
      <div className="flex justify-center">
        <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* 제목 스켈레톤 */}
      <div className="flex flex-col items-center space-y-2">
        <SkeletonLine width="60%" height="h-8" />
        <SkeletonLine width="80%" height="h-4" />
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            aria-hidden="true"
          >
            <SkeletonLine width="40%" height="h-4" />
            <div className="mt-2">
              <SkeletonLine width="70%" height="h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div className="flex justify-center gap-3 pt-4">
        <SkeletonLine width="120px" height="h-10" />
        <SkeletonLine width="100px" height="h-10" />
      </div>
    </div>
  );
}
