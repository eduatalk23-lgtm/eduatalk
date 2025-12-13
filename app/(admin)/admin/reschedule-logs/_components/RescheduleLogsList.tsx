/**
 * 재조정 로그 목록 컴포넌트
 * 
 * 재조정 로그를 표시하고 필터링할 수 있는 컴포넌트입니다.
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RescheduleLogDetail } from "./RescheduleLogDetail";

type RescheduleLog = {
  id: string;
  plan_group_id: string;
  student_id: string;
  adjusted_contents: any;
  plans_before_count: number;
  plans_after_count: number;
  reason: string | null;
  status: string;
  rolled_back_at: string | null;
  created_at: string;
  plan_groups: {
    id: string;
    name: string | null;
    student_id: string;
  };
  students: {
    id: string;
    name: string | null;
  };
};

type RescheduleLogsListProps = {
  logs: RescheduleLog[];
  initialFilters: {
    planGroupId: string;
    studentId: string;
    startDate: string;
    endDate: string;
  };
};

export function RescheduleLogsList({
  logs,
  initialFilters,
}: RescheduleLogsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // URL 파라미터 업데이트
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "대기 중";
      case "completed":
        return "완료";
      case "failed":
        return "실패";
      case "rolled_back":
        return "롤백됨";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "rolled_back":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 필터 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              플랜 그룹 ID
            </label>
            <input
              type="text"
              value={filters.planGroupId}
              onChange={(e) => handleFilterChange("planGroupId", e.target.value)}
              placeholder="플랜 그룹 ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              학생 ID
            </label>
            <input
              type="text"
              value={filters.studentId}
              onChange={(e) => handleFilterChange("studentId", e.target.value)}
              placeholder="학생 ID"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              시작 날짜
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              종료 날짜
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 로그 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            재조정 로그 ({logs.length}개)
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">재조정 로그가 없습니다.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                          log.status
                        )}`}
                      >
                        {getStatusLabel(log.status)}
                      </span>
                      <Link
                        href={`/plan/group/${log.plan_group_id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {log.plan_groups?.name || "이름 없음"}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>학생: {log.students?.name || "이름 없음"}</span>
                      <span>•</span>
                      <span>
                        플랜: {log.plans_before_count}개 → {log.plans_after_count}개
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(log.created_at).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    {log.reason && (
                      <div className="text-xs text-gray-500">
                        사유: {log.reason}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setSelectedLogId(selectedLogId === log.id ? null : log.id)
                    }
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {selectedLogId === log.id ? "접기" : "상세 보기"}
                  </button>
                </div>
                {selectedLogId === log.id && (
                  <div className="flex flex-col gap-4">
                    <RescheduleLogDetail logId={log.id} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

