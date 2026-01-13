'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  XCircle,
  SkipForward,
  BookOpen,
  Video,
  FileText,
  Info,
  Edit3,
  Copy,
  Trash2,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ModalWrapper, ModalButton } from './ModalWrapper';
import {
  getPlanGroupDetailAction,
  type PlanGroupDetail,
} from '@/lib/domains/admin-plan/actions/planGroupDetail';
import {
  deletePlanGroupAdmin,
  copyPlanGroupAdmin,
  activatePlanGroupAdmin,
} from '@/lib/domains/admin-plan/actions/planGroupOperations';
import { ERROR, formatError } from '@/lib/domains/admin-plan/utils/toastMessages';
import { PlanGroupEditModal } from '../dynamicModals';

interface PlanGroupDetailModalProps {
  planGroupId: string;
  tenantId: string;
  studentId: string;
  onClose: () => void;
  onSelect?: () => void;
  onRefresh?: () => void;
}

// 상태별 스타일
const statusStyles: Record<string, { label: string; className: string; dotColor: string }> = {
  active: {
    label: '활성',
    className: 'bg-green-100 text-green-700',
    dotColor: 'bg-green-500',
  },
  draft: {
    label: '초안',
    className: 'bg-gray-100 text-gray-600',
    dotColor: 'bg-gray-400',
  },
  saved: {
    label: '저장됨',
    className: 'bg-blue-100 text-blue-700',
    dotColor: 'bg-blue-500',
  },
  completed: {
    label: '완료',
    className: 'bg-purple-100 text-purple-700',
    dotColor: 'bg-purple-500',
  },
  paused: {
    label: '일시정지',
    className: 'bg-yellow-100 text-yellow-700',
    dotColor: 'bg-yellow-500',
  },
  cancelled: {
    label: '취소',
    className: 'bg-red-100 text-red-700',
    dotColor: 'bg-red-500',
  },
};

// 목적별 라벨
const purposeLabels: Record<string, string> = {
  내신대비: '내신 대비',
  모의고사: '모의고사 대비',
  수능: '수능 대비',
  기타: '기타',
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return '-';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function formatCreatedAt(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function PlanGroupDetailModal({
  planGroupId,
  tenantId,
  studentId,
  onClose,
  onSelect,
  onRefresh,
}: PlanGroupDetailModalProps) {
  const [detail, setDetail] = useState<PlanGroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<'delete' | 'copy' | 'activate' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);

    const result = await getPlanGroupDetailAction(planGroupId, tenantId);

    if (result) {
      setDetail(result);
    } else {
      setError(ERROR.PLAN_LOAD);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchDetail();
  }, [planGroupId, tenantId]);

  // 편집 완료 후 데이터 새로고침
  const handleEditSave = () => {
    fetchDetail();
    onRefresh?.();
  };

  // 삭제 핸들러
  const handleDelete = async () => {
    setActionLoading('delete');
    const result = await deletePlanGroupAdmin(planGroupId, studentId);
    setActionLoading(null);
    setShowDeleteConfirm(false);

    if (result.success) {
      onRefresh?.();
      onClose();
    } else {
      setError(formatError(result.error, ERROR.GROUP_DELETE));
    }
  };

  // 복사 핸들러
  const handleCopy = async () => {
    setActionLoading('copy');
    const result = await copyPlanGroupAdmin(planGroupId, studentId);
    setActionLoading(null);

    if (result.success) {
      onRefresh?.();
      onClose();
    } else {
      setError(formatError(result.error, ERROR.GROUP_COPY));
    }
  };

  // 활성화 핸들러
  const handleActivate = async () => {
    setActionLoading('activate');
    const result = await activatePlanGroupAdmin(planGroupId, studentId);
    setActionLoading(null);

    if (result.success) {
      onRefresh?.();
      fetchDetail(); // 상태 업데이트 반영
    } else {
      setError(formatError(result.error, ERROR.GROUP_ACTIVATE));
    }
  };

  const progressPercentage =
    detail && detail.totalCount > 0
      ? Math.round((detail.completedCount / detail.totalCount) * 100)
      : 0;

  const statusStyle = detail ? statusStyles[detail.status] || statusStyles.draft : statusStyles.draft;

  return (
    <>
    <ModalWrapper
      open={true}
      onClose={onClose}
      title="플랜 그룹 상세"
      icon={<Info className="w-5 h-5" />}
      theme="blue"
      size="md"
      loading={isLoading}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            닫기
          </ModalButton>
          <ModalButton
            variant="secondary"
            onClick={() => setShowEditModal(true)}
            disabled={isLoading || !!error}
          >
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" />
              편집
            </span>
          </ModalButton>
          {onSelect && (
            <ModalButton theme="blue" onClick={onSelect}>
              이 그룹 선택
            </ModalButton>
          )}
        </>
      }
    >
      <div className="p-4 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            <XCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && detail && (
          <>
            {/* 기본 정보 */}
            <div className="space-y-3">
              {/* 이름 및 상태 */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {detail.name || '이름 없는 플랜 그룹'}
                </h3>
                <span
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 flex-shrink-0',
                    statusStyle.className
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', statusStyle.dotColor)} />
                  {statusStyle.label}
                </span>
              </div>

              {/* 목적 */}
              {detail.planPurpose && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">목적:</span>
                  <span>{purposeLabels[detail.planPurpose] || detail.planPurpose}</span>
                </div>
              )}

              {/* 기간 */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{formatDateRange(detail.periodStart, detail.periodEnd)}</span>
              </div>

              {/* 생성일 */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>생성일: {formatCreatedAt(detail.createdAt)}</span>
              </div>
            </div>

            {/* 구분선 */}
            <hr className="border-gray-200" />

            {/* 진행률 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">진행률</span>
                <span className="font-bold text-gray-900">{progressPercentage}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* 상태별 통계 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700 mb-3">플랜 현황</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">완료</p>
                    <p className="font-semibold text-gray-900">{detail.completedCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">진행 중</p>
                    <p className="font-semibold text-gray-900">{detail.inProgressCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Pause className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">대기</p>
                    <p className="font-semibold text-gray-900">{detail.pendingCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <SkipForward className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">건너뜀/취소</p>
                    <p className="font-semibold text-gray-900">
                      {detail.skippedCount + detail.cancelledCount}
                    </p>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">총 플랜 수</span>
                  <span className="font-bold text-gray-900">{detail.totalCount}개</span>
                </div>
              </div>
            </div>

            {/* 콘텐츠 유형별 통계 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">콘텐츠 구성</h4>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-gray-600">교재</span>
                  <span className="font-semibold text-gray-900">{detail.bookCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">강의</span>
                  <span className="font-semibold text-gray-900">{detail.lectureCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">직접입력</span>
                  <span className="font-semibold text-gray-900">{detail.customCount}</span>
                </div>
              </div>
            </div>

            {/* 빠른 작업 */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">빠른 작업</h4>
              <div className="flex flex-wrap gap-2">
                {/* 활성화 버튼 (활성 상태가 아닐 때만) */}
                {detail.status !== 'active' && (
                  <button
                    onClick={handleActivate}
                    disabled={!!actionLoading}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      'border-green-300 text-green-700 hover:bg-green-50',
                      actionLoading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {actionLoading === 'activate' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    활성화
                  </button>
                )}

                {/* 복사 버튼 */}
                <button
                  onClick={handleCopy}
                  disabled={!!actionLoading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    'border-blue-300 text-blue-700 hover:bg-blue-50',
                    actionLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {actionLoading === 'copy' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  복사
                </button>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={!!actionLoading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    'border-red-300 text-red-700 hover:bg-red-50',
                    actionLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalWrapper>

    {/* 삭제 확인 모달 */}
    {showDeleteConfirm && (
      <ModalWrapper
        open={true}
        onClose={() => setShowDeleteConfirm(false)}
        title="플랜 그룹 삭제"
        icon={<Trash2 className="w-5 h-5" />}
        theme="red"
        size="sm"
        footer={
          <>
            <ModalButton
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={actionLoading === 'delete'}
            >
              취소
            </ModalButton>
            <ModalButton
              variant="danger"
              onClick={handleDelete}
              loading={actionLoading === 'delete'}
            >
              삭제
            </ModalButton>
          </>
        }
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            <strong>&quot;{detail?.name || '이름 없는 플랜 그룹'}&quot;</strong>을(를) 삭제하시겠습니까?
          </p>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <p className="font-medium mb-1">주의사항:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>이 그룹에 포함된 모든 플랜({detail?.totalCount || 0}개)이 함께 삭제됩니다.</li>
              <li>삭제된 그룹은 휴지통에서 복원할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </ModalWrapper>
    )}

    {/* 편집 모달 */}
    {showEditModal && (
      <PlanGroupEditModal
        planGroupId={planGroupId}
        tenantId={tenantId}
        onClose={() => setShowEditModal(false)}
        onSave={handleEditSave}
      />
    )}
    </>
  );
}
