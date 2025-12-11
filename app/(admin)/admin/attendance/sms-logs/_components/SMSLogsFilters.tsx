"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/atoms/Button";
import Label from "@/components/atoms/Label";
import { Card, CardContent } from "@/components/molecules/Card";
import type { SMSLogFilter } from "@/app/(admin)/actions/smsLogActions";

type SMSLogsFiltersProps = {
  currentFilters: SMSLogFilter;
};

export function SMSLogsFilters({ currentFilters }: SMSLogsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<SMSLogFilter>(currentFilters);

  const handleFilterChange = (key: keyof SMSLogFilter, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleApplyFilters = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.studentId) params.set("studentId", filters.studentId);
      if (filters.status) params.set("status", filters.status);
      if (filters.smsType) params.set("smsType", filters.smsType);
      params.set("page", "1"); // 필터 적용 시 첫 페이지로

      router.push(`?${params.toString()}`);
    });
  };

  const handleResetFilters = () => {
    setFilters({});
    startTransition(() => {
      router.push("?page=1");
    });
  };

  return (
    <Card>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <Label htmlFor="startDate">시작 날짜</Label>
            <input
              type="date"
              id="startDate"
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <Label htmlFor="endDate">종료 날짜</Label>
            <input
              type="date"
              id="endDate"
              value={filters.endDate || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <Label htmlFor="status">상태</Label>
            <select
              id="status"
              value={filters.status || ""}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">전체</option>
              <option value="pending">대기</option>
              <option value="sent">발송됨</option>
              <option value="delivered">전달됨</option>
              <option value="failed">실패</option>
            </select>
          </div>
          <div>
            <Label htmlFor="smsType">SMS 타입</Label>
            <select
              id="smsType"
              value={filters.smsType || ""}
              onChange={(e) => handleFilterChange("smsType", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">전체</option>
              <option value="attendance_check_in">입실</option>
              <option value="attendance_check_out">퇴실</option>
              <option value="attendance_absent">결석</option>
              <option value="attendance_late">지각</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={handleApplyFilters}
              disabled={isPending}
              className="flex-1"
            >
              적용
            </Button>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={isPending}
            >
              초기화
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

