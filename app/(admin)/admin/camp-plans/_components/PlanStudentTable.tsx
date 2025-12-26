"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PlayCircle,
  Clock,
  PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { CampTemplate } from "@/lib/domains/camp/types";

type StudentProgress = {
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planGroupId: string;
  planGroupStatus: string;
  plans: Array<{
    planId: string;
    planDate: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    totalStudyTime: number;
    contentTitle: string | null;
    subjectName: string | null;
  }>;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
    totalStudyTime: number;
  };
};

type PlanStudentTableProps = {
  students: StudentProgress[];
  camps: CampTemplate[];
};

type SortField = "name" | "camp" | "rate" | "completed" | "studyTime";
type SortOrder = "asc" | "desc";

export function PlanStudentTable({ students, camps }: PlanStudentTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [filterCampId, setFilterCampId] = useState<string>("");

  // 학습 시간 포맷
  const formatStudyTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  // 필터링 및 정렬
  const filteredStudents = useMemo(() => {
    let result = students;

    if (searchQuery) {
      result = result.filter((s) =>
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterCampId) {
      result = result.filter((s) => s.campId === filterCampId);
    }

    result = [...result].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case "name":
          compareValue = a.studentName.localeCompare(b.studentName);
          break;
        case "camp":
          compareValue = a.campName.localeCompare(b.campName);
          break;
        case "rate":
          compareValue = a.summary.completionRate - b.summary.completionRate;
          break;
        case "completed":
          compareValue = a.summary.completed - b.summary.completed;
          break;
        case "studyTime":
          compareValue = a.summary.totalStudyTime - b.summary.totalStudyTime;
          break;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    return result;
  }, [students, searchQuery, filterCampId, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <PlayCircle className="h-4 w-4 text-blue-500" />;
      case "paused":
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case "not_started":
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-300" />;
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* 헤더 */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-gray-900">학생별 플랜 진행 현황</h3>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="학생 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-1.5 pl-10 pr-4 text-sm sm:w-48"
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
              <th
                onClick={() => handleSort("camp")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  캠프
                  <SortIcon field="camp" />
                </div>
              </th>
              <th
                onClick={() => handleSort("rate")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  완료율
                  <SortIcon field="rate" />
                </div>
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700">
                진행 상황
              </th>
              <th
                onClick={() => handleSort("studyTime")}
                className="cursor-pointer border-b border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1">
                  학습시간
                  <SortIcon field="studyTime" />
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
                  key={`${student.studentId}-${student.campId}`}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandedStudent(
                      expandedStudent === `${student.studentId}-${student.campId}`
                        ? null
                        : `${student.studentId}-${student.campId}`
                    )
                  }
                >
                  <td className="border-b border-gray-200 px-4 py-3 font-medium text-gray-900">
                    {student.studentName}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {student.campName}
                    </span>
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          student.summary.completionRate >= 80
                            ? "text-green-600"
                            : student.summary.completionRate >= 50
                            ? "text-yellow-600"
                            : "text-gray-600"
                        )}
                      >
                        {student.summary.completionRate}%
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            student.summary.completionRate >= 80
                              ? "bg-green-500"
                              : student.summary.completionRate >= 50
                              ? "bg-yellow-500"
                              : "bg-gray-400"
                          )}
                          style={{
                            width: `${student.summary.completionRate}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {student.summary.completed}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <PlayCircle className="h-3 w-3" />
                        {student.summary.inProgress}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {student.summary.notStarted}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center text-sm text-gray-600">
                    {formatStudyTime(student.summary.totalStudyTime)}
                  </td>
                  <td className="border-b border-gray-200 px-4 py-3 text-center">
                    {expandedStudent === `${student.studentId}-${student.campId}` ? (
                      <ChevronUp className="mx-auto h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="mx-auto h-4 w-4 text-gray-400" />
                    )}
                  </td>
                </tr>

                {/* 확장된 플랜 목록 */}
                {expandedStudent === `${student.studentId}-${student.campId}` && (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-gray-200 bg-gray-50 px-4 py-4"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="px-3 py-2 text-left font-medium">
                                날짜
                              </th>
                              <th className="px-3 py-2 text-left font-medium">
                                콘텐츠
                              </th>
                              <th className="px-3 py-2 text-left font-medium">
                                과목
                              </th>
                              <th className="px-3 py-2 text-center font-medium">
                                상태
                              </th>
                              <th className="px-3 py-2 text-center font-medium">
                                시작
                              </th>
                              <th className="px-3 py-2 text-center font-medium">
                                완료
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                학습시간
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {student.plans.slice(0, 10).map((plan) => (
                              <tr key={plan.planId} className="border-t border-gray-200">
                                <td className="px-3 py-2 text-gray-900">
                                  {plan.planDate}
                                </td>
                                <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">
                                  {plan.contentTitle || "-"}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {plan.subjectName || "-"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <StatusIcon status={plan.status} />
                                </td>
                                <td className="px-3 py-2 text-center text-gray-500">
                                  {plan.startedAt
                                    ? new Date(plan.startedAt).toLocaleTimeString(
                                        "ko-KR",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : "-"}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-500">
                                  {plan.completedAt
                                    ? new Date(plan.completedAt).toLocaleTimeString(
                                        "ko-KR",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : "-"}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600">
                                  {plan.totalStudyTime > 0
                                    ? formatStudyTime(plan.totalStudyTime)
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {student.plans.length > 10 && (
                          <p className="mt-2 text-center text-xs text-gray-400">
                            +{student.plans.length - 10}개 더 있음
                          </p>
                        )}
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
    </div>
  );
}
