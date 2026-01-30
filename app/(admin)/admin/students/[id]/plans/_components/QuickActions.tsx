'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { Check, Circle } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { togglePlanComplete, updatePlanRange } from '@/lib/domains/plan/actions/dock';
import { formatPlanLearningAmount } from '@/lib/utils/planFormatting';

interface QuickCompleteButtonProps {
  planId: string;
  planType: 'plan' | 'adhoc';
  isCompleted: boolean;
  onSuccess: () => void;
  size?: 'sm' | 'md' | 'lg';
  /** React Query 등 클라이언트 캐시로 관리할 때 true로 설정 */
  skipRevalidation?: boolean;
}

/**
 * 빠른 완료/미완료 토글 버튼 (원형 디자인)
 */
export function QuickCompleteButton({
  planId,
  planType,
  isCompleted,
  onSuccess,
  size = 'md',
  skipRevalidation = false,
}: QuickCompleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isAnimating, setIsAnimating] = useState(false);
  const { showError } = useToast();

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const handleToggle = async () => {
    // 완료 처리시 애니메이션
    if (!isCompleted) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }

    startTransition(async () => {
      const result = await togglePlanComplete(
        planId,
        isCompleted,
        planType === 'adhoc',
        skipRevalidation
      );

      if (result.success) {
        onSuccess();
      } else {
        // 애니메이션 취소
        setIsAnimating(false);
        showError(result.error ?? '상태 변경에 실패했습니다.');
      }
    });
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleToggle();
      }}
      disabled={isPending}
      className={cn(
        'relative rounded-full flex items-center justify-center transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        sizeClasses[size],
        isCompleted
          ? 'bg-green-500 text-white shadow-sm focus:ring-green-300'
          : 'border-2 border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-500 hover:bg-green-50 focus:ring-green-200',
        isPending && 'opacity-50 cursor-not-allowed',
        isAnimating && 'scale-110'
      )}
      title={isCompleted ? '완료 취소' : '완료 처리'}
      aria-label={isCompleted ? '완료 취소' : '완료 처리'}
    >
      {isCompleted ? (
        <Check
          size={iconSizes[size]}
          strokeWidth={3}
          className={cn(
            'transition-transform',
            isAnimating && 'animate-bounce'
          )}
        />
      ) : (
        <Circle
          size={iconSizes[size] - 4}
          strokeWidth={0}
          className="fill-current opacity-0 group-hover:opacity-30"
        />
      )}

      {/* 호버시 체크 힌트 표시 */}
      {!isCompleted && !isPending && (
        <Check
          size={iconSizes[size] - 2}
          strokeWidth={2}
          className="absolute opacity-0 hover:opacity-50 transition-opacity text-green-500"
        />
      )}
    </button>
  );
}

interface InlineVolumeEditorProps {
  planId: string;
  currentStart: number;
  currentEnd: number;
  /** 콘텐츠 타입 (book/lecture/custom) - 범위 표시 형식 결정 */
  contentType?: 'book' | 'lecture' | 'custom' | string;
  onSuccess: () => void;
}

/**
 * 인라인 볼륨 수정기
 */
export function InlineVolumeEditor({
  planId,
  currentStart,
  currentEnd,
  contentType = 'book',
  onSuccess,
}: InlineVolumeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [start, setStart] = useState(currentStart);
  const [end, setEnd] = useState(currentEnd);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { showError } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (start === currentStart && end === currentEnd) {
      setIsEditing(false);
      return;
    }

    // 클라이언트 유효성 검사
    if (start > end) {
      showError('시작 값이 종료 값보다 클 수 없습니다.');
      return;
    }

    startTransition(async () => {
      const result = await updatePlanRange({
        planId,
        startValue: start,
        endValue: end,
      });

      if (result.success) {
        setIsEditing(false);
        onSuccess();
      } else {
        // 에러 시 원래 값으로 복원하고 편집 모드 종료
        setStart(currentStart);
        setEnd(currentEnd);
        setIsEditing(false);
        showError(result.error ?? '범위 수정에 실패했습니다.');
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setStart(currentStart);
      setEnd(currentEnd);
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    const displayText = formatPlanLearningAmount({
      content_type: contentType,
      planned_start_page_or_time: currentStart,
      planned_end_page_or_time: currentEnd,
    });

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
      >
        {displayText}
      </button>
    );
  }

  // 강의: 단위를 뒤에 표시, 교재: 단위를 앞에 표시
  const isLecture = contentType === 'lecture';

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {!isLecture && <span className="text-gray-500 text-sm">p.</span>}
      <input
        ref={inputRef}
        type="number"
        value={start}
        onChange={(e) => setStart(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        className="w-12 px-1 py-0.5 text-sm border rounded font-mono"
        disabled={isPending}
      />
      <span className="text-gray-400">-</span>
      <input
        type="number"
        value={end}
        onChange={(e) => setEnd(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        className="w-12 px-1 py-0.5 text-sm border rounded font-mono"
        disabled={isPending}
      />
      {isLecture && <span className="text-gray-500 text-sm">강</span>}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        ✓
      </button>
      <button
        onClick={() => {
          setStart(currentStart);
          setEnd(currentEnd);
          setIsEditing(false);
        }}
        className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
      >
        ✕
      </button>
    </div>
  );
}

// NOTE: ProgressBar and QuickProgressInput removed - using binary completion (status + actual_end_time)
