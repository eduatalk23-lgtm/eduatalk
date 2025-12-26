'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

interface QuickCompleteButtonProps {
  planId: string;
  planType: 'plan' | 'adhoc';
  isCompleted: boolean;
  onSuccess: () => void;
}

/**
 * 빠른 완료/미완료 토글 버튼
 */
export function QuickCompleteButton({
  planId,
  planType,
  isCompleted,
  onSuccess,
}: QuickCompleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = async () => {
    const supabase = createSupabaseBrowserClient();
    const tableName = planType === 'plan' ? 'student_plan' : 'ad_hoc_plans';
    const newStatus = isCompleted ? 'pending' : 'completed';

    startTransition(async () => {
      if (planType === 'plan') {
        await supabase
          .from(tableName)
          .update({
            status: newStatus,
            is_completed: !isCompleted,
            completed_at: isCompleted ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', planId);
      } else {
        await supabase
          .from(tableName)
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', planId);
      }

      onSuccess();
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
        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
        isCompleted
          ? 'bg-green-500 border-green-500 text-white'
          : 'border-gray-300 hover:border-green-400',
        isPending && 'opacity-50'
      )}
      title={isCompleted ? '완료 취소' : '완료 처리'}
    >
      {isCompleted && <span className="text-xs">✓</span>}
    </button>
  );
}

interface InlineVolumeEditorProps {
  planId: string;
  currentStart: number;
  currentEnd: number;
  onSuccess: () => void;
}

/**
 * 인라인 볼륨 수정기
 */
export function InlineVolumeEditor({
  planId,
  currentStart,
  currentEnd,
  onSuccess,
}: InlineVolumeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [start, setStart] = useState(currentStart);
  const [end, setEnd] = useState(currentEnd);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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

    const supabase = createSupabaseBrowserClient();

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          planned_start_page_or_time: start,
          planned_end_page_or_time: end,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      setIsEditing(false);
      onSuccess();
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
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
      >
        p.{currentStart}-{currentEnd}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-gray-500 text-sm">p.</span>
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

interface ProgressBarProps {
  plannedStart: number;
  plannedEnd: number;
  completedStart?: number;
  completedEnd?: number;
  className?: string;
}

/**
 * 진행률 표시 바
 */
export function ProgressBar({
  plannedStart,
  plannedEnd,
  completedStart = 0,
  completedEnd = 0,
  className,
}: ProgressBarProps) {
  const plannedVolume = plannedEnd - plannedStart;
  const completedVolume = completedEnd - completedStart;
  const progress = plannedVolume > 0 ? Math.min(100, (completedVolume / plannedVolume) * 100) : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-300'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-10 text-right">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

interface QuickProgressInputProps {
  planId: string;
  plannedStart: number;
  plannedEnd: number;
  completedStart: number;
  completedEnd: number;
  onSuccess: () => void;
}

/**
 * 빠른 진행 상황 입력
 */
export function QuickProgressInput({
  planId,
  plannedStart,
  plannedEnd,
  completedStart,
  completedEnd,
  onSuccess,
}: QuickProgressInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newCompletedEnd, setNewCompletedEnd] = useState(completedEnd || plannedStart);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const supabase = createSupabaseBrowserClient();
    const isComplete = newCompletedEnd >= plannedEnd;

    startTransition(async () => {
      await supabase
        .from('student_plan')
        .update({
          completed_start_page_or_time: completedStart || plannedStart,
          completed_end_page_or_time: newCompletedEnd,
          is_completed: isComplete,
          status: isComplete ? 'completed' : 'in_progress',
          completed_at: isComplete ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      setIsEditing(false);
      onSuccess();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setNewCompletedEnd(completedEnd || plannedStart);
      setIsEditing(false);
    }
  };

  const plannedVolume = plannedEnd - plannedStart;
  const currentCompletedVolume = (completedEnd || plannedStart) - (completedStart || plannedStart);
  const progress = plannedVolume > 0 ? Math.round((currentCompletedVolume / plannedVolume) * 100) : 0;

  if (!isEditing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
        title="진행 상황 입력"
      >
        <span className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <span
            className={cn(
              'block h-full rounded-full',
              progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-300'
            )}
            style={{ width: `${progress}%` }}
          />
        </span>
        <span className="tabular-nums">{progress}%</span>
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-gray-500">진행:</span>
      <span className="text-xs text-gray-400">p.{plannedStart}-</span>
      <input
        ref={inputRef}
        type="number"
        value={newCompletedEnd}
        onChange={(e) => setNewCompletedEnd(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        min={plannedStart}
        max={plannedEnd}
        className="w-12 px-1 py-0.5 text-xs border rounded font-mono"
        disabled={isPending}
      />
      <span className="text-xs text-gray-400">/{plannedEnd}</span>
      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        ✓
      </button>
      <button
        onClick={() => {
          setNewCompletedEnd(completedEnd || plannedStart);
          setIsEditing(false);
        }}
        className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
      >
        ✕
      </button>
    </div>
  );
}
