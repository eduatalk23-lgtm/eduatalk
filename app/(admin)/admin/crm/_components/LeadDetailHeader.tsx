"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import {
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_ORDER,
} from "@/lib/domains/crm/constants";
import {
  updatePipelineStatus,
  assignLead,
} from "@/lib/domains/crm/actions/pipeline";
import { markAsSpam, deleteLead } from "@/lib/domains/crm/actions/leads";
import type {
  SalesLeadWithRelations,
  PipelineStatus,
  QualityLevel,
} from "@/lib/domains/crm/types";
import { PipelineStatusBadge } from "./PipelineStatusBadge";
import { QualityBadge } from "./QualityBadge";
import { ConvertLeadDialog } from "./ConvertLeadDialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

type LeadDetailHeaderProps = {
  lead: SalesLeadWithRelations;
  adminUsers: { id: string; name: string }[];
};

export function LeadDetailHeader({ lead, adminUsers }: LeadDetailHeaderProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const [showSpamConfirm, setShowSpamConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(lead.assigned_to ?? "");

  const totalScore = (lead.fit_score ?? 0) + (lead.engagement_score ?? 0);

  const handleStatusChange = (newStatus: PipelineStatus) => {
    startTransition(async () => {
      const result = await updatePipelineStatus(lead.id, newStatus);
      if (result.success) {
        showSuccess("상태가 변경되었습니다.");
      } else {
        showError(result.error ?? "상태 변경에 실패했습니다.");
      }
    });
  };

  const handleSpam = () => {
    startTransition(async () => {
      const result = await markAsSpam(lead.id);
      if (result.success) {
        showSuccess("스팸 처리되었습니다.");
        setShowSpamConfirm(false);
      } else {
        showError(result.error ?? "스팸 처리에 실패했습니다.");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteLead(lead.id);
      if (result.success) {
        showSuccess("리드가 삭제되었습니다.");
        router.push("/admin/crm/leads");
      } else {
        showError(result.error ?? "삭제에 실패했습니다.");
      }
    });
  };

  const handleAssign = () => {
    startTransition(async () => {
      const result = await assignLead(lead.id, selectedAdmin || null);
      if (result.success) {
        showSuccess("담당자가 변경되었습니다.");
        setShowAssign(false);
      } else {
        showError(result.error ?? "담당자 배정에 실패했습니다.");
      }
    });
  };

  return (
    <>
      <div
        className={cn(
          "rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className={cn("text-h2", textPrimaryVar)}>
                {lead.contact_name}
              </h2>
              <PipelineStatusBadge
                status={lead.pipeline_status as PipelineStatus}
              />
              <QualityBadge level={lead.quality_level as QualityLevel | null} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {lead.contact_phone && (
                <span className={cn("text-sm", textSecondaryVar)}>
                  {lead.contact_phone}
                </span>
              )}
              {lead.student_name && (
                <span className={cn("text-sm", textSecondaryVar)}>
                  학생: {lead.student_name}
                </span>
              )}
              {lead.assigned_admin?.name && (
                <span className={cn("text-sm", textSecondaryVar)}>
                  담당: {lead.assigned_admin.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={textSecondaryVar}>
                적합도: {lead.fit_score ?? 0}
              </span>
              <span className={textSecondaryVar}>
                참여도: {lead.engagement_score ?? 0}
              </span>
              <span className={cn("font-semibold", textPrimaryVar)}>
                종합: {totalScore}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={lead.pipeline_status}
              onChange={(e) =>
                handleStatusChange(e.target.value as PipelineStatus)
              }
              disabled={isPending}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm",
                borderDefaultVar,
                bgSurfaceVar,
                textPrimaryVar
              )}
            >
              {PIPELINE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssign(true)}
            >
              담당자
            </Button>

            {lead.pipeline_status !== "converted" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowConvert(true)}
              >
                등록 전환
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSpamConfirm(true)}
            >
              스팸
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              삭제
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showSpamConfirm}
        onOpenChange={setShowSpamConfirm}
        title="스팸으로 처리하시겠습니까?"
        description="이 리드는 스팸으로 분류되고 파이프라인에서 제외됩니다."
        onConfirm={handleSpam}
        variant="destructive"
        isLoading={isPending}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="정말 삭제하시겠습니까?"
        description="이 리드와 관련된 모든 활동 및 태스크가 삭제됩니다."
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isPending}
      />

      <ConvertLeadDialog
        open={showConvert}
        onOpenChange={setShowConvert}
        lead={lead}
      />

      <Dialog
        open={showAssign}
        onOpenChange={setShowAssign}
        title="담당자 배정"
        size="sm"
      >
        <DialogContent>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm",
              borderDefaultVar,
              bgSurfaceVar,
              textPrimaryVar
            )}
          >
            <option value="">미배정</option>
            {adminUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowAssign(false)}
            disabled={isPending}
          >
            취소
          </Button>
          <Button variant="primary" onClick={handleAssign} isLoading={isPending}>
            저장
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
