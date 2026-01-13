'use client';

import { useState, useTransition, useEffect } from 'react';
import { FolderInput } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getStudentPlanGroups,
  movePlansToGroup,
  type PlanGroupInfo,
} from '@/lib/domains/admin-plan/actions/moveToGroup';
import { VALIDATION, ERROR, formatError, formatMoveSuccess } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

interface MoveToGroupModalProps {
  planIds: string[];
  studentId: string;
  currentGroupId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function MoveToGroupModal({
  planIds,
  studentId,
  currentGroupId,
  onClose,
  onSuccess,
}: MoveToGroupModalProps) {
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<PlanGroupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  // 플랜 그룹 목록 로드
  useEffect(() => {
    async function fetchGroups() {
      const result = await getStudentPlanGroups(studentId);
      if (result.success && result.data) {
        setGroups(result.data);
      }
      setIsLoading(false);
    }

    fetchGroups();
  }, [studentId]);

  const handleSubmit = async () => {
    if (selectedGroupId === currentGroupId) {
      showError(VALIDATION.SAME_GROUP);
      return;
    }

    startTransition(async () => {
      const result = await movePlansToGroup({
        planIds,
        targetGroupId: selectedGroupId,
        studentId,
      });

      if (result.success) {
        const action = selectedGroupId ? '이동' : '그룹에서 제거';
        showSuccess(formatMoveSuccess(result.data?.movedCount ?? planIds.length, action));
        onSuccess();
      } else {
        showError(formatError(result.error, ERROR.PLAN_MOVE));
      }
    });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return null;
    const formatDate = (d: string) => {
      const date = new Date(d + 'T00:00:00');
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };
    if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`;
    if (start) return `${formatDate(start)} ~`;
    return `~ ${formatDate(end!)}`;
  };

  // 로딩 콘텐츠
  const loadingContent = (
    <div className="p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    </div>
  );

  // 메인 콘텐츠
  const mainContent = (
    <div className="p-4 space-y-3">
      {/* 그룹에서 제거 옵션 */}
      <label
        className={cn(
          'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
          selectedGroupId === null && 'border-orange-500 bg-orange-50'
        )}
      >
        <input
          type="radio"
          checked={selectedGroupId === null}
          onChange={() => setSelectedGroupId(null)}
          className="w-4 h-4"
        />
        <div>
          <div className="font-medium text-orange-700">그룹에서 제거</div>
          <div className="text-sm text-gray-500">
            플랜을 어떤 그룹에도 속하지 않도록 설정
          </div>
        </div>
      </label>

      {/* 그룹 목록 */}
      {groups.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>이 학생에게 생성된 플랜 그룹이 없습니다.</p>
        </div>
      ) : (
        groups.map((group) => {
          const isCurrentGroup = group.id === currentGroupId;
          const dateRange = formatDateRange(group.start_date, group.end_date);

          return (
            <label
              key={group.id}
              className={cn(
                'flex items-start gap-3 p-3 border rounded-lg cursor-pointer',
                selectedGroupId === group.id && 'border-purple-500 bg-purple-50',
                isCurrentGroup && 'opacity-50'
              )}
            >
              <input
                type="radio"
                checked={selectedGroupId === group.id}
                onChange={() => setSelectedGroupId(group.id)}
                disabled={isCurrentGroup}
                className="w-4 h-4 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{group.name}</span>
                  {isCurrentGroup && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                      현재
                    </span>
                  )}
                </div>
                {group.content_title && (
                  <div className="text-sm text-gray-600 truncate">
                    {group.content_title}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  {dateRange && <span>{dateRange}</span>}
                  <span>플랜 {group.plan_count}개</span>
                </div>
              </div>
            </label>
          );
        })
      )}
    </div>
  );

  return (
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="플랜 그룹 이동"
      subtitle={`${planIds.length}개 플랜을 다른 그룹으로 이동합니다`}
      icon={<FolderInput className="h-5 w-5" />}
      theme="purple"
      size="md"
      loading={isPending}
      footer={
        !isLoading && (
          <>
            <ModalButton variant="secondary" onClick={onClose}>
              취소
            </ModalButton>
            <ModalButton
              theme="purple"
              onClick={handleSubmit}
              disabled={selectedGroupId === currentGroupId}
              loading={isPending}
            >
              {selectedGroupId ? '그룹으로 이동' : '그룹에서 제거'}
            </ModalButton>
          </>
        )
      }
    >
      {isLoading ? loadingContent : mainContent}
    </ModalWrapper>
  );
}
