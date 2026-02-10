"use client";

import { Search, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StudentSearchItem } from "@/lib/domains/student/actions/search";

type StudentSearchPanelProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  students: StudentSearchItem[];
  total: number;
  isLoading: boolean;
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
};

const GRADE_LABELS: Record<number, string> = {
  1: "1학년",
  2: "2학년",
  3: "3학년",
};

export function StudentSearchPanel({
  searchQuery,
  onSearchChange,
  students,
  total,
  isLoading,
  selectedStudentId,
  onSelectStudent,
}: StudentSearchPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름 또는 연락처 검색"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* 검색결과 카운트 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Users className="h-3.5 w-3.5" />
        <span>검색결과 {total}명</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {/* 학생 리스트 */}
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        {students.length === 0 && !isLoading && (
          <div className="py-8 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다" : "등록된 학생이 없습니다"}
          </div>
        )}
        {students.map((student) => (
          <button
            key={student.id}
            type="button"
            onClick={() => onSelectStudent(student.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition",
              selectedStudentId === student.id
                ? "bg-indigo-50 ring-1 ring-indigo-200"
                : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedStudentId === student.id
                      ? "text-indigo-700"
                      : "text-gray-900"
                  )}
                >
                  {student.name ?? "이름 없음"}
                </span>
                {student.gender && (
                  <span className="text-[11px] text-gray-400">
                    {student.gender}
                  </span>
                )}
              </span>
              {student.division && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {student.division}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {student.school_name && (
                <span className="max-w-[80px] truncate" title={student.school_name}>
                  {student.school_name}
                </span>
              )}
              {student.grade != null && (
                <span>{GRADE_LABELS[student.grade] ?? `${student.grade}학년`}</span>
              )}
              {student.class && <span>{student.class}반</span>}
              {student.phone && <span>{student.phone}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
