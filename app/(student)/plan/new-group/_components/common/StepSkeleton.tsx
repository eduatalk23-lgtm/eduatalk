"use client";

/**
 * StepSkeleton - 단계 로딩 스켈레톤
 *
 * Phase 2 성능 최적화: 동적 임포트
 * Step 컴포넌트 로딩 중 표시되는 스켈레톤 UI
 */

import { UI } from "../constants/wizardConstants";

type StepSkeletonProps = {
  /** 스켈레톤 라인 수 (기본값: 5) */
  lines?: number;
  /** 제목 표시 여부 */
  showTitle?: boolean;
  /** 버튼 영역 표시 여부 */
  showButtons?: boolean;
};

/**
 * 스켈레톤 라인 컴포넌트
 */
function SkeletonLine({
  width = "100%",
  height = "h-4",
}: {
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${height}`}
      style={{ width }}
    />
  );
}

/**
 * StepSkeleton
 *
 * 동적 임포트된 Step 컴포넌트 로딩 중 표시되는 스켈레톤 UI
 */
export function StepSkeleton({
  lines = 5,
  showTitle = true,
  showButtons = true,
}: StepSkeletonProps) {
  return (
    <div className="space-y-6 p-4">
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
            <SkeletonLine width={`${70 + Math.random() * 30}%`} />
            <SkeletonLine width={`${50 + Math.random() * 40}%`} />
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

/**
 * 스켈레톤 카드 컴포넌트
 */
export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded bg-gray-200" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="70%" />
          <SkeletonLine width="50%" />
        </div>
      </div>
    </div>
  );
}

/**
 * 콘텐츠 선택 스켈레톤
 */
export function ContentSelectionSkeleton() {
  return (
    <div className="space-y-6">
      {/* 탭 스켈레톤 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
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
 * 스케줄 미리보기 스켈레톤
 */
export function SchedulePreviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <SkeletonLine width="200px" height="h-6" />
        <SkeletonLine width="100px" height="h-8" />
      </div>

      {/* 캘린더 스켈레톤 */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded bg-gray-200"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 최종 검토 스켈레톤
 */
export function FinalReviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* 요약 카드 스켈레톤 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 p-4"
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
