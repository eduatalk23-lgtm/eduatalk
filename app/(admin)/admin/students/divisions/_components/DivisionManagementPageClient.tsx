"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BulkDivisionUpdateModal } from "./BulkDivisionUpdateModal";
import { BulkGradeUpdateModal } from "./BulkGradeUpdateModal";
import { DivisionFilters, type GradeFilter } from "./DivisionFilters";
import { DivisionStudentList } from "./DivisionStudentList";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { StudentDivision } from "@/lib/constants/students";
import type { Student, DivisionStatItem } from "@/lib/data/students";
import { cn } from "@/lib/cn";
import { inlineButtonPrimary } from "@/lib/utils/darkMode";
import { ChevronDown } from "lucide-react";

type DivisionManagementPageClientProps = {
  students: Student[];
  stats: DivisionStatItem[];
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
  const [bulkDivisionModalOpen, setBulkDivisionModalOpen] = useState(false);
  const [bulkGradeModalOpen, setBulkGradeModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [divisionFilter, setDivisionFilter] = useState(initialDivisionFilter);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
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

  const handleGradeFilterChange = useCallback((grade: GradeFilter) => {
    setGradeFilter(grade);
  }, []);

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

  const handleBulkUpdateSuccess = useCallback(() => {
    setBulkDivisionModalOpen(false);
    setBulkGradeModalOpen(false);
    setSelectedStudentIds(new Set());
    router.refresh();
  }, [router]);

  // 검색 + 학년 필터링
  const filteredStudents = useMemo(() => {
    let result = students;

    // 학년 필터
    if (gradeFilter !== "all") {
      result = result.filter((student) => student.grade === gradeFilter);
    }

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((student) => {
        const name = student.name?.toLowerCase() || "";
        const grade = String(student.grade ?? "").toLowerCase();
        const schoolName = student.school_name?.toLowerCase() || "";
        return (
          name.includes(query) ||
          grade.includes(query) ||
          schoolName.includes(query)
        );
      });
    }

    return result;
  }, [students, searchQuery, gradeFilter]);

  // 선택된 학생 데이터 (모달에서 미리보기용)
  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedStudentIds.has(s.id));
  }, [students, selectedStudentIds]);

  return (
    <>
      {/* 필터 및 검색 */}
      <DivisionFilters
        divisionFilter={divisionFilter}
        gradeFilter={gradeFilter}
        searchQuery={searchQuery}
        onDivisionFilterChange={handleDivisionFilterChange}
        onGradeFilterChange={handleGradeFilterChange}
        onSearchChange={handleSearchChange}
      />

      {/* 일괄 변경 드롭다운 */}
      {selectedStudentIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
          <span className={cn("text-body-2 font-semibold", "text-indigo-700 dark:text-indigo-300")}>
            {selectedStudentIds.size}명 선택됨
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-body-2 font-semibold text-white transition",
                inlineButtonPrimary()
              )}
            >
              일괄 변경
              <ChevronDown className="h-4 w-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onClick={() => setBulkDivisionModalOpen(true)}>
                학부 일괄 변경
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setBulkGradeModalOpen(true)}>
                학년 일괄 변경
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}

      {/* 학생 목록 */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="text-body-2 text-gray-600 dark:text-gray-400">
            {searchQuery || divisionFilter !== "all" || gradeFilter !== "all"
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

      {/* 학부 일괄 변경 모달 */}
      <BulkDivisionUpdateModal
        open={bulkDivisionModalOpen}
        onOpenChange={setBulkDivisionModalOpen}
        studentIds={Array.from(selectedStudentIds)}
        onSuccess={handleBulkUpdateSuccess}
      />

      {/* 학년 일괄 변경 모달 */}
      <BulkGradeUpdateModal
        open={bulkGradeModalOpen}
        onOpenChange={setBulkGradeModalOpen}
        studentIds={Array.from(selectedStudentIds)}
        students={selectedStudents}
        onSuccess={handleBulkUpdateSuccess}
      />
    </>
  );
}
