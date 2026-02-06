'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import { formatDuration, type EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';

export interface EmptyTimeSlotCardProps {
  slot: EmptySlot;
  /** 드롭 가능 여부 (DnD 활성화) */
  droppable?: boolean;
  /** 외부에서 전달받는 isOver 상태 (droppable=false일 때 사용) */
  externalIsOver?: boolean;
  /** 새 플랜 생성 클릭 */
  onCreatePlan?: (slot: EmptySlot) => void;
  /** 미완료 플랜 배치 클릭 */
  onPlaceUnfinished?: (slot: EmptySlot) => void;
  /** 주간독에서 가져오기 클릭 */
  onPlaceFromWeekly?: (slot: EmptySlot) => void;
  /** 휴식/비학습시간 추가 클릭 */
  onAddNonStudyTime?: (slot: EmptySlot) => void;
}

/**
 * 빈 시간 슬롯 카드
 *
 * 플랜과 비학습시간 사이의 빈 시간을 시각화하고,
 * 클릭 시 플랜 추가 옵션을 표시합니다.
 * DnD 드롭 대상으로도 작동합니다.
 */
export const EmptyTimeSlotCard = memo(function EmptyTimeSlotCard({
  slot,
  droppable = true,
  externalIsOver,
  onCreatePlan,
  onPlaceUnfinished,
  onPlaceFromWeekly,
  onAddNonStudyTime,
}: EmptyTimeSlotCardProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 드롭 가능한 영역으로 설정 (슬롯 ID = empty-{startTime}-{endTime})
  const droppableId = `empty-slot-${slot.startTime}-${slot.endTime}`;
  const { isOver: internalIsOver, setNodeRef, node, rect } = useDroppable({
    id: droppableId,
    disabled: !droppable,
    data: {
      type: 'emptySlot',
      slot,
    },
  });

  // 외부 isOver가 있으면 사용, 없으면 내부 isOver 사용
  const isOver = externalIsOver ?? internalIsOver;


  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        cardRef.current &&
        !cardRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  // ESC 키로 팝오버 닫기
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isPopoverOpen]);

  const handleCardClick = () => {
    setIsPopoverOpen(!isPopoverOpen);
  };

  const handleOptionClick = (handler?: (slot: EmptySlot) => void) => {
    if (handler) {
      handler(slot);
    }
    setIsPopoverOpen(false);
  };

  return (
    <div className="relative" ref={cardRef}>
      {/* 빈 시간 슬롯 카드 (드롭 대상) */}
      <div ref={setNodeRef}>
        <button
          type="button"
          onClick={handleCardClick}
          className={cn(
            'w-full rounded-lg border-2 border-dashed transition-all duration-200',
            'hover:border-blue-400 hover:bg-blue-50/50',
            isPopoverOpen
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-gray-300 bg-gray-50/50',
            // 드래그 오버 시 하이라이트
            isOver && 'border-green-500 bg-green-50/50 ring-2 ring-green-300'
          )}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={cn(
                'text-lg',
                isOver ? 'text-green-500' : 'text-gray-400'
              )}>
                {isOver ? '↓' : '+'}
              </span>
              <div className="text-left">
                <div className={cn(
                  'text-sm font-medium',
                  isOver ? 'text-green-600' : 'text-gray-500'
                )}>
                  {isOver ? '여기에 배치' : `빈 시간 (${formatDuration(slot.durationMinutes)})`}
                </div>
                <div className="text-xs text-gray-400">
                  {slot.startTime} - {slot.endTime}
                </div>
              </div>
            </div>
            {!isOver && (
              <span className="text-xs text-gray-400">클릭 또는 드래그</span>
            )}
          </div>
        </button>
      </div>

      {/* 팝오버 메뉴 */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute z-50 mt-1 left-1/2 -translate-x-1/2',
            'w-64 bg-white rounded-lg shadow-lg border border-gray-200',
            'animate-in fade-in-0 zoom-in-95 duration-200'
          )}
        >
          {/* 헤더 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700">
              {slot.startTime} - {slot.endTime}
            </div>
            <div className="text-xs text-gray-500">
              {formatDuration(slot.durationMinutes)}
            </div>
          </div>

          {/* 옵션 목록 */}
          <div className="py-1">
            {onCreatePlan && (
              <button
                type="button"
                onClick={() => handleOptionClick(onCreatePlan)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <span className="text-blue-500">+</span>
                <div>
                  <div className="font-medium text-gray-700">새 플랜 생성</div>
                  <div className="text-xs text-gray-500">
                    새로운 학습 플랜 추가
                  </div>
                </div>
              </button>
            )}

            {onPlaceUnfinished && (
              <button
                type="button"
                onClick={() => handleOptionClick(onPlaceUnfinished)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <span className="text-amber-500">&#x1F4CB;</span>
                <div>
                  <div className="font-medium text-gray-700">미완료 플랜 배치</div>
                  <div className="text-xs text-gray-500">
                    미완료 플랜에서 가져오기
                  </div>
                </div>
              </button>
            )}

            {onPlaceFromWeekly && (
              <button
                type="button"
                onClick={() => handleOptionClick(onPlaceFromWeekly)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <span className="text-green-500">&#x1F4E6;</span>
                <div>
                  <div className="font-medium text-gray-700">주간 플랜에서 가져오기</div>
                  <div className="text-xs text-gray-500">
                    주간 플랜에서 배치
                  </div>
                </div>
              </button>
            )}

            {onAddNonStudyTime && (
              <button
                type="button"
                onClick={() => handleOptionClick(onAddNonStudyTime)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <span className="text-gray-500">&#x2615;</span>
                <div>
                  <div className="font-medium text-gray-700">
                    휴식/비학습시간 추가
                  </div>
                  <div className="text-xs text-gray-500">
                    휴식, 식사 등 비학습 시간
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
