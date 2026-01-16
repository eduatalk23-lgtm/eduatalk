"use client";

/**
 * 신고 목록 테이블 컴포넌트
 */

import type { ChatReport, ReportStatus, ReportReason } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";
import { Eye, Loader2 } from "lucide-react";

interface ReportTableProps {
  reports: ChatReport[];
  onViewDetails: (report: ChatReport) => void;
  isLoadingDetails: boolean;
}

// 상태별 스타일
const STATUS_STYLES: Record<ReportStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-warning/10", text: "text-warning", label: "대기중" },
  reviewed: { bg: "bg-info/10", text: "text-info", label: "검토중" },
  resolved: { bg: "bg-success/10", text: "text-success", label: "승인됨" },
  dismissed: { bg: "bg-text-tertiary/10", text: "text-text-tertiary", label: "기각됨" },
};

// 사유별 스타일
const REASON_STYLES: Record<ReportReason, { bg: string; text: string; label: string }> = {
  spam: { bg: "bg-error/10", text: "text-error", label: "스팸" },
  harassment: { bg: "bg-warning/10", text: "text-warning", label: "괴롭힘" },
  inappropriate: { bg: "bg-warning/10", text: "text-warning", label: "부적절" },
  hate_speech: { bg: "bg-error/10", text: "text-error", label: "혐오 발언" },
  other: { bg: "bg-text-tertiary/10", text: "text-text-tertiary", label: "기타" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportTable({
  reports,
  onViewDetails,
  isLoadingDetails,
}: ReportTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              신고일시
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              사유
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              상태
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">
              설명
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">
              액션
            </th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const statusStyle = STATUS_STYLES[report.status];
            const reasonStyle = REASON_STYLES[report.reason];

            return (
              <tr
                key={report.id}
                className="border-b border-border hover:bg-bg-secondary/50 transition-colors"
              >
                {/* 신고일시 */}
                <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                  {formatDate(report.created_at)}
                </td>

                {/* 사유 */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                      reasonStyle.bg,
                      reasonStyle.text
                    )}
                  >
                    {reasonStyle.label}
                  </span>
                </td>

                {/* 상태 */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                      statusStyle.bg,
                      statusStyle.text
                    )}
                  >
                    {statusStyle.label}
                  </span>
                </td>

                {/* 설명 */}
                <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
                  {report.description || "-"}
                </td>

                {/* 액션 */}
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onViewDetails(report)}
                    disabled={isLoadingDetails}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 text-sm",
                      "bg-primary text-white rounded-lg",
                      "hover:bg-primary-hover transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isLoadingDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    상세
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
