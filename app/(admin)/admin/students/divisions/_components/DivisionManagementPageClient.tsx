"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BulkDivisionUpdateModal } from "./BulkDivisionUpdateModal";
import { DivisionFilters } from "./DivisionFilters";
import { DivisionStudentList } from "./DivisionStudentList";
import type { StudentDivision } from "@/lib/constants/students";
import type { Student } from "@/lib/data/students";
import { cn } from "@/lib/cn";
import { inlineButtonPrimary } from "@/lib/utils/darkMode";

type DivisionStats = {
  division: StudentDivision | null;
  count: number;
};

type DivisionManagementPageClientProps = {
  students: Student[];
  stats: DivisionStats[];
  total: number;
  initialDivisionFilter: StudentDivision | null | "all";
  initialSearchQuery: string;
};

export function DivisionManagementPageClient({
  students,
  stats,
  total,
  initialDivisionFilter,
  initialSearchQuery,
}: DivisionManagementPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [divisionFilter, setDivisionFilter] = useState(initialDivisionFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);

  const handleDivisionFilterChange = useCallback(
    (division: StudentDivision | null | "all") => {
      setDivisionFilter(division);
      const params = new URLSearchParams(searchParams.toString());
      
      if (division === "all") {
        params.delete("division");
      } else if (division === null) {
        params.set("division", "null");
      } else {
        params.set("division", division);
      }
      
      params.delete("page");
      
      startTransition(() => {
        router.push(`/admin/students/divisions?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      const params = new URLSearchParams(searchParams.toString());
      
      if (query) {
        params.set("search", query);
      } else {
        params.delete("search");
      }
      
      params.delete("page");
      
      startTransition(() => {
        router.push(`/admin/students/divisions?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleBulkUpdate = useCallback(() => {
    if (selectedStudentIds.size === 0) {
      return;
    }
    setBulkModalOpen(true);
  }, [selectedStudentIds]);

  const handleBulkUpdateSuccess = useCallback(() => {
    setBulkModalOpen(false);
    setSelectedStudentIds(new Set());
    router.refresh();
  }, [router]);

  // 검색 필터링
  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    
    const query = searchQuery.toLowerCase();
    return students.filter((student) => {
      const name = student.name?.toLowerCase() || "";
      const grade = student.grade?.toLowerCase() || "";
      const classNum = student.class?.toLowerCase() || "";
      return (
        name.includes(query) ||
        grade.includes(query) ||
        classNum.includes(query)
      );
    });
  }, [students, searchQuery]);

  return (
    <>
      {/* 필터 및 검색 */}
      <DivisionFilters
        divisionFilter={divisionFilter}
        searchQuery={searchQuery}
        onDivisionFilterChange={handleDivisionFilterChange}
        onSearchChange={handleSearchChange}
      />

      {/* 일괄 변경 버튼 */}
      {selectedStudentIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className={cn("text-body-2 font-semibold", "text-indigo-700 dark:text-indigo-300")}>
            {selectedStudentIds.size}개 선택됨
          </span>
          <button
            type="button"
            onClick={handleBulkUpdate}
            className={cn(
              "rounded-lg px-4 py-2 text-body-2 font-semibold text-white transition",
              inlineButtonPrimary()
            )}
          >
            일괄 변경
          </button>
        </div>
      )}

      {/* 학생 목록 */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-body-2 text-gray-600 dark:text-gray-400">
            {searchQuery || divisionFilter !== "all"
              ? "검색 결과가 없습니다."
              : "등록된 학생이 없습니다."}
          </p>
        </div>
      ) : (
        <DivisionStudentList
          students={filteredStudents}
          onUpdate={() => router.refresh()}
          onSelectionChange={setSelectedStudentIds}
        />
      )}

      {/* 일괄 변경 모달 */}
      <BulkDivisionUpdateModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        studentIds={Array.from(selectedStudentIds)}
        onSuccess={handleBulkUpdateSuccess}
      />
    </>
  );
}

