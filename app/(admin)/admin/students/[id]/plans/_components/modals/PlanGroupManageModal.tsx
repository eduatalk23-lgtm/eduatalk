'use client';

/**
 * 플랜 그룹 관리 모달
 * - 여러 플랜 그룹을 체크박스로 선택하여 일괄 삭제
 * - 캠프 플랜은 삭제 불가 (선택 비활성화)
 */

import { useState, useMemo, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { Settings2, Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { bulkDeletePlanGroupsAdmin } from '@/lib/domains/admin-plan/actions/planGroupOperations';
import { ERROR, formatError } from '@/lib/domains/admin-plan/utils/toastMessages';
import { ModalWrapper, ModalButton } from './ModalWrapper';

// 상태별 배지 스타일
const statusStyles: Record<string, { label: string; className: string }> = {
  active: {
    label: '활성',
    className: 'bg-green-100 text-green-700',
  },
  draft: {
    label: '초안',
    className: 'bg-gray-100 text-gray-600',
  },
  saved: {
    label: '저장됨',
    className: 'bg-blue-100 text-blue-700',
  },
  completed: {
    label: '완료',
    className: 'bg-purple-100 text-purple-700',
  },
  paused: {
    label: '일시정지',
    className: 'bg-yellow-100 text-yellow-700',
  },
  cancelled: {
    label: '취소',
    className: 'bg-red-100 text-red-700',
  },
};

// 목적별 라벨
const purposeLabels: Record<string, string> = {
  내신대비: '내신',
  모의고사: '모의',
  수능: '수능',
  기타: '기타',
};

interface PlanGroupForManage {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
  planType?: string | null; // camp 여부 확인용
  campInvitationId?: string | null;
}

interface PlanGroupManageModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  planGroups: PlanGroupForManage[];
  onSuccess: () => void;
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export function PlanGroupManageModal({
  open,
  onClose,
  studentId,
  planGroups,
  onSuccess,
}: PlanGroupManageModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  // 캠프가 아닌 삭제 가능한 그룹만 필터링
  const deletableGroups = useMemo(() => {
    return planGroups.filter(
      (g) => !(g.planType === 'camp' && g.campInvitationId)
    );
  }, [planGroups]);

  // 캠프 그룹 (선택 비활성화)
  const campGroups = useMemo(() => {
    return planGroups.filter(
      (g) => g.planType === 'camp' && g.campInvitationId
    );
  }, [planGroups]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedIds.size === deletableGroups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableGroups.map((g) => g.id)));
    }
  };

  // 개별 토글
  const handleToggleSelect = (groupId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 삭제 실행
  const handleDelete = () => {
    if (selectedIds.size === 0 || !confirmDelete) return;

    startTransition(async () => {
      const result = await bulkDeletePlanGroupsAdmin(
        Array.from(selectedIds),
        studentId
      );

      if (result.success && result.data) {
        const { deletedCount, failedCount } = result.data;
        if (deletedCount > 0) {
          showSuccess(`${deletedCount}개 플랜 그룹이 삭제되었습니다. 휴지통에서 복원할 수 있습니다.`);
        }
        if (failedCount > 0) {
          showError(`${failedCount}개 삭제 실패 (캠프 플랜 또는 권한 문제)`);
        }
        setSelectedIds(new Set());
        setConfirmDelete(false);
        onSuccess();
        onClose();
      } else {
        showError(formatError(result.error, ERROR.BATCH_DELETE));
      }
    });
  };

  // 모달 닫기 시 상태 초기화
  const handleClose = () => {
    setSelectedIds(new Set());
    setConfirmDelete(false);
    onClose();
  };

  if (!open) return null;

  return (
    <ModalWrapper
      open={open}
      onClose={handleClose}
      title="플랜 그룹 관리"
      subtitle="여러 플랜 그룹을 선택하여 일괄 삭제"
      icon={<Settings2 className="h-5 w-5" />}
      theme="blue"
      size="lg"
      loading={isPending}
      footer={
        <>
          <ModalButton variant="secondary" onClick={handleClose} disabled={isPending}>
            닫기
          </ModalButton>
          <ModalButton
            variant="danger"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || !confirmDelete}
            loading={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                삭제 중...
              </>
            ) : (
              `선택 삭제 (${selectedIds.size}개)`
            )}
          </ModalButton>
        </>
      }
    >
      {/* 액션 바 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            disabled={deletableGroups.length === 0}
            className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            {selectedIds.size === deletableGroups.length && deletableGroups.length > 0
              ? '전체 해제'
              : '전체 선택'}
          </button>
          <span className="text-xs text-gray-500">
            {selectedIds.size > 0 && `${selectedIds.size}개 선택됨`}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          전체 {planGroups.length}개 그룹
        </span>
      </div>

      {/* 그룹 목록 */}
      <div className="p-4">
        {planGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            플랜 그룹이 없습니다.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {/* 삭제 가능한 그룹 */}
            {deletableGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleToggleSelect(group.id)}
                className={cn(
                  'flex items-center gap-3 bg-white rounded-lg p-3 border transition-colors cursor-pointer',
                  selectedIds.has(group.id)
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(group.id)}
                  onChange={() => handleToggleSelect(group.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate text-gray-700">
                      {group.name || '이름 없음'}
                    </span>
                    {group.planPurpose && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                        {purposeLabels[group.planPurpose] || group.planPurpose}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        statusStyles[group.status]?.className || statusStyles.draft.className
                      )}
                    >
                      {statusStyles[group.status]?.label || group.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDateRange(group.periodStart, group.periodEnd)}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* 캠프 그룹 (비활성화) */}
            {campGroups.length > 0 && (
              <>
                <div className="text-xs text-gray-400 mt-4 mb-2 px-1">
                  캠프 플랜 (삭제 불가)
                </div>
                {campGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200 opacity-60"
                  >
                    <input
                      type="checkbox"
                      disabled
                      className="w-4 h-4 rounded border-gray-300 cursor-not-allowed"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-gray-500">
                          {group.name || '이름 없음'}
                        </span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                          캠프
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDateRange(group.periodStart, group.periodEnd)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 삭제 확인 체크박스 */}
        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <label className="flex items-start gap-2 text-sm text-red-800 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
                className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span>
                <strong>{selectedIds.size}개</strong> 플랜 그룹 삭제를 확인합니다.
                <br />
                <span className="text-xs text-red-600">
                  삭제된 그룹은 History 탭에서 복원할 수 있습니다.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
