"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/molecules/EmptyState";

// 뿌리오 결과코드 한글 매핑
const RESULT_DESCRIPTIONS: Record<string, string> = {
  "4100": "전달 성공",
  "4400": "음영지역",
  "4410": "전원 꺼짐",
  "4420": "수신 거부",
  "4430": "착신 정지",
  "4500": "전송 실패",
  "4510": "번호 오류",
  "4520": "서비스 불가 지역",
  "4530": "콘텐츠 에러",
  "4600": "스팸 차단",
};

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
  message_key?: string | null;
  ref_key?: string | null;
  ppurio_result_code?: string | null;
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
  startDate: string;
  endDate: string;
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
  startDate,
  endDate,
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
  const [startDateInput, setStartDateInput] = useState(startDate);
  const [endDateInput, setEndDateInput] = useState(endDate);

  // 동기화 상태
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    delivered: number;
    failed: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
    } catch (error) {
      console.error("[SMS Results] 새로고침 실패:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [router]);

  const buildParams = useCallback(
    (overrides?: {
      search?: string;
      status?: string;
      sDate?: string;
      eDate?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams();
      const s = overrides?.search ?? searchInput.trim();
      const st = overrides?.status ?? statusInput;
      const sd = overrides?.sDate ?? startDateInput;
      const ed = overrides?.eDate ?? endDateInput;
      const p = overrides?.page ?? undefined;

      if (s) params.set("search", s);
      if (st) params.set("status", st);
      if (sd) params.set("startDate", sd);
      if (ed) params.set("endDate", ed);
      if (p && p > 1) params.set("page", p.toString());
      return params.toString();
    },
    [searchInput, statusInput, startDateInput, endDateInput]
  );

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/admin/sms/results?${buildParams()}`);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatusInput(newStatus);
    router.push(`/admin/sms/results?${buildParams({ status: newStatus })}`);
  };

  const handleDateChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setStartDateInput(value);
      router.push(`/admin/sms/results?${buildParams({ sDate: value })}`);
    } else {
      setEndDateInput(value);
      router.push(`/admin/sms/results?${buildParams({ eDate: value })}`);
    }
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/admin/sms/results?${buildParams({ page: newPage })}`);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/sms/sync-delivery", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setSyncResult({
          synced: data.synced,
          delivered: data.delivered,
          failed: data.failed,
        });
        // 동기화 후 새로고침
        router.refresh();
      } else {
        setSyncError(data.error || "동기화에 실패했습니다.");
      }
    } catch {
      setSyncError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadgeClass = (status: string | null | undefined) => {
    switch (status) {
      case "delivered":
        return "bg-blue-100 text-blue-800";
      case "sent":
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

  const getResultDescription = (code: string | null | undefined) => {
    if (!code) return null;
    return RESULT_DESCRIPTIONS[code] || code;
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("ko-KR");
  };

  const formatShortDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  // 페이지네이션 번호 생성
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  const hasActiveFilters = searchQuery || statusFilter || startDate || endDate;

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

      {/* 동기화 결과 배너 */}
      {syncResult && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">
            동기화 완료: {syncResult.synced}건 (전달: {syncResult.delivered}, 실패: {syncResult.failed})
          </p>
          <button
            onClick={() => setSyncResult(null)}
            className="text-blue-600 hover:text-blue-800"
          >
            &times;
          </button>
        </div>
      )}
      {syncError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{syncError}</p>
          <button
            onClick={() => setSyncError(null)}
            className="text-red-600 hover:text-red-800"
          >
            &times;
          </button>
        </div>
      )}

      {/* 필터 및 검색 */}
      <div className="flex flex-col gap-4">
        {/* 검색 + 상태 필터 */}
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
          </form>
        </div>

        {/* 날짜 필터 + 액션 버튼 */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => handleDateChange("start", e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <span className="text-sm text-gray-500">~</span>
            <input
              type="date"
              value={endDateInput}
              onChange={(e) => handleDateChange("end", e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {hasActiveFilters && (
              <Link
                href="/admin/sms/results"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                초기화
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <span className="text-xs text-gray-500">새로고침 중...</span>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? "동기화 중..." : "결과 동기화"}
            </button>
            <button
              onClick={refreshData}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              새로고침
            </button>
          </div>
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
          {/* 데스크톱 테이블 */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-600">
                  <th className="px-4 py-3">수신자</th>
                  <th className="px-4 py-3">전화번호</th>
                  <th className="px-4 py-3">메시지</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">발송일시</th>
                  <th className="px-4 py-3">전달일시</th>
                  <th className="px-4 py-3">결과코드</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const studentName = studentMap[log.recipient_id ?? ""] ?? "-";
                  const isExpanded = expandedLogId === log.id;
                  const resultDesc = getResultDescription(log.ppurio_result_code);

                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
                        onClick={() =>
                          setExpandedLogId(isExpanded ? null : log.id)
                        }
                      >
                        <td className="px-4 py-3">
                          {log.recipient_id ? (
                            <Link
                              href={`/admin/students/${log.recipient_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              {studentName}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {log.recipient_phone ?? "-"}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-700">
                          {log.message_content ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                          >
                            {getStatusLabel(log.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                          {formatShortDateTime(log.sent_at || log.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                          {log.delivered_at
                            ? formatShortDateTime(log.delivered_at)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {resultDesc ? (
                            <span
                              className={
                                log.ppurio_result_code === "4100"
                                  ? "text-blue-700"
                                  : "text-red-600"
                              }
                            >
                              {resultDesc}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>

                      {/* 확장 행 */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={7}
                            className="border-b border-gray-200 bg-gray-50 px-6 py-4"
                          >
                            <div className="space-y-3">
                              <div>
                                <span className="text-xs font-medium text-gray-600">
                                  메시지 전문:
                                </span>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                                  {log.message_content ?? "-"}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                                {log.sent_at && (
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      발송 시간:
                                    </span>
                                    <p className="text-gray-900">
                                      {formatDateTime(log.sent_at)}
                                    </p>
                                  </div>
                                )}
                                {log.delivered_at && (
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      전달 시간:
                                    </span>
                                    <p className="text-gray-900">
                                      {formatDateTime(log.delivered_at)}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium text-gray-600">
                                    로그 ID:
                                  </span>
                                  <p className="font-mono text-gray-900">
                                    {log.id.slice(0, 8)}...
                                  </p>
                                </div>
                                {log.ppurio_result_code && (
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      결과코드:
                                    </span>
                                    <p className="text-gray-900">
                                      {log.ppurio_result_code} (
                                      {getResultDescription(
                                        log.ppurio_result_code
                                      )}
                                      )
                                    </p>
                                  </div>
                                )}
                                {log.template_id && (
                                  <div>
                                    <span className="font-medium text-gray-600">
                                      템플릿 ID:
                                    </span>
                                    <p className="font-mono text-gray-900">
                                      {log.template_id}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {log.error_message && (
                                <div>
                                  <span className="text-xs font-medium text-red-600">
                                    오류 메시지:
                                  </span>
                                  <p className="text-sm text-red-700">
                                    {log.error_message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="space-y-3 md:hidden">
            {logs.map((log) => {
              const studentName = studentMap[log.recipient_id ?? ""] ?? "-";
              const isExpanded = expandedLogId === log.id;
              const resultDesc = getResultDescription(log.ppurio_result_code);

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <div
                    className="cursor-pointer p-4"
                    onClick={() =>
                      setExpandedLogId(isExpanded ? null : log.id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.recipient_id ? (
                          <Link
                            href={`/admin/students/${log.recipient_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            {studentName}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">
                            -
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {log.recipient_phone ?? ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                        >
                          {getStatusLabel(log.status)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-700">
                      {log.message_content ?? "-"}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {formatShortDateTime(log.sent_at || log.created_at)}
                      </span>
                      {resultDesc && (
                        <span
                          className={
                            log.ppurio_result_code === "4100"
                              ? "text-blue-600"
                              : "text-red-500"
                          }
                        >
                          {resultDesc}
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-medium text-gray-600">
                            메시지 전문:
                          </span>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                            {log.message_content ?? "-"}
                          </p>
                        </div>
                        {log.delivered_at && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">
                              전달 시간:
                            </span>
                            <p className="text-sm text-gray-900">
                              {formatDateTime(log.delivered_at)}
                            </p>
                          </div>
                        )}
                        {log.ppurio_result_code && (
                          <div>
                            <span className="text-xs font-medium text-gray-600">
                              결과코드:
                            </span>
                            <p className="text-sm text-gray-900">
                              {log.ppurio_result_code} (
                              {getResultDescription(log.ppurio_result_code)})
                            </p>
                          </div>
                        )}
                        {log.error_message && (
                          <div>
                            <span className="text-xs font-medium text-red-600">
                              오류 메시지:
                            </span>
                            <p className="text-sm text-red-700">
                              {log.error_message}
                            </p>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          로그 ID: {log.id.slice(0, 8)}...
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
            <div className="flex items-center justify-center gap-1 pt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                이전
              </button>

              {getPageNumbers().map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-2 text-sm text-gray-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      p === currentPage
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                다음
              </button>

              <span className="ml-2 text-xs text-gray-500">
                총 {totalCount}건
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
