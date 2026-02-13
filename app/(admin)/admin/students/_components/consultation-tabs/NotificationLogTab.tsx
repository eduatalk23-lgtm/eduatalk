"use client";

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import {
  type ConsultationSchedule,
  type NotificationLogEntry,
  resolveNotificationTarget,
} from "@/lib/domains/consulting/types";
import type { StudentPhones } from "@/lib/domains/consulting/actions/fetchConsultationData";

type NotificationLogTabProps = {
  notificationLogs: Record<string, NotificationLogEntry[]>;
  schedules: ConsultationSchedule[];
  studentPhones: StudentPhones;
};

export function NotificationLogTab({
  notificationLogs,
  schedules,
  studentPhones,
}: NotificationLogTabProps) {
  // 전체 로그를 시간순으로 펼치기
  const allLogs: Array<NotificationLogEntry & { scheduleId: string }> = [];
  for (const [scheduleId, logs] of Object.entries(notificationLogs)) {
    for (const log of logs) {
      allLogs.push({ ...log, scheduleId });
    }
  }
  allLogs.sort((a, b) => {
    const dateA = a.sent_at ?? a.delivered_at ?? "";
    const dateB = b.sent_at ?? b.delivered_at ?? "";
    return dateB.localeCompare(dateA); // 최신순
  });

  if (allLogs.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <p className={cn("text-sm font-medium", textPrimary)}>
          알림 발송 이력이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              발송일시
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              채널
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              수신번호
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              대상
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              상태
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              결과코드
            </th>
            <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>
              연결 일정
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {allLogs.map((log) => {
            const schedule = schedules.find((s) => s.id === log.scheduleId);
            const scheduleLabel = schedule
              ? `${formatShortDate(schedule.scheduled_date)} ${schedule.session_type}`
              : "-";

            return (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className={cn("px-3 py-2 text-xs", textPrimary)}>
                  {formatLogDateTime(log.sent_at || log.delivered_at)}
                </td>
                <td className="px-3 py-2">
                  <ChannelBadge channel={log.channel} />
                </td>
                <td className={cn("px-3 py-2 text-xs", textSecondary)}>
                  {maskPhone(log.recipient_phone)}
                </td>
                <td className={cn("px-3 py-2 text-xs font-medium", textPrimary)}>
                  {log.notification_target ?? resolveNotificationTarget(log.recipient_phone, studentPhones)}
                </td>
                <td className="px-3 py-2">
                  <LogStatusBadge status={log.status} />
                </td>
                <td className={cn("px-3 py-2 text-xs font-mono", textSecondary)}>
                  {log.ppurio_result_code ?? "-"}
                </td>
                <td className={cn("px-3 py-2 text-xs", textPrimary)}>
                  {scheduleLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 헬퍼 ──

function ChannelBadge({ channel }: { channel: NotificationLogEntry["channel"] }) {
  const styles: Record<string, string> = {
    alimtalk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    friendtalk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    sms: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    lms: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  };
  const labels: Record<string, string> = { alimtalk: "알림톡", friendtalk: "친구톡", sms: "SMS", lms: "LMS" };
  const key = channel ?? "sms";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", styles[key] ?? styles.sms)}>
      {labels[key] ?? key}
    </span>
  );
}

function LogStatusBadge({ status }: { status: NotificationLogEntry["status"] }) {
  const config: Record<string, { label: string; style: string }> = {
    pending: { label: "대기", style: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    sent: { label: "발송됨", style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    delivered: { label: "전달됨", style: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    failed: { label: "실패", style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };
  const key = status ?? "pending";
  const c = config[key] ?? config.pending;
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", c.style)}>{c.label}</span>
  );
}

function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  if (phone.length < 8) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

function formatLogDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()];
  return `${m}/${day}(${w})`;
}
