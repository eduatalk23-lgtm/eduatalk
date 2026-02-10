"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_ORDER,
  LEAD_SOURCE_LABELS,
} from "@/lib/domains/crm/constants";
import { updatePipelineStatus } from "@/lib/domains/crm/actions/pipeline";
import type { PipelineStatus, SalesLeadWithRelations } from "@/lib/domains/crm/types";
import { QualityBadge } from "./QualityBadge";
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
} from "@/lib/utils/darkMode";

const columnBorderColors: Record<PipelineStatus, string> = {
  new: "border-t-blue-500",
  contacted: "border-t-cyan-500",
  consulting_done: "border-t-teal-500",
  follow_up: "border-t-amber-500",
  registration_in_progress: "border-t-purple-500",
  converted: "border-t-emerald-500",
  lost: "border-t-red-500",
  spam: "border-t-gray-400",
};

type PipelineBoardProps = {
  leadsByStatus: Record<string, SalesLeadWithRelations[]>;
};

export function PipelineBoard({ leadsByStatus }: PipelineBoardProps) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: `${PIPELINE_STATUS_ORDER.length * 296}px` }}>
        {PIPELINE_STATUS_ORDER.map((status) => (
          <PipelineColumn
            key={status}
            status={status}
            leads={leadsByStatus[status] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineColumn({
  status,
  leads,
}: {
  status: PipelineStatus;
  leads: SalesLeadWithRelations[];
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-t-4",
        borderDefaultVar,
        bgSurfaceVar,
        columnBorderColors[status],
        "min-w-[280px] w-[280px]"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className={cn("text-sm font-semibold", textPrimaryVar)}>
          {PIPELINE_STATUS_LABELS[status]}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "60vh" }}>
        {leads.map((lead) => (
          <PipelineCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function PipelineCard({ lead }: { lead: SalesLeadWithRelations }) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();

  const daysSinceInquiry = useMemo(() => {
    if (!lead.inquiry_date) return null;
    const now = new Date();
    return Math.floor(
      (now.getTime() - new Date(lead.inquiry_date).getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [lead.inquiry_date]);

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

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        borderDefaultVar,
        bgSurfaceVar,
        isPending && "opacity-60",
        "hover:shadow-sm"
      )}
    >
      <Link href={`/admin/crm/leads/${lead.id}`} className="block">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-medium truncate", textPrimaryVar)}>
              {lead.contact_name}
            </span>
            <QualityBadge level={lead.quality_level as "hot" | "warm" | "cold" | null} />
          </div>

          {lead.contact_phone && (
            <span className={cn("text-xs", textSecondaryVar)}>{lead.contact_phone}</span>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs",
                "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              {LEAD_SOURCE_LABELS[lead.lead_source as keyof typeof LEAD_SOURCE_LABELS] ??
                lead.lead_source}
            </span>
            {lead.assigned_admin?.name && (
              <span className={cn("text-xs", textSecondaryVar)}>
                {lead.assigned_admin.name}
              </span>
            )}
            {daysSinceInquiry !== null && daysSinceInquiry > 0 && (
              <span
                className={cn(
                  "text-xs",
                  daysSinceInquiry > 7
                    ? "text-red-500 dark:text-red-400"
                    : textSecondaryVar
                )}
              >
                {daysSinceInquiry}일 전
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <select
          value={lead.pipeline_status}
          onChange={(e) => handleStatusChange(e.target.value as PipelineStatus)}
          disabled={isPending}
          className={cn(
            "w-full rounded border px-2 py-1 text-xs",
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
      </div>
    </div>
  );
}
