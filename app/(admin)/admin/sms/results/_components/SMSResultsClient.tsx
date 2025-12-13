"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

type SMSLog = {
  id: string;
  tenant_id?: string | null;
  recipient_id?: string | null;
  recipient_phone?: string | null;
  message_content?: string | null;
  template_id?: string | null;
  status?: "pending" | "sent" | "delivered" | "failed" | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

type SMSResultsClientProps = {
  initialLogs: SMSLog[];
  studentMap: Record<string, string>;
  stats: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    failed: number;
  };
  searchQuery: string;
  statusFilter: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

export function SMSResultsClient({
  initialLogs,
  studentMap,
  stats,
  searchQuery,
  statusFilter,
  currentPage,
  totalPages,
  totalCount,
}: SMSResultsClientProps) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [statusInput, setStatusInput] = useState(statusFilter);

  // initialLogs가 변경되면 상태 업데이트 (서버에서 새로고침된 경우)
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // 30초

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
    } catch (error) {
      console.error("[SMS Results] 새로고침 실패:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusInput) params.set("status", statusInput);
    router.push(`/admin/sms/results?${params.toString()}`);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatusInput(newStatus);
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (newStatus) params.set("status", newStatus);
    router.push(`/admin/sms/results?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (statusFilter) params.set("status", statusFilter);
    if (newPage > 1) params.set("page", newPage.toString());
    router.push(`/admin/sms/results?${params.toString()}`);
  };

  const getStatusBadgeClass = (status: string | null | undefined) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "sent":
        return "발송 완료";
      case "delivered":
        return "전달 완료";
      case "pending":
        return "대기 중";
      case "failed":
        return "실패";
      default:
        return "알 수 없음";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">전체</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">대기 중</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">발송 완료</div>
          <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">전달 완료</div>
          <div className="text-2xl font-bold text-blue-600">{stats.delivered}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">실패</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="학생 이름, 전화번호, 메시지 내용으로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <select
            value={statusInput}
            onChange={handleStatusChange}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">전체 상태</option>
            <option value="pending">대기 중</option>
            <option value="sent">발송 완료</option>
            <option value="delivered">전달 완료</option>
            <option value="failed">실패</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          {(searchQuery || statusFilter) && (
            <Link
              href="/admin/sms/results"
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          )}
        </form>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <span className="text-xs text-gray-500">새로고침 중...</span>
          )}
          <button
            onClick={refreshData}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* SMS 로그 목록 */}
      {logs.length === 0 ? (
        <EmptyState
          title="SMS 발송 이력이 없습니다"
          description="아직 발송된 SMS가 없습니다."
        />
      ) : (
        <>
          <div className="space-y-4">
            {logs.map((log) => {
              const studentName = studentMap[log.recipient_id ?? ""] ?? "-";
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() =>
                      setExpandedLogId(isExpanded ? null : log.id)
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {log.recipient_id && (
                          <Link
                            href={`/admin/students/${log.recipient_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            {studentName}
                          </Link>
                        )}
                        {!log.recipient_id && (
                          <span className="font-semibold text-gray-900">-</span>
                        )}
                        <span className="text-sm text-gray-500">
                          {log.recipient_phone ?? "-"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                        >
                          {getStatusLabel(log.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString("ko-KR")
                            : "-"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {log.message_content ?? "-"}
                    </p>
                  </div>

                  {/* 상세 정보 (확장 시 표시) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-medium text-gray-600">
                            메시지 내용:
                          </span>
                          <p className="text-sm text-gray-900">
                            {log.message_content ?? "-"}
                          </p>
                        </div>
                        {log.sent_at && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-600">
                              발송 시간:
                            </span>
                            <p className="text-sm text-gray-900">
                              {new Date(log.sent_at).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        )}
                        {log.delivered_at && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-600">
                              전달 시간:
                            </span>
                            <p className="text-sm text-gray-900">
                              {new Date(log.delivered_at).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        )}
                        {log.error_message && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-red-600">
                              오류 메시지:
                            </span>
                            <p className="text-sm text-red-700">
                              {log.error_message}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-600">로그 ID:</span>
                            <p className="text-gray-900 font-mono">{log.id}</p>
                          </div>
                          {log.template_id && (
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-gray-600">
                                템플릿 ID:
                              </span>
                              <p className="text-gray-900 font-mono">
                                {log.template_id}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages} (총 {totalCount}개)
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

