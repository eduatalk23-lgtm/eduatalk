"use client";

/**
 * 학생 선택 섹션 컴포넌트
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textSecondary,
  borderInput,
} from "@/lib/utils/darkMode";
import { Users, Search, ChevronDown, ChevronUp } from "lucide-react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import { useSelection } from "../../_context/PlanCreationContext";
import { StudentSelectionTable } from "./StudentSelectionTable";
import { SelectedStudentsSummary } from "./SelectedStudentsSummary";

interface StudentSelectionSectionProps {
  students: StudentListRow[];
}

export function StudentSelectionSection({
  students,
}: StudentSelectionSectionProps) {
  const { selectedStudentIds, toggleStudent, selectAllStudents, clearSelection } =
    useSelection();
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // 검색 필터링
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(query) ||
        s.grade?.toLowerCase().includes(query) ||
        s.schoolName?.toLowerCase().includes(query) ||
        s.division?.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAllStudents();
    } else {
      clearSelection();
    }
  };

  return (
    <section
      className={cn(
        "rounded-xl border p-6",
        bgSurface,
        borderInput
      )}
    >
      {/* 섹션 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className={cn("text-lg font-semibold", textPrimary)}>
              1단계: 학생 선택
            </h2>
            <p className={cn("text-sm", textSecondary)}>
              플랜을 생성할 학생을 선택하세요 (총 {students.length}명)
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            textSecondary,
            "hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          {isExpanded ? (
            <>
              접기 <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              펼치기 <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* 선택 요약 (항상 표시) */}
      <SelectedStudentsSummary
        selectedCount={selectedStudentIds.size}
        totalCount={students.length}
        onClearSelection={clearSelection}
      />

      {/* 확장 가능한 영역 */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* 검색 바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 학년, 학교로 검색..."
              className={cn(
                "w-full rounded-lg border py-2 pl-10 pr-4",
                "bg-white dark:bg-gray-800",
                borderInput,
                textPrimary,
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              )}
            />
          </div>

          {/* 학생 테이블 */}
          <StudentSelectionTable
            students={filteredStudents}
            selectedIds={selectedStudentIds}
            onToggleSelect={toggleStudent}
            onSelectAll={handleSelectAll}
          />

          {/* 검색 결과 정보 */}
          {searchQuery && (
            <p className={cn("text-sm", textSecondary)}>
              검색 결과: {filteredStudents.length}명
            </p>
          )}
        </div>
      )}
    </section>
  );
}
