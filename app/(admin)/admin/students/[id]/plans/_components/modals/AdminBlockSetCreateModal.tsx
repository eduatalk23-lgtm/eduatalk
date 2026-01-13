'use client';

/**
 * Admin 블록셋 생성 모달
 *
 * Admin이 학생의 블록셋(학습 시간표)을 생성할 수 있는 모달입니다.
 */

import { useState, useTransition, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { createBlockSetForStudent } from '@/lib/domains/admin-plan/actions/blockSets';
import { VALIDATION, SUCCESS, ERROR, formatError } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';
import { cn } from '@/lib/cn';

interface AdminBlockSetCreateModalProps {
  studentId: string;
  onClose: () => void;
  onSuccess: (blockSetId: string) => void;
}

type AddedBlock = {
  day: number;
  startTime: string;
  endTime: string;
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function AdminBlockSetCreateModal({
  studentId,
  onClose,
  onSuccess,
}: AdminBlockSetCreateModalProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // 블록셋 이름
  const [blockSetName, setBlockSetName] = useState('');

  // 요일 선택
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);

  // 시간 입력
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('12:00');

  // 추가된 블록 목록
  const [addedBlocks, setAddedBlocks] = useState<AddedBlock[]>([]);

  // 요일 토글
  const handleToggleWeekday = useCallback((day: number) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  // 전체 선택
  const handleSelectAll = useCallback(() => {
    setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6]);
  }, []);

  // 평일 선택
  const handleSelectWeekdays = useCallback(() => {
    setSelectedWeekdays([1, 2, 3, 4, 5]);
  }, []);

  // 주말 선택
  const handleSelectWeekends = useCallback(() => {
    setSelectedWeekdays([0, 6]);
  }, []);

  // 블록 추가
  const handleAddBlock = useCallback(() => {
    if (selectedWeekdays.length === 0) {
      showError(VALIDATION.SELECT_WEEKDAYS);
      return;
    }

    if (!blockStartTime || !blockEndTime) {
      showError(VALIDATION.ENTER_TIME);
      return;
    }

    if (blockStartTime >= blockEndTime) {
      showError(VALIDATION.INVALID_TIME_RANGE);
      return;
    }

    // 선택된 요일마다 블록 추가
    const newBlocks: AddedBlock[] = selectedWeekdays.map((day) => ({
      day,
      startTime: blockStartTime,
      endTime: blockEndTime,
    }));

    setAddedBlocks((prev) => [...prev, ...newBlocks]);
    setSelectedWeekdays([]);
  }, [selectedWeekdays, blockStartTime, blockEndTime, showError]);

  // 블록 삭제
  const handleRemoveBlock = useCallback((index: number) => {
    setAddedBlocks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 블록셋 생성
  const handleCreate = useCallback(() => {
    if (!blockSetName.trim()) {
      showError(VALIDATION.ENTER_BLOCKSET_NAME);
      return;
    }

    if (addedBlocks.length === 0) {
      showError(VALIDATION.ADD_TIME_BLOCK);
      return;
    }

    startTransition(async () => {
      const result = await createBlockSetForStudent({
        studentId,
        name: blockSetName.trim(),
        blocks: addedBlocks.map((block) => ({
          day_of_week: block.day,
          start_time: block.startTime,
          end_time: block.endTime,
        })),
      });

      if (result.success && result.blockSetId) {
        showSuccess(SUCCESS.BLOCKSET_CREATED);
        onSuccess(result.blockSetId);
      } else {
        showError(formatError(result.error, ERROR.BLOCKSET_CREATE));
      }
    });
  }, [blockSetName, addedBlocks, studentId, showSuccess, showError, onSuccess]);

  const isAddDisabled = selectedWeekdays.length === 0 || !blockStartTime || !blockEndTime;
  const isCreateDisabled = !blockSetName.trim() || addedBlocks.length === 0;

  return (
    <ModalWrapper
      open
      onClose={onClose}
      title="새 시간표 만들기"
      subtitle="학생의 학습 시간표를 생성합니다"
      icon={<Calendar className="h-5 w-5" />}
      theme="green"
      size="lg"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={isPending}>
            취소
          </ModalButton>
          <ModalButton
            variant="primary"
            theme="green"
            onClick={handleCreate}
            disabled={isCreateDisabled}
            loading={isPending}
          >
            생성
          </ModalButton>
        </>
      }
    >
      <div className="p-4 flex flex-col gap-4">
        {/* 블록셋 이름 */}
        <div className="flex flex-col gap-2">
          <label className="block text-sm font-medium text-gray-900">
            시간표 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="예: 평일 학습 시간표"
            value={blockSetName}
            onChange={(e) => setBlockSetName(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* 시간 블록 추가 */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">시간 블록 추가</h3>

          {/* 요일 선택 */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                전체
              </button>
              <button
                type="button"
                onClick={handleSelectWeekdays}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                평일
              </button>
              <button
                type="button"
                onClick={handleSelectWeekends}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                주말
              </button>
            </div>
            <div className="flex gap-1">
              {DAY_NAMES.map((name, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleToggleWeekday(index)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                    selectedWeekdays.includes(index)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 시간 입력 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium text-gray-700">시작 시간</label>
              <input
                type="time"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium text-gray-700">종료 시간</label>
              <input
                type="time"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={blockEndTime}
                onChange={(e) => setBlockEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* 블록 추가 버튼 */}
          <button
            type="button"
            onClick={handleAddBlock}
            disabled={isAddDisabled}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            블록 추가하기
          </button>
        </div>

        {/* 추가된 블록 목록 */}
        {addedBlocks.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                추가된 블록 ({addedBlocks.length}개)
              </h3>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {addedBlocks.map((block, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm text-gray-600">
                      {DAY_NAMES[block.day]}요일 {block.startTime} ~ {block.endTime}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlock(index)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
