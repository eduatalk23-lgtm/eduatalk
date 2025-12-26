"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CampTemplate } from "@/lib/domains/camp/types";

type Student = {
  studentId: string;
  studentName: string;
  camps: Array<{ campId: string; campName: string }>;
  attendanceByDate: Record<
    string,
    {
      campId: string;
      status: string;
      checkInTime: string | null;
      checkOutTime: string | null;
    }
  >;
  summary: {
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendanceRate: number;
  };
};

type AttendanceStudentTableProps = {
  students: Student[];
  camps: CampTemplate[];
  dateRange: { startDate: string; endDate: string };
};

type SortField = "name" | "rate" | "present" | "late" | "absent";
type SortOrder = "asc" | "desc";

export function AttendanceStudentTable({
  students,
  camps,
  dateRange,
}: AttendanceStudentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [filterCampId, setFilterCampId] = useState<string>("");

  // 날짜 목록 생성
  const dates = useMemo(() => {
    const result: string[] = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    while (start <= end) {
      result.push(start.toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }

    return result;
  }, [dateRange]);

  // 필터링 및 정렬
  const filteredStudents = useMemo(() => {
    let result = students;

    // 검색 필터
    if (searchQuery) {
      result = result.filter((s) =>
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 캠프 필터
    if (filterCampId) {
      result = result.filter((s) =>
        s.camps.some((c) => c.campId === filterCampId)
      );
    }

    // 정렬
    result = [...result].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "name":
          compareValue = a.studentName.localeCompare(b.studentName);
          break;
        case "rate":
          compareValue = a.summary.attendanceRate - b.summary.attendanceRate;
          break;
        case "present":
          compareValue = a.summary.presentCount - b.summary.presentCount;
          break;
        case "late":
          compareValue = a.summary.lateCount - b.summary.lateCount;
          break;
        case "absent":
          compareValue = a.summary.absentCount - b.summary.absentCount;
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return result;
  }, [students, searchQuery, filterCampId, sortField, sortOrder]);

  // 정렬 토글
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // 정렬 아이콘
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  // 출석 상태 아이콘
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "present":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "late":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "absent":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "excused":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case "early_leave":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <span className="text-gray-300">-</span>;
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* 헤더 */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900">학생별 출석 현황</h3>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* 캠프 필터 */}
            <select
              value={filterCampId}
              onChange={(e) => setFilterCampId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">전체 캠프</option>
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>

            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="학생 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th
                onClick={() => handleSort("name")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  학생명
                  <SortIcon field="name" />
                </div>
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                참여 캠프
              </th>
              <th
                onClick={() => handleSort("rate")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  출석률
                  <SortIcon field="rate" />
                </div>
              </th>
              <th
                onClick={() => handleSort("present")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  출석
                  <SortIcon field="present" />
                </div>
              </th>
              <th
                onClick={() => handleSort("late")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  지각
                  <SortIcon field="late" />
                </div>
              </th>
              <th
                onClick={() => handleSort("absent")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  결석
                  <SortIcon field="absent" />
                </div>
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700">
                상세
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <>
                <tr
                  key={student.studentId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandedStudent(
                      expandedStudent === student.studentId
                        ? null
                        : student.studentId
                    )
                  }
                >
                  <td className="border-b border-gray-200 px-4 py-3 font-medium text-gray-900">
                    {student.studentName}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {student.camps.map((camp) => (
                        <span
                          key={camp.campId}
                          className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                        >
                          {camp.campName}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        student.summary.attendanceRate >= 90
                          ? "bg-green-100 text-green-800"
                          : student.summary.attendanceRate >= 70
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      )}
                    >
                      {student.summary.attendanceRate}%
                    </span>
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center text-sm text-green-600">
                    {student.summary.presentCount}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center text-sm text-yellow-600">
                    {student.summary.lateCount}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center text-sm text-red-600">
                    {student.summary.absentCount}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center">
                    {expandedStudent === student.studentId ? (
                      <ChevronUp className="mx-auto h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="mx-auto h-4 w-4 text-gray-400" />
                    )}
                  </td>
                </tr>

                {/* 확장된 상세 정보 */}
                {expandedStudent === student.studentId && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-b border-gray-200 bg-gray-50 px-4 py-4"
                    >
                      <div className="overflow-x-auto">
                        <div className="flex gap-1 min-w-max">
                          {dates.slice(0, 14).map((date) => {
                            const record = student.attendanceByDate[date];
                            const dateObj = new Date(date);
                            const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][
                              dateObj.getDay()
                            ];

                            return (
                              <div
                                key={date}
                                className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 min-w-[60px]"
                              >
                                <span className="text-xs text-gray-500">
                                  {dateObj.getMonth() + 1}/{dateObj.getDate()}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    dayOfWeek === "일"
                                      ? "text-red-500"
                                      : dayOfWeek === "토"
                                      ? "text-blue-500"
                                      : "text-gray-400"
                                  )}
                                >
                                  {dayOfWeek}
                                </span>
                                <StatusIcon status={record?.status || ""} />
                                {record?.checkInTime && (
                                  <span className="text-xs text-gray-400">
                                    {record.checkInTime.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {dates.length > 14 && (
                            <div className="flex items-center px-2 text-xs text-gray-400">
                              +{dates.length - 14}일
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {filteredStudents.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-gray-500">검색 결과가 없습니다.</p>
        </div>
      )}

      {/* 범례 */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500">출석 상태:</span>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>출석</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span>지각</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>결석</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <span>사유</span>
          </div>
        </div>
      </div>
    </div>
  );
}
