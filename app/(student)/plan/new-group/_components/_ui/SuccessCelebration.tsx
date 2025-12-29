"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Calendar, BookOpen, ArrowRight, Sparkles } from "lucide-react";

type SuccessCelebrationProps = {
  /** 플랜 그룹 ID */
  groupId: string;
  /** 플랜 이름 */
  planName: string;
  /** 생성된 플랜 개수 */
  planCount?: number;
  /** 학습 기간 (예: "1월 1일 ~ 1월 31일") */
  periodLabel?: string;
  /** 캠프 모드 여부 */
  isCampMode?: boolean;
  /** 콜백: 결과 확인 버튼 클릭 시 */
  onViewSchedule?: () => void;
  /** 콜백: 닫기/다음 단계 */
  onDismiss?: () => void;
};

/**
 * 플랜 생성 성공 축하 컴포넌트
 *
 * 플랜 생성이 완료되었을 때 사용자에게 축하 메시지와 함께
 * 다음 단계를 안내하는 UI를 표시합니다.
 */
export function SuccessCelebration({
  groupId,
  planName,
  planCount,
  periodLabel,
  isCampMode = false,
  onViewSchedule,
  onDismiss,
}: SuccessCelebrationProps) {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(true);

  // 3초 후 confetti 효과 종료
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleViewSchedule = () => {
    if (onViewSchedule) {
      onViewSchedule();
    } else {
      router.push(`/plan/group/${groupId}`);
    }
  };

  const handleGoToCalendar = () => {
    router.push("/plan/calendar");
  };

  const handleGoToToday = () => {
    router.push("/today");
  };

  return (
    <div className="relative flex flex-col items-center gap-6 rounded-2xl border border-green-200 bg-gradient-to-b from-green-50 to-white p-8 text-center">
      {/* Confetti 효과 (CSS 애니메이션) */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="confetti-container">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  backgroundColor: ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"][i % 5],
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 성공 아이콘 */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <Sparkles className="absolute -right-1 -top-1 h-6 w-6 text-yellow-500" />
      </div>

      {/* 축하 메시지 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">
          {isCampMode ? "캠프 플랜이 생성되었습니다!" : "플랜이 생성되었습니다!"}
        </h2>
        <p className="text-gray-600">
          <span className="font-semibold text-green-700">&quot;{planName}&quot;</span>
          {planCount !== undefined && (
            <span className="ml-1">
              에 총 <span className="font-semibold">{planCount}개</span>의 학습 일정이 배정되었습니다.
            </span>
          )}
        </p>
        {periodLabel && (
          <p className="text-sm text-gray-500">
            학습 기간: {periodLabel}
          </p>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-50 p-3">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="text-xs text-gray-500">일정 확인</span>
          <span className="text-sm font-medium text-gray-900">캘린더에서 보기</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-purple-50 p-3">
          <BookOpen className="h-5 w-5 text-purple-600" />
          <span className="text-xs text-gray-500">오늘 할 일</span>
          <span className="text-sm font-medium text-gray-900">학습 시작하기</span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <button
          type="button"
          onClick={handleViewSchedule}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
        >
          생성된 스케줄 확인
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGoToCalendar}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" />
            캘린더로 이동
          </button>
          <button
            type="button"
            onClick={handleGoToToday}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" />
            오늘 할 일
          </button>
        </div>
      </div>

      {/* 닫기/스킵 링크 */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          나중에 확인하기
        </button>
      )}

      {/* Confetti CSS */}
      <style jsx>{`
        .confetti-container {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .confetti {
          position: absolute;
          top: -10px;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: fall 3s ease-out forwards;
        }
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * 캘린더 전용 저장 성공 컴포넌트 (콘텐츠 없이 저장했을 때)
 */
type CalendarOnlySuccessProps = {
  groupId: string;
  planName: string;
  periodLabel?: string;
  onAddContent?: () => void;
  onViewCalendar?: () => void;
};

export function CalendarOnlySuccess({
  groupId,
  planName,
  periodLabel,
  onAddContent,
  onViewCalendar,
}: CalendarOnlySuccessProps) {
  const router = useRouter();

  const handleAddContent = () => {
    if (onAddContent) {
      onAddContent();
    } else {
      router.push(`/plan/group/${groupId}/add-content`);
    }
  };

  const handleViewCalendar = () => {
    if (onViewCalendar) {
      onViewCalendar();
    } else {
      router.push("/plan/calendar");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
      {/* 아이콘 */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <Calendar className="h-10 w-10 text-blue-600" />
      </div>

      {/* 메시지 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-gray-900">
          캘린더가 저장되었습니다!
        </h2>
        <p className="text-gray-600">
          <span className="font-semibold text-blue-700">&quot;{planName}&quot;</span>
          의 학습 일정이 생성되었습니다.
        </p>
        {periodLabel && (
          <p className="text-sm text-gray-500">
            학습 기간: {periodLabel}
          </p>
        )}
      </div>

      {/* 안내 */}
      <div className="rounded-lg bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>다음 단계:</strong> 콘텐츠를 추가하여 구체적인 학습 플랜을 만들어보세요.
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <button
          type="button"
          onClick={handleAddContent}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <BookOpen className="h-4 w-4" />
          콘텐츠 추가하기
        </button>
        <button
          type="button"
          onClick={handleViewCalendar}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Calendar className="h-4 w-4" />
          캘린더에서 확인
        </button>
      </div>
    </div>
  );
}
