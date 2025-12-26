"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useCampParticipantsLogic } from "./_components/useCampParticipantsLogic";
import { CampOverviewDashboard } from "./_components/CampOverviewDashboard";
import ParticipantsToolbar from "./_components/ParticipantsToolbar";
import ParticipantsTable from "./_components/ParticipantsTable";
import { BatchOperationDialog } from "./_components/BatchOperationDialog";
import { BulkRecommendContentsModal } from "./_components/BulkRecommendContentsModal";
import { BatchPlanWizard } from "./_components/BatchPlanWizard";
import { CampParticipantsListSkeleton } from "./_components/CampParticipantsListSkeleton";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { Pagination } from "@/components/organisms/Pagination";
import type { CampParticipantsListProps, Participant } from "./_components/types";

export function CampParticipantsList({
  templateId,
  templateName,
}: CampParticipantsListProps) {
  const {
    participants,
    loading,
    statusFilter,
    sortBy,
    sortOrder,
    selectedParticipantIds,
    isPending,
    filteredParticipants,
    stats,
    needsActionParticipants,
    lastLoadTimeRef,
    pagination,
    handlePageChange,
    handlePageSizeChange,
    setStatusFilter,
    handleSort,
    handleSelectAll,
    handleToggleSelect,
    loadParticipants,
    handleBulkCreatePlanGroups,
    getSelectedWithGroup,
    getSelectedWithoutGroup,
    handleBatchConfirm,
    handleBulkExclude,
    handleExcludeParticipant,
  } = useCampParticipantsLogic(templateId);

  // 일괄 작업 다이얼로그 상태
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState<
    "activate" | "status_change"
  >("activate");
  const [batchStatus, setBatchStatus] = useState<string>("active");
  const [bulkRecommendModalOpen, setBulkRecommendModalOpen] = useState(false);
  const [batchWizardOpen, setBatchWizardOpen] = useState(false);

  // 제외 다이얼로그 상태
  const [excludeDialogOpen, setExcludeDialogOpen] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<Participant | null>(null);
  const [isBulkExclude, setIsBulkExclude] = useState(false);

  // 일괄 작업 핸들러
  const handleBatchActivate = useCallback(() => {
    const selectedWithGroup = getSelectedWithGroup();
    if (selectedWithGroup.length === 0) {
      return;
    }
    setBatchOperationType("activate");
    setBatchStatus("active");
    setBatchDialogOpen(true);
  }, [getSelectedWithGroup]);

  const handleBatchStatusChange = useCallback((status: string) => {
    const selectedWithGroup = getSelectedWithGroup();
    if (selectedWithGroup.length === 0) {
      return;
    }
    setBatchOperationType("status_change");
    setBatchStatus(status);
    setBatchDialogOpen(true);
  }, [getSelectedWithGroup]);

  const handleBatchDialogConfirm = useCallback(async () => {
    await handleBatchConfirm(batchStatus, () => setBatchDialogOpen(false));
  }, [handleBatchConfirm, batchStatus]);

  // 일괄 제외 다이얼로그 열기
  const handleOpenBulkExcludeDialog = useCallback(() => {
    setIsBulkExclude(true);
    setExcludeTarget(null);
    setExcludeDialogOpen(true);
  }, []);

  // 개별 제외 다이얼로그 열기
  const handleOpenExcludeDialog = useCallback((participant: Participant) => {
    setIsBulkExclude(false);
    setExcludeTarget(participant);
    setExcludeDialogOpen(true);
  }, []);

  // 제외 확인
  const handleExcludeConfirm = useCallback(async () => {
    if (isBulkExclude) {
      await handleBulkExclude(() => setExcludeDialogOpen(false));
    } else if (excludeTarget) {
      await handleExcludeParticipant(excludeTarget.invitation_id, () => setExcludeDialogOpen(false));
    }
  }, [isBulkExclude, excludeTarget, handleBulkExclude, handleExcludeParticipant]);

  // 빠른 액션 핸들러
  const handleQuickAction = useCallback(
    (action: "bulk_plan" | "send_reminder" | "bulk_activate") => {
      switch (action) {
        case "bulk_plan":
          // 플랜 생성이 필요한 참여자들을 선택하고 배치 위저드 열기
          setBatchWizardOpen(true);
          break;
        case "send_reminder":
          // TODO: 리마인더 발송 기능 (향후 구현)
          alert("리마인더 발송 기능은 준비 중입니다.");
          break;
        case "bulk_activate":
          handleBatchActivate();
          break;
      }
    },
    [handleBatchActivate]
  );

  // C1 개선: 로딩 상태 - 캠프 참여자 전용 스켈레톤 사용
  if (loading) {
    return <CampParticipantsListSkeleton rowCount={8} />;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              참여자 목록
            </h1>
            <p className="text-sm text-gray-500">{templateName}</p>
          </div>
          <Link
            href={`/admin/camp-templates/${templateId}`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            템플릿으로 돌아가기
          </Link>
        </div>

        {/* 통합 대시보드 */}
        <CampOverviewDashboard
          templateId={templateId}
          stats={stats}
          participants={participants}
          needsActionParticipants={needsActionParticipants}
          onQuickAction={handleQuickAction}
          onReload={loadParticipants}
          isPending={isPending}
          selectedCount={selectedParticipantIds.size}
        />

        {/* 필터 및 일괄 작업 버튼 */}
        <ParticipantsToolbar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          selectedParticipantIds={selectedParticipantIds}
          participants={participants}
          isPending={isPending}
          onBulkCreatePlanGroups={handleBulkCreatePlanGroups}
          onBatchWizardOpen={() => setBatchWizardOpen(true)}
          onBulkRecommendOpen={() => setBulkRecommendModalOpen(true)}
          onBatchActivate={handleBatchActivate}
          onBatchStatusChange={handleBatchStatusChange}
          onBulkExclude={handleOpenBulkExcludeDialog}
        />

        {/* 참여자 목록 */}
        <ParticipantsTable
          templateId={templateId}
          filteredParticipants={filteredParticipants}
          selectedParticipantIds={selectedParticipantIds}
          sortBy={sortBy}
          sortOrder={sortOrder}
          loading={loading}
          lastLoadTimeRef={lastLoadTimeRef}
          onSort={handleSort}
          onSelectAll={handleSelectAll}
          onToggleSelect={handleToggleSelect}
          onReload={loadParticipants}
          onExclude={handleOpenExcludeDialog}
        />

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                총 {pagination.totalCount}명 중 {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}명 표시
              </span>
              <span className="text-gray-300">|</span>
              <label htmlFor="pageSize" className="sr-only">페이지당 항목 수</label>
              <select
                id="pageSize"
                value={pagination.pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={10}>10명</option>
                <option value={20}>20명</option>
                <option value={50}>50명</option>
                <option value={100}>100명</option>
              </select>
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              siblingCount={1}
              showFirstLast={true}
            />
          </div>
        )}

        {/* 일괄 설정 및 플랜 생성 위저드 */}
        <BatchPlanWizard
          open={batchWizardOpen}
          onOpenChange={setBatchWizardOpen}
          templateId={templateId}
          participants={getSelectedWithGroup().map((p) => ({
            groupId: p.plan_group_id!,
            studentId: p.student_id,
            studentName: p.student_name,
          }))}
          onSuccess={() => {
            // 약간의 지연을 두어 DB 동기화 시간 확보
            setTimeout(() => {
              loadParticipants();
            }, 500);
          }}
        />

        {/* 추천 콘텐츠 일괄 적용 모달 */}
        <BulkRecommendContentsModal
          open={bulkRecommendModalOpen}
          onOpenChange={setBulkRecommendModalOpen}
          templateId={templateId}
          participants={getSelectedWithGroup().map((p) => ({
            groupId: p.plan_group_id!,
            studentId: p.student_id,
            studentName: p.student_name,
          }))}
          onSuccess={() => {
            setTimeout(() => {
              loadParticipants();
            }, 500);
          }}
        />

        {/* 일괄 작업 다이얼로그 */}
        <BatchOperationDialog
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          operationType={batchOperationType}
          participantCount={selectedParticipantIds.size}
          status={batchStatus}
          onConfirm={handleBatchDialogConfirm}
          isPending={isPending}
        />

        {/* 참여자 제외 확인 다이얼로그 */}
        <Dialog
          open={excludeDialogOpen}
          onOpenChange={setExcludeDialogOpen}
          title={isBulkExclude ? "참여자 일괄 제외" : "참여자 제외"}
          description={
            isBulkExclude
              ? `선택한 ${selectedParticipantIds.size}명의 참여자를 캠프에서 제외하시겠습니까?`
              : `${excludeTarget?.student_name}님을 캠프에서 제외하시겠습니까?`
          }
          variant="destructive"
          maxWidth="md"
        >
          <div className="py-4">
            <p className="text-sm text-gray-700">
              {isBulkExclude ? (
                <>
                  선택한 참여자들의 초대가 삭제됩니다. 이미 생성된 플랜 그룹이 있는 경우
                  함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </>
              ) : (
                <>
                  해당 참여자의 초대가 삭제됩니다. 이미 생성된 플랜 그룹이 있는 경우
                  함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setExcludeDialogOpen(false)}
              disabled={isPending}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleExcludeConfirm}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "제외 중..." : "제외"}
            </button>
          </DialogFooter>
        </Dialog>
      </div>
    </section>
  );
}
