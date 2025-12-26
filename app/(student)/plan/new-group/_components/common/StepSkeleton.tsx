"use client";

/**
 * StepSkeleton - 단계 로딩 스켈레톤
 *
 * Phase 2 성능 최적화: 동적 임포트
 * Phase 4 UX 개선: 접근성 및 다크모드 지원
 *
 * Step 컴포넌트 로딩 중 표시되는 스켈레톤 UI
 */

import type { WizardStep } from "../PlanGroupWizard";

type StepSkeletonProps = {
  /** 스켈레톤 라인 수 (기본값: 5) */
  lines?: number;
  /** 제목 표시 여부 */
  showTitle?: boolean;
  /** 버튼 영역 표시 여부 */
  showButtons?: boolean;
  /** 단계 번호 (접근성용) */
  step?: WizardStep;
};

/**
 * 단계별 레이블 (스크린 리더용)
 */
const STEP_LABELS: Record<number, string> = {
  1: "기본 정보 입력",
  2: "시간 설정",
  3: "콘텐츠 선택",
  4: "스케줄 미리보기",
  5: "학습 범위 점검",
  6: "최종 확인",
  7: "플랜 생성 완료",
};

/**
 * 스켈레톤 라인 컴포넌트
 *
 * Phase 4: 다크모드 지원 추가
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
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${height}`}
      style={{ width }}
      aria-hidden="true"
    />
  );
}

/**
 * StepSkeleton
 *
 * 동적 임포트된 Step 컴포넌트 로딩 중 표시되는 스켈레톤 UI
 * Phase 4: 접근성 속성 추가 (aria-busy, aria-label, sr-only)
 */
export function StepSkeleton({
  lines = 5,
  showTitle = true,
  showButtons = true,
  step,
}: StepSkeletonProps) {
  const stepLabel = step ? STEP_LABELS[step] : "콘텐츠";

  return (
    <div
      className="space-y-6 p-4"
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

/**
 * 스켈레톤 카드 컴포넌트
 *
 * Phase 4: 다크모드 지원
 */
export function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700"
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

/**
 * 콘텐츠 선택 스켈레톤 (Step 3용)
 *
 * Phase 4: 접근성 및 다크모드 지원
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
 * 스케줄 미리보기 스켈레톤 (Step 4용)
 *
 * Phase 4: 접근성 및 다크모드 지원
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
 * 최종 검토 스켈레톤 (Step 6용)
 *
 * Phase 4: 접근성 및 다크모드 지원
 */
export function FinalReviewSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="최종 확인 화면 로딩 중"
    >
      <span className="sr-only">최종 확인 화면을 불러오는 중입니다...</span>

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
 * Step 1 기본 정보 스켈레톤
 */
export function Step1Skeleton() {
  return (
    <StepSkeleton step={1} lines={3} />
  );
}

/**
 * Step 2 시간 설정 스켈레톤
 */
export function Step2Skeleton() {
  return (
    <div
      className="space-y-6 p-4"
      role="status"
      aria-busy="true"
      aria-label="시간 설정 화면 로딩 중"
    >
      <span className="sr-only">시간 설정 화면을 불러오는 중입니다...</span>

      {/* 기간 설정 스켈레톤 */}
      <div className="space-y-4">
        <SkeletonLine width="30%" height="h-6" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <SkeletonLine width="40%" height="h-4" />
            <SkeletonLine width="100%" height="h-10" />
          </div>
          <div className="space-y-2">
            <SkeletonLine width="40%" height="h-4" />
            <SkeletonLine width="100%" height="h-10" />
          </div>
        </div>
      </div>

      {/* 학습 주기 스켈레톤 */}
      <div className="space-y-4">
        <SkeletonLine width="25%" height="h-6" />
        <div className="flex gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 space-y-2">
              <SkeletonLine width="60%" height="h-4" />
              <SkeletonLine width="100%" height="h-10" />
            </div>
          ))}
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-4">
        <SkeletonLine width="80px" height="h-10" />
        <SkeletonLine width="100px" height="h-10" />
      </div>
    </div>
  );
}

/**
 * Step 7 플랜 생성 완료 스켈레톤
 */
export function Step7Skeleton() {
  return (
    <div
      className="space-y-6 p-4"
      role="status"
      aria-busy="true"
      aria-label="플랜 생성 완료 화면 로딩 중"
    >
      <span className="sr-only">플랜 생성 결과를 불러오는 중입니다...</span>

      {/* 성공 아이콘 스켈레톤 */}
      <div className="flex justify-center">
        <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* 제목 스켈레톤 */}
      <div className="space-y-2 text-center">
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
