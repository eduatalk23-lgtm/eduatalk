"use client";

import { useState, useEffect } from "react";
import {
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
  type UserSession,
} from "@/lib/auth/sessionManager";

export function DeviceManagement() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserSessions();
      setSessions(data);
    } catch (err) {
      console.error("세션 로드 실패:", err);
      setError("세션 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("이 기기에서 로그아웃하시겠습니까?")) {
      return;
    }

    try {
      setRevokingSessionId(sessionId);
      const result = await revokeSession(sessionId);

      if (result.success) {
        // 현재 세션이 삭제된 경우 로그인 페이지로 리다이렉트
        const deletedSession = sessions.find((s) => s.id === sessionId);
        if (deletedSession?.is_current_session) {
          window.location.href = "/login";
          return;
        }

        // 세션 목록 새로고침
        await loadSessions();
      } else {
        setError(result.error || "세션 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("세션 삭제 실패:", err);
      setError("세션 삭제 중 오류가 발생했습니다.");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (
      !confirm(
        "현재 기기를 제외한 모든 기기에서 로그아웃하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    try {
      setRevokingAll(true);
      setError(null);
      const result = await revokeAllOtherSessions();

      if (result.success) {
        await loadSessions();
        alert(
          `${result.revokedCount || 0}개의 기기에서 로그아웃되었습니다.`
        );
      } else {
        setError(result.error || "세션 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("세션 일괄 삭제 실패:", err);
      setError("세션 삭제 중 오류가 발생했습니다.");
    } finally {
      setRevokingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 7) return `${diffDays}일 전`;

      // 일주일 이상이면 날짜 표시
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const currentSession = sessions.find((s) => s.is_current_session);
  const otherSessions = sessions.filter((s) => !s.is_current_session);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          로그인 기기 관리
        </h2>
        <p className="text-sm text-gray-600">
          로그인한 기기 목록을 확인하고 관리할 수 있습니다. 의심스러운 기기가
          있다면 즉시 로그아웃하세요.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 현재 세션 */}
      {currentSession && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              현재 기기
            </h3>
            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
              활성
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {currentSession.device_name || "알 수 없는 기기"}
                  </span>
                </div>
                {currentSession.ip_address && (
                  <p className="text-xs text-gray-500">
                    IP: {currentSession.ip_address}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  마지막 활동: {formatDate(currentSession.last_active_at)}
                </p>
                <p className="text-xs text-gray-500">
                  로그인: {formatDate(currentSession.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 다른 세션들 */}
      {otherSessions.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              다른 기기 ({otherSessions.length}개)
            </h3>
            <button
              type="button"
              onClick={handleRevokeAllOther}
              disabled={revokingAll}
              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {revokingAll ? "처리 중..." : "모두 로그아웃"}
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {otherSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {session.device_name || "알 수 없는 기기"}
                      </span>
                    </div>
                    {session.ip_address && (
                      <p className="text-xs text-gray-500">
                        IP: {session.ip_address}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      마지막 활동: {formatDate(session.last_active_at)}
                    </p>
                    <p className="text-xs text-gray-500">
                      로그인: {formatDate(session.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revokingSessionId === session.id}
                    className="ml-4 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {revokingSessionId === session.id
                      ? "처리 중..."
                      : "로그아웃"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 세션이 없는 경우 */}
      {sessions.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            로그인한 기기가 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}

