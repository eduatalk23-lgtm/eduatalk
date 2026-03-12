"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
  tableHeaderBase,
  tableRowHover,
} from "@/lib/utils/darkMode";
import { useToast } from "@/components/ui/ToastProvider";
import {
  cancelPaymentLinkAction,
  resendPaymentLinkAction,
} from "@/lib/domains/payment/paymentLink/actions";
import { PaymentLinkStatusBadge } from "@/app/(admin)/admin/students/[id]/_components/PaymentLinkStatusBadge";
import { SITE_URL } from "@/lib/constants/routes";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { MoreHorizontal } from "lucide-react";
import type { PaymentLinkListItem } from "@/lib/domains/payment/paymentLink/queries";

type PaymentLinksTableProps = {
  links: PaymentLinkListItem[];
  isLoading: boolean;
  onRefresh: () => void;
};

const DELIVERY_LABELS: Record<string, string> = {
  alimtalk: "알림톡",
  sms: "SMS",
  manual: "수동",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  sent: "발송됨",
  failed: "실패",
  skipped: "건너뜀",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelativeExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "만료됨";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}시간 남음`;
  const days = Math.floor(hours / 24);
  return `${days}일 남음`;
}

export function PaymentLinksTable({
  links,
  isLoading,
  onRefresh,
}: PaymentLinksTableProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleCancel = (linkId: string) => {
    setActioningId(linkId);
    startTransition(async () => {
      const result = await cancelPaymentLinkAction(linkId);
      setActioningId(null);
      if (result.success) {
        toast.showSuccess("링크가 취소되었습니다.");
        onRefresh();
      } else {
        toast.showError(result.error ?? "취소에 실패했습니다.");
      }
    });
  };

  const handleResend = (linkId: string) => {
    if (!confirm("결제 링크를 재발송하시겠습니까?")) return;
    setActioningId(linkId);
    startTransition(async () => {
      const result = await resendPaymentLinkAction(linkId);
      setActioningId(null);
      if (result.success) {
        toast.showSuccess("재발송되었습니다.");
        onRefresh();
      } else {
        toast.showError(result.error ?? "재발송에 실패했습니다.");
      }
    });
  };

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/pay/${token}`);
      toast.showSuccess("링크가 복사되었습니다.");
    } catch {
      toast.showError("복사에 실패했습니다.");
    }
  };

  if (isLoading && links.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border p-12",
          borderDefault,
          bgSurface
        )}
      >
        <p className={cn("text-sm", textSecondary)}>불러오는 중...</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border p-12",
          borderDefault,
          bgSurface
        )}
      >
        <p className={cn("text-sm", textSecondary)}>
          발송된 결제 링크가 없습니다.
        </p>
        <p className={cn("text-xs", textSecondary)}>
          학생 상세 페이지의 수납 내역에서 결제 링크를 발송하거나, 일괄 발송을
          이용하세요.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-x-auto rounded-lg border", borderDefault, bgSurface)}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className={cn(tableHeaderBase, "w-36")}>학생</th>
            <th className={cn(tableHeaderBase, "w-36")}>프로그램</th>
            <th className={cn(tableHeaderBase, "w-24 text-right")}>금액</th>
            <th className={cn(tableHeaderBase, "w-20")}>상태</th>
            <th className={cn(tableHeaderBase, "w-20")}>발송</th>
            <th className={cn(tableHeaderBase, "w-16 text-center")}>조회</th>
            <th className={cn(tableHeaderBase, "w-28")}>유효기간</th>
            <th className={cn(tableHeaderBase, "w-24")}>생성일</th>
            <th className={cn(tableHeaderBase, "w-16 text-right")}>액션</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const isActioning = actioningId === link.id;
            return (
              <tr
                key={link.id}
                className={cn(
                  "border-b border-gray-100 dark:border-gray-800",
                  tableRowHover,
                  isActioning && "opacity-50"
                )}
              >
                <td className={cn("px-3 py-2.5 text-xs", textPrimary)}>
                  {link.student_name}
                </td>
                <td className={cn("px-3 py-2.5 text-xs", textPrimary)}>
                  <span
                    className="inline-block max-w-[130px] truncate"
                    title={link.program_name}
                  >
                    {link.program_name}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right text-xs font-medium",
                    textPrimary
                  )}
                >
                  {link.amount.toLocaleString()}원
                </td>
                <td className="px-3 py-2.5">
                  <PaymentLinkStatusBadge
                    status={link.status}
                    deliveryStatus={link.delivery_status as import("@/lib/domains/payment/paymentLink/types").DeliveryStatus}
                  />
                </td>
                <td className={cn("px-3 py-2.5 text-xs", textSecondary)}>
                  <div className="flex flex-col">
                    <span>
                      {link.delivery_method
                        ? DELIVERY_LABELS[link.delivery_method] ?? link.delivery_method
                        : "-"}
                    </span>
                    <span className="text-[10px]">
                      {DELIVERY_STATUS_LABELS[link.delivery_status] ??
                        link.delivery_status}
                    </span>
                  </div>
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-center text-xs",
                    textSecondary
                  )}
                >
                  {link.view_count > 0 ? (
                    <span title={link.last_viewed_at ? `최근: ${formatDate(link.last_viewed_at)}` : ""}>
                      {link.view_count}회
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={cn("px-3 py-2.5 text-xs", textSecondary)}>
                  {link.status === "active" ? (
                    <span
                      className={
                        new Date(link.expires_at).getTime() - Date.now() <
                        24 * 60 * 60 * 1000
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {formatRelativeExpiry(link.expires_at)}
                    </span>
                  ) : link.paid_at ? (
                    <span className="text-green-600 dark:text-green-400">
                      {formatDate(link.paid_at)}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={cn("px-3 py-2.5 text-xs", textSecondary)}>
                  {formatDate(link.created_at)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end" className="min-w-[140px]">
                        <DropdownMenu.Item
                          onClick={() => handleCopyLink(link.token)}
                        >
                          링크 복사
                        </DropdownMenu.Item>
                        {link.status === "active" && (
                          <>
                            {link.recipient_phone && (
                              <DropdownMenu.Item
                                onClick={() => handleResend(link.id)}
                                disabled={isPending}
                              >
                                재발송
                              </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              onClick={() => handleCancel(link.id)}
                              disabled={isPending}
                              className="text-red-600 dark:text-red-400"
                            >
                              취소
                            </DropdownMenu.Item>
                          </>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
