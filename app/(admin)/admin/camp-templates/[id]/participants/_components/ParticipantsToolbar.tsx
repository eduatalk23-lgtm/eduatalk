"use client";

import type { StatusFilter, Participant } from "./types";

type ParticipantsToolbarProps = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  selectedParticipantIds: Set<string>;
  participants: Participant[];
  isPending: boolean;
  onBulkCreatePlanGroups: () => void;
  onBatchWizardOpen: () => void;
  onBulkRecommendOpen: () => void;
  onBatchActivate: () => void;
  onBatchStatusChange: (status: string) => void;
  onBulkExclude: () => void;
};

export default function ParticipantsToolbar({
  statusFilter,
  onStatusFilterChange,
  selectedParticipantIds,
  participants,
  isPending,
  onBulkCreatePlanGroups,
  onBatchWizardOpen,
  onBulkRecommendOpen,
  onBatchActivate,
  onBatchStatusChange,
  onBulkExclude,
}: ParticipantsToolbarProps) {
  // 선택된 참여자 중 플랜 그룹이 없는 참여자
  const selectedWithoutGroup = participants.filter((p) => {
    const key = p.plan_group_id || p.invitation_id;
    return selectedParticipantIds.has(key) && p.plan_group_id === null;
  });

  // 선택된 참여자 중 플랜 그룹이 있는 참여자
  const selectedWithGroup = participants.filter((p) => {
    const key = p.plan_group_id || p.invitation_id;
    return selectedParticipantIds.has(key) && p.plan_group_id !== null;
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">
          상태 필터:
        </label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">전체</option>
          <option value="accepted">수락</option>
          <option value="pending">대기중</option>
          <option value="declined">거절</option>
        </select>
      </div>

      {selectedParticipantIds.size > 0 && (
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-medium">
              {selectedParticipantIds.size}
            </span>
            개 선택됨
          </div>
          <div className="flex items-center gap-2">
            {/* 플랜 그룹이 없는 학생들: 플랜 그룹 일괄 생성 */}
            {selectedWithoutGroup.length > 0 && (
              <button
                type="button"
                onClick={onBulkCreatePlanGroups}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="선택한 참여자에게 플랜 그룹을 일괄 생성합니다"
              >
                플랜 그룹 일괄 생성 ({selectedWithoutGroup.length})
              </button>
            )}
            {/* 플랜 그룹이 있는 학생들: 일괄 설정 및 플랜 생성 위저드 */}
            {selectedWithGroup.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={onBatchWizardOpen}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="선택한 참여자에게 콘텐츠 추천, 범위 조절, 플랜 생성을 단계별로 진행합니다"
                >
                  일괄 설정 및 플랜 생성 ({selectedWithGroup.length})
                </button>
                {/* 플랜 그룹이 있는 학생들만 추천 콘텐츠 일괄 적용 가능 */}
                <button
                  type="button"
                  onClick={onBulkRecommendOpen}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="선택한 참여자에게 추천 콘텐츠만 일괄 적용합니다"
                >
                  추천 콘텐츠만 적용 ({selectedWithGroup.length})
                </button>
                <button
                  type="button"
                  onClick={onBatchActivate}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="선택한 참여자의 플랜 그룹을 활성화합니다"
                >
                  일괄 활성화 ({selectedWithGroup.length})
                </button>
              </>
            )}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onBatchStatusChange(e.target.value);
                  e.target.value = "";
                }
              }}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">상태 변경</option>
              <option value="active">활성</option>
              <option value="saved">저장됨</option>
              <option value="paused">일시정지</option>
              <option value="completed">완료</option>
            </select>
            {/* 일괄 제외 버튼 */}
            <button
              type="button"
              onClick={onBulkExclude}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="선택한 참여자를 캠프에서 제외합니다"
            >
              제외 ({selectedParticipantIds.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

