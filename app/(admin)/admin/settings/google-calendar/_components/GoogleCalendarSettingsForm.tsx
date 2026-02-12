"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  syncEnabled: boolean;
}

interface QueueStats {
  pending: number;
  failed: number;
  completed: number;
}

interface Props {
  connectionStatus: ConnectionStatus;
  queueStats: QueueStats;
  isAdmin: boolean;
}

export default function GoogleCalendarSettingsForm({
  connectionStatus,
  queueStats,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState(
    connectionStatus.calendarId
  );
  const [calendars, setCalendars] = useState<
    Array<{ id: string; summary: string; primary: boolean }>
  >([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const handleConnect = () => {
    window.location.href = "/api/auth/google?target=personal";
  };

  const handleDisconnect = async () => {
    if (!confirm("Google Calendar 연결을 해제하시겠습니까?")) return;

    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/google-calendar/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLoadCalendars = async () => {
    setLoadingCalendars(true);
    try {
      const res = await fetch("/api/admin/google-calendar/calendars");
      if (res.ok) {
        const data = await res.json();
        setCalendars(data.calendars ?? []);
      }
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handleCalendarChange = async (calendarId: string) => {
    setSelectedCalendar(calendarId);
    // TODO: API로 캘린더 ID 업데이트 (Phase 2에서 추가)
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 내 캘린더 연결 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h2 className="text-h2 text-gray-900 dark:text-gray-100">
          내 캘린더 연결
        </h2>

        {connectionStatus.connected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  연결됨
                </p>
                {connectionStatus.googleEmail && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {connectionStatus.googleEmail}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  연결 일시
                </span>
                <p className="text-gray-900 dark:text-gray-100">
                  {connectionStatus.connectedAt
                    ? new Date(connectionStatus.connectedAt).toLocaleDateString(
                        "ko-KR"
                      )
                    : "-"}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  마지막 동기화
                </span>
                <p className="text-gray-900 dark:text-gray-100">
                  {connectionStatus.lastSyncAt
                    ? new Date(connectionStatus.lastSyncAt).toLocaleDateString(
                        "ko-KR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "아직 없음"}
                </p>
              </div>
            </div>

            {/* 캘린더 선택 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  동기화 캘린더
                </label>
                <button
                  onClick={handleLoadCalendars}
                  disabled={loadingCalendars}
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  {loadingCalendars ? "로딩..." : "캘린더 목록 불러오기"}
                </button>
              </div>
              {calendars.length > 0 ? (
                <select
                  value={selectedCalendar}
                  onChange={(e) => handleCalendarChange(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary}
                      {cal.primary ? " (기본)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  현재 캘린더: {selectedCalendar === "primary" ? "기본 캘린더" : selectedCalendar}
                </p>
              )}
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {disconnecting ? "해제 중..." : "연결 해제"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Google Calendar를 연결하면 상담 일정이 자동으로 동기화됩니다.
            </p>
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google Calendar 연결
            </button>
          </div>
        )}
      </div>

      {/* 동기화 현황 (admin only) */}
      {isAdmin && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            동기화 현황
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {queueStats.pending}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                대기 중
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {queueStats.failed}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">실패</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {queueStats.completed}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                완료
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 돌아가기 */}
      <div>
        <Link
          href="/admin/settings"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          &larr; 설정으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
