"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderDefault } from "@/lib/utils/darkMode";
import {
  type ConsultationSchedule,
  type NotificationLogEntry,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  SESSION_TYPE_COLORS,
  type SessionType,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  type NotificationChannel,
  resolveNotificationTarget,
} from "@/lib/domains/consulting/types";
import {
  updateScheduleStatus,
  deleteConsultationSchedule,
} from "@/lib/domains/consulting/actions/schedule";
import type { PhoneAvailability } from "../../[id]/_components/ConsultationScheduleForm";
import { EditScheduleForm } from "../../[id]/_components/ConsultationScheduleList";
import type { ConsultingNoteRow, StudentPhones } from "@/lib/domains/consulting/actions/fetchConsultationData";

type EnrollmentOption = { id: string; program_name: string };
type ConsultantOption = { id: string; name: string };

type ScheduleTableTabProps = {
  schedules: ConsultationSchedule[];
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
  phoneAvailability: PhoneAvailability;
  notificationLogs: Record<string, NotificationLogEntry[]>;
  consultingNotes: ConsultingNoteRow[];
  currentUserId: string | null;
  studentPhones: StudentPhones;
  onRefresh: () => void;
  onCompleteWithNote?: (scheduleId: string) => void;
};

type SortKey = "scheduled_date" | "session_type" | "status";
type SortDir = "asc" | "desc";

export function ScheduleTableTab({
  schedules,
  studentId,
  consultants,
  enrollments,
  phoneAvailability,
  notificationLogs,
  consultingNotes,
  currentUserId,
  studentPhones,
  onRefresh,
  onCompleteWithNote,
}: ScheduleTableTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("scheduled_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = schedules.filter((s) =>
    statusFilter === "all" ? true : s.status === statusFilter
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "scheduled_date") {
      const cmp = a.scheduled_date.localeCompare(b.scheduled_date);
      return cmp === 0
        ? a.start_time.localeCompare(b.start_time) * dir
        : cmp * dir;
    }
    if (sortKey === "session_type") {
      return a.session_type.localeCompare(b.session_type) * dir;
    }
    return a.status.localeCompare(b.status) * dir;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2 text-left text-xs font-medium",
        textSecondary
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && (
          <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <p className={cn("text-sm font-medium", textPrimary)}>
          등록된 상담 일정이 없습니다.
        </p>
        <p className={cn("text-xs", textSecondary)}>
          위 폼에서 일정을 등록하면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 */}
      <div className="flex items-center gap-2">
        {["all", "scheduled", "completed", "cancelled", "no_show"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              statusFilter === s
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                : cn("hover:bg-gray-100 dark:hover:bg-gray-800", textSecondary)
            )}
          >
            {s === "all"
              ? `전체 (${schedules.length})`
              : `${SCHEDULE_STATUS_LABELS[s as keyof typeof SCHEDULE_STATUS_LABELS]} (${schedules.filter((sc) => sc.status === s).length})`}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className={cn("px-2 py-2 text-center text-xs font-medium w-10", textSecondary)}>NO.</th>
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>상태</th>
              <SortHeader label="상담일" field="scheduled_date" />
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>시간</th>
              <SortHeader label="유형" field="session_type" />
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>프로그램</th>
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>담당</th>
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>방문자</th>
              <th className={cn("px-3 py-2 text-left text-xs font-medium", textSecondary)}>등록일</th>
              <th className={cn("px-3 py-2 text-center text-xs font-medium", textSecondary)}>알림</th>
              <th className={cn("px-3 py-2 text-center text-xs font-medium", textSecondary)}>노트</th>
              <th className={cn("px-3 py-2 text-right text-xs font-medium", textSecondary)}>액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((schedule, index) => {
              const logs = notificationLogs[schedule.id] ?? [];
              const linkedNotes = consultingNotes.filter(
                (n) => n.consultation_schedule_id === schedule.id
              );
              const isExpanded = expandedId === schedule.id;

              return (
                <ScheduleRow
                  key={schedule.id}
                  rowIndex={index + 1}
                  schedule={schedule}
                  studentId={studentId}
                  consultants={consultants}
                  enrollments={enrollments}
                  phoneAvailability={phoneAvailability}
                  logs={logs}
                  linkedNotes={linkedNotes}
                  studentPhones={studentPhones}
                  isExpanded={isExpanded}
                  onToggleExpand={() =>
                    setExpandedId(isExpanded ? null : schedule.id)
                  }
                  onRefresh={onRefresh}
                  onCompleteWithNote={onCompleteWithNote}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RowMode = "view" | "edit" | "confirmCancel" | "confirmDelete";

function ScheduleRow({
  rowIndex,
  schedule,
  studentId,
  consultants,
  enrollments,
  phoneAvailability,
  logs,
  linkedNotes,
  studentPhones,
  isExpanded,
  onToggleExpand,
  onRefresh,
  onCompleteWithNote,
}: {
  rowIndex: number;
  schedule: ConsultationSchedule;
  studentId: string;
  consultants: { id: string; name: string }[];
  enrollments: { id: string; program_name: string }[];
  phoneAvailability: PhoneAvailability;
  logs: NotificationLogEntry[];
  linkedNotes: ConsultingNoteRow[];
  studentPhones: StudentPhones;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRefresh: () => void;
  onCompleteWithNote?: (scheduleId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showActions, setShowActions] = useState(false);
  const [mode, setMode] = useState<RowMode>("view");
  const [cancelChannel, setCancelChannel] = useState<NotificationChannel>("alimtalk");

  const sessionType = schedule.session_type as SessionType;
  const sessionColor =
    SESSION_TYPE_COLORS[sessionType] ?? SESSION_TYPE_COLORS["기타"];
  const statusColor = SCHEDULE_STATUS_COLORS[schedule.status];
  const statusLabel = SCHEDULE_STATUS_LABELS[schedule.status];

  const dateStr = formatShortDate(schedule.scheduled_date);
  const timeStr = `${schedule.start_time.slice(0, 5)}~${schedule.end_time.slice(0, 5)}`;

  function handleAction(action: "completed" | "no_show" | "cancelled" | "delete") {
    if (action === "cancelled") {
      setMode("confirmCancel");
      setShowActions(false);
      return;
    }
    if (action === "delete") {
      setMode("confirmDelete");
      setShowActions(false);
      return;
    }
    startTransition(async () => {
      await updateScheduleStatus(schedule.id, action, studentId);
      setShowActions(false);
      onRefresh();
      if (action === "completed" && onCompleteWithNote) {
        onCompleteWithNote(schedule.id);
      }
    });
  }

  function handleCancel(sendNotification: boolean, channel?: NotificationChannel) {
    startTransition(async () => {
      await updateScheduleStatus(schedule.id, "cancelled", studentId, sendNotification, channel);
      setMode("view");
      onRefresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteConsultationSchedule({ scheduleId: schedule.id, studentId });
      setMode("view");
      onRefresh();
    });
  }

  // 수정 모드: 테이블 행 대신 EditScheduleForm 렌더
  if (mode === "edit") {
    return (
      <tr>
        <td colSpan={12} className="p-3">
          <EditScheduleForm
            schedule={schedule}
            studentId={studentId}
            consultants={consultants}
            enrollments={enrollments}
            phoneAvailability={phoneAvailability}
            onCancel={() => setMode("view")}
            onSuccess={onRefresh}
          />
        </td>
      </tr>
    );
  }

  const showExpandedArea = isExpanded || mode === "confirmCancel" || mode === "confirmDelete";

  return (
    <>
      <tr
        className={cn(
          "cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/50",
          showExpandedArea && "bg-indigo-50/50 dark:bg-indigo-900/10"
        )}
        onClick={onToggleExpand}
      >
        <td className={cn("px-2 py-2 text-center text-xs", textSecondary)}>{rowIndex}</td>
        <td className="px-3 py-2">
          <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", statusColor)}>
            {statusLabel}
          </span>
        </td>
        <td className={cn("px-3 py-2 text-sm", textPrimary)}>{dateStr}</td>
        <td className={cn("px-3 py-2 text-sm", textPrimary)}>{timeStr}</td>
        <td className="px-3 py-2">
          <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", sessionColor)}>
            {sessionType}
          </span>
        </td>
        <td className={cn("px-3 py-2 text-sm", textPrimary)}>
          {schedule.program_name || "-"}
        </td>
        <td className={cn("px-3 py-2 text-sm", textSecondary)}>
          {schedule.consultant_name ?? "-"}
        </td>
        <td className={cn("px-3 py-2 text-sm", textSecondary)}>
          {schedule.visitor || "-"}
        </td>
        <td className={cn("px-3 py-2 text-xs", textSecondary)}>
          {formatShortDate2(schedule.created_at)}
        </td>
        <td className="px-3 py-2 text-center">
          {logs.length > 0 ? (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              {logs.length}건
            </span>
          ) : (
            <span className={cn("text-xs", textSecondary)}>-</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {linkedNotes.length > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {linkedNotes.length}건
            </span>
          ) : (
            <span className={cn("text-xs", textSecondary)}>-</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {schedule.status === "scheduled" && (
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                disabled={isPending}
                className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {isPending ? "..." : "..."}
              </button>
              {showActions && (
                <div className="absolute right-0 z-10 mt-1 w-28 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => { setMode("edit"); setShowActions(false); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("completed")}
                    className="w-full px-3 py-1.5 text-left text-xs text-green-700 hover:bg-green-50 dark:text-green-400"
                  >
                    완료
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("no_show")}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-700 hover:bg-red-50 dark:text-red-400"
                  >
                    미참석
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction("cancelled")}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400"
                  >
                    취소
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button
                    type="button"
                    onClick={() => handleAction("delete")}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* 확장 영역: 확인 다이얼로그 / 알림 이력 + 노트 */}
      {showExpandedArea && (
        <tr>
          <td colSpan={12} className="bg-gray-50/50 px-4 py-3 dark:bg-gray-800/30">
            <div className="flex flex-col gap-3">
              {/* 취소 확인 */}
              {mode === "confirmCancel" && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <span className={cn("text-xs font-medium", textPrimary)}>
                    이 일정을 취소하시겠습니까?
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn("text-xs font-medium", textSecondary)}>발송 채널</span>
                    {NOTIFICATION_CHANNELS.map((ch) => (
                      <label key={ch} className="flex items-center gap-1">
                        <input
                          type="radio"
                          checked={cancelChannel === ch}
                          onChange={() => setCancelChannel(ch)}
                          className="h-3.5 w-3.5 border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className={cn("text-xs", textSecondary)}>
                          {NOTIFICATION_CHANNEL_LABELS[ch]}
                        </span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleCancel(true, cancelChannel)}
                      disabled={isPending}
                      className="ml-auto rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
                    >
                      {isPending ? "취소 중..." : "취소 + 알림"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(false)}
                      disabled={isPending}
                      className="rounded bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      알림 없이 취소
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("view")}
                      disabled={isPending}
                      className="rounded px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400"
                    >
                      돌아가기
                    </button>
                  </div>
                </div>
              )}

              {/* 삭제 확인 */}
              {mode === "confirmDelete" && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <span className={cn("text-xs font-medium", textPrimary)}>
                    이 일정을 삭제하시겠습니까? (알림 없이 레코드가 삭제됩니다)
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
                  >
                    {isPending ? "삭제 중..." : "삭제"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    disabled={isPending}
                    className="rounded px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400"
                  >
                    취소
                  </button>
                </div>
              )}

              {/* 상세 정보 (확장 시) */}
              {isExpanded && (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {schedule.consultation_mode === "원격" && (
                      <span className={cn("text-xs", textSecondary)}>방식: 원격</span>
                    )}
                    {schedule.location && (
                      <span className={cn("text-xs", textSecondary)}>장소: {schedule.location}</span>
                    )}
                    {schedule.meeting_link && (
                      <a
                        href={schedule.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        참가 링크
                      </a>
                    )}
                    {schedule.description && (
                      <span className={cn("text-xs", textSecondary)}>메모: {schedule.description}</span>
                    )}
                  </div>

                  {/* 알림 이력 */}
                  {logs.length > 0 && (
                    <div>
                      <h4 className={cn("mb-1 text-xs font-semibold", textPrimary)}>
                        알림 이력 ({logs.length}건)
                      </h4>
                      <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 dark:bg-gray-800/60">
                            <tr>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>발송일시</th>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>채널</th>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>수신번호</th>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>대상</th>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>상태</th>
                              <th className={cn("px-2 py-1.5 text-left font-medium", textSecondary)}>결과코드</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {logs.map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className={cn("px-2 py-1.5", textSecondary)}>
                                  {formatLogDateTime(log.sent_at || log.delivered_at)}
                                </td>
                                <td className="px-2 py-1.5">
                                  <ChannelBadge channel={log.channel} />
                                </td>
                                <td className={cn("px-2 py-1.5", textSecondary)}>
                                  {maskPhone(log.recipient_phone)}
                                </td>
                                <td className={cn("px-2 py-1.5 font-medium", textPrimary)}>
                                  {log.notification_target ?? resolveNotificationTarget(log.recipient_phone, studentPhones)}
                                </td>
                                <td className="px-2 py-1.5">
                                  <LogStatusBadge status={log.status} />
                                </td>
                                <td className={cn("px-2 py-1.5 font-mono", textSecondary)}>
                                  {log.ppurio_result_code ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 연결된 노트 */}
                  {linkedNotes.length > 0 && (
                    <div>
                      <h4 className={cn("mb-1 text-xs font-semibold", textPrimary)}>
                        상담 노트 ({linkedNotes.length}건)
                      </h4>
                      {linkedNotes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-900/20"
                        >
                          <p className={cn("whitespace-pre-wrap", textPrimary)}>{note.note}</p>
                          {note.next_action && (
                            <p className="mt-1 text-amber-700 dark:text-amber-400">
                              후속: {note.next_action}
                              {note.follow_up_date && ` (${note.follow_up_date})`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {logs.length === 0 && linkedNotes.length === 0 && (
                    <p className={cn("text-xs", textSecondary)}>알림 이력 및 노트 없음</p>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── 헬퍼 컴포넌트 ──

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
  if (!dateStr) return "";
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

function formatShortDate2(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}
