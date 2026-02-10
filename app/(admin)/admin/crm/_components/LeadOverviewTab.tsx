"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import {
  PIPELINE_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
} from "@/lib/domains/crm/constants";
import { updateRegistrationChecklist } from "@/lib/domains/crm/actions/pipeline";
import type {
  SalesLeadWithRelations,
  Program,
  RegistrationChecklist,
  PipelineStatus,
} from "@/lib/domains/crm/types";
import { LeadFormDialog } from "./LeadFormDialog";

type LeadOverviewTabProps = {
  lead: SalesLeadWithRelations;
  programs: Program[];
  adminUsers: { id: string; name: string }[];
  resolvedSchoolName?: string | null;
};

function formatCrmGrade(grade: number | null | undefined): string | null {
  if (grade == null) return null;
  if (grade >= 7 && grade <= 9) {
    return `중등부 ${grade - 6}학년`;
  }
  if (grade >= 10 && grade <= 12) {
    return `고등부 ${grade - 9}학년`;
  }
  return `${grade}`;
}

const CHECKLIST_ITEMS: { key: keyof RegistrationChecklist; label: string }[] = [
  { key: "registered", label: "등록 완료" },
  { key: "documents", label: "서류 제출" },
  { key: "sms_sent", label: "SMS 발송" },
  { key: "payment", label: "결제 완료" },
];

export function LeadOverviewTab({
  lead,
  programs,
  adminUsers,
  resolvedSchoolName,
}: LeadOverviewTabProps) {
  const { showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);

  const checklist = (lead.registration_checklist as RegistrationChecklist) ?? {
    registered: false,
    documents: false,
    sms_sent: false,
    payment: false,
  };

  const handleChecklistToggle = (key: keyof RegistrationChecklist) => {
    startTransition(async () => {
      const result = await updateRegistrationChecklist(lead.id, {
        [key]: !checklist[key],
      });
      if (!result.success) {
        showError(result.error ?? "업데이트에 실패했습니다.");
      }
    });
  };

  const infoItems: { label: string; value: string | null }[] = [
    { label: "문의자", value: lead.contact_name },
    { label: "연락처", value: lead.contact_phone },
    { label: "학생명", value: lead.student_name },
    { label: "학년", value: formatCrmGrade(lead.student_grade) },
    { label: "학교", value: resolvedSchoolName ?? lead.student_school_name },
    {
      label: "유입경로",
      value:
        LEAD_SOURCE_LABELS[
          lead.lead_source as keyof typeof LEAD_SOURCE_LABELS
        ] ?? lead.lead_source,
    },
    { label: "프로그램", value: lead.program?.name ?? null },
    {
      label: "상태",
      value:
        PIPELINE_STATUS_LABELS[lead.pipeline_status as PipelineStatus] ??
        lead.pipeline_status,
    },
    { label: "담당자", value: lead.assigned_admin?.name ?? null },
    {
      label: "문의일",
      value: lead.inquiry_date
        ? new Date(lead.inquiry_date).toLocaleDateString("ko-KR")
        : null,
    },
    {
      label: "전환일",
      value: lead.converted_at
        ? new Date(lead.converted_at).toLocaleDateString("ko-KR")
        : null,
    },
    { label: "비고", value: lead.notes },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn("text-sm font-semibold", textPrimaryVar)}>
            리드 정보
          </h3>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            수정
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {infoItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className={cn("text-xs", textSecondaryVar)}>
                {item.label}
              </span>
              <span className={cn("text-sm", textPrimaryVar)}>
                {item.value ?? "-"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {lead.pipeline_status === "registration_in_progress" && (
        <div
          className={cn(
            "rounded-lg border p-4",
            borderDefaultVar,
            bgSurfaceVar
          )}
        >
          <h3 className={cn("text-sm font-semibold mb-3", textPrimaryVar)}>
            등록 체크리스트
          </h3>
          <div className="flex flex-col gap-2">
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={() => handleChecklistToggle(item.key)}
                  disabled={isPending}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className={cn("text-sm", textPrimaryVar)}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <LeadFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        lead={lead}
        programs={programs}
        adminUsers={adminUsers}
        displaySchoolName={resolvedSchoolName}
      />
    </div>
  );
}
