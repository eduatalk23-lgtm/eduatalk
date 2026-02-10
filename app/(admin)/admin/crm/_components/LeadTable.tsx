"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  getGrayBgClasses,
  divideDefaultVar,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { LEAD_SOURCE_LABELS } from "@/lib/domains/crm/constants";
import type { SalesLeadWithRelations } from "@/lib/domains/crm/types";
import { PipelineStatusBadge } from "./PipelineStatusBadge";
import { QualityBadge } from "./QualityBadge";
import type { QualityLevel } from "@/lib/domains/crm/types";

type LeadTableProps = {
  leads: SalesLeadWithRelations[];
};

export function LeadTable({ leads }: LeadTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg shadow-sm bg-white dark:bg-gray-900">
      <table className="w-full">
        <thead className={getGrayBgClasses("tableHeader")}>
          <tr>
            <th className={tableHeaderBase}>문의자</th>
            <th className={tableHeaderBase}>학생</th>
            <th className={tableHeaderBase}>연락처</th>
            <th className={tableHeaderBase}>유입경로</th>
            <th className={tableHeaderBase}>프로그램</th>
            <th className={tableHeaderBase}>상태</th>
            <th className={tableHeaderBase}>품질</th>
            <th className={tableHeaderBase}>담당자</th>
            <th className={tableHeaderBase}>문의일</th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {leads.map((lead) => (
            <tr key={lead.id} className={tableRowBase}>
              <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                <Link
                  href={`/admin/crm/leads/${lead.id}`}
                  className="hover:underline"
                >
                  {lead.contact_name}
                </Link>
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {lead.student_name ?? "-"}
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {lead.contact_phone ?? "-"}
              </td>
              <td className={tableCellBase}>
                <span className="text-xs">
                  {LEAD_SOURCE_LABELS[lead.lead_source as keyof typeof LEAD_SOURCE_LABELS] ??
                    lead.lead_source}
                </span>
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {lead.program?.name ?? "-"}
              </td>
              <td className={tableCellBase}>
                <PipelineStatusBadge
                  status={lead.pipeline_status as Parameters<typeof PipelineStatusBadge>[0]["status"]}
                />
              </td>
              <td className={tableCellBase}>
                <QualityBadge level={lead.quality_level as QualityLevel | null} />
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {lead.assigned_admin?.name ?? "-"}
              </td>
              <td className={cn(tableCellBase, textSecondary)}>
                {lead.inquiry_date
                  ? new Date(lead.inquiry_date).toLocaleDateString("ko-KR")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
