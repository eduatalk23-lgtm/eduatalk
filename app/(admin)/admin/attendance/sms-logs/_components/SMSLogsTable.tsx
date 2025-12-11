"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import { maskPhoneNumber } from "@/app/(admin)/actions/smsLogActions";
import type { SMSLog } from "@/app/(admin)/actions/smsLogActions";

type SMSLogsTableProps = {
  logs: SMSLog[];
  loading?: boolean;
};

export function SMSLogsTable({ logs, loading }: SMSLogsTableProps) {
  const getStatusBadge = (status: SMSLog["status"]) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <Badge variant="success" size="xs">성공</Badge>;
      case "failed":
        return <Badge variant="error" size="xs">실패</Badge>;
      case "pending":
        return <Badge variant="info" size="xs">대기</Badge>;
      default:
        return <Badge variant="gray" size="xs">{status}</Badge>;
    }
  };

  const getSMSType = (message: string): string => {
    if (message.includes("입실")) return "입실";
    if (message.includes("퇴실")) return "퇴실";
    if (message.includes("결석")) return "결석";
    if (message.includes("지각")) return "지각";
    return "기타";
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-sm text-gray-500">로딩 중...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-sm text-gray-500">SMS 로그가 없습니다.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="SMS 발송 로그" />
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  발송 시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  학생명
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  수신자 번호
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  SMS 타입
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  메시지
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  에러
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatDateTime(log.sent_at || log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.student_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {maskPhoneNumber(log.recipient_phone)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {getSMSType(log.message_content)}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {log.message_content}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                    {log.error_message || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

