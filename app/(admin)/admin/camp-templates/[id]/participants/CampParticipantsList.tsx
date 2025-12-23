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
import type { CampParticipantsListProps } from "./_components/types";

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
    setStatusFilter,
    handleSort,
    handleSelectAll,
    handleToggleSelect,
    loadParticipants,
    handleBulkCreatePlanGroups,
    getSelectedWithGroup,
    getSelectedWithoutGroup,
    handleBatchConfirm,
  } = useCampParticipantsLogic(templateId);

  // 일괄 작업 다이얼로그 상태
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState<
    "activate" | "status_change"
  >("activate");
  const [batchStatus, setBatchStatus] = useState<string>("active");
  const [bulkRecommendModalOpen, setBulkRecommendModalOpen] = useState(false);
  const [batchWizardOpen, setBatchWizardOpen] = useState(false);

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

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="text-sm text-gray-500">
          참여자 목록을 불러오는 중...
        </div>
      </section>
    );
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
          stats={stats}
          participants={participants}
          needsActionParticipants={needsActionParticipants}
          onQuickAction={handleQuickAction}
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
        />

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
      </div>
    </section>
  );
}
