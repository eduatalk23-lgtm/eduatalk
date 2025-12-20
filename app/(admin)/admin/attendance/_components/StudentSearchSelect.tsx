"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StudentSearchResult } from "@/lib/data/studentSearch";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import Label from "@/components/atoms/Label";

type StudentSearchSelectProps = {
  students: Array<{ id: string; name: string | null }>;
  value: string;
  onChange: (studentId: string) => void;
  tenantId?: string | null;
  required?: boolean;
};

export function StudentSearchSelect({
  students,
  value,
  onChange,
  tenantId,
  required = false,
}: StudentSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string | null;
  } | null>(null);

  // 초기 선택된 학생 설정
  useEffect(() => {
    if (value && students.length > 0) {
      const student = students.find((s) => s.id === value);
      if (student) {
        setSelectedStudent(student);
      }
    }
  }, [value, students]);

  // 디바운싱을 위한 ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 검색 함수 (디바운싱 적용)
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 1) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // API 라우트를 통해 검색
        const params = new URLSearchParams({
          q: query.trim(),
          type: "all",
          isActive: "true",
          limit: "50",
        });
        if (tenantId) {
          params.append("tenantId", tenantId);
        }

        const response = await fetch(`/api/students/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error("검색 실패");
        }

        const data = await response.json();
        if (data.success && data.data) {
          setSearchResults(data.data.students || []);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("학생 검색 실패:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [tenantId]
  );

  // 검색어 변경 시 검색 실행 (디바운싱)
  useEffect(() => {
    // 이전 타이머 취소
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      // 300ms 후 검색 실행
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    // cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // 학생 선택 핸들러
  const handleSelectStudent = useCallback(
    (student: StudentSearchResult | { id: string; name: string | null }) => {
      setSelectedStudent({ id: student.id, name: student.name });
      onChange(student.id);
      setIsOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    },
    [onChange]
  );

  // 표시할 학생 목록 (검색 결과가 있으면 검색 결과, 없으면 초기 목록)
  const displayStudents =
    searchQuery.trim() && searchResults.length > 0
      ? searchResults
      : students.slice(0, 50); // 초기 목록은 최대 50개만 표시

  return (
    <div className="relative flex flex-col gap-1">
      <Label htmlFor="student_search">학생 선택 {required && <span className="text-red-500">*</span>}</Label>
      <div className="relative">
        {/* 검색 입력 필드 */}
        <input
          id="student_search"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            selectedStudent
              ? selectedStudent.name || "이름 없음"
              : "학생명으로 검색..."
          }
          className={cn(
            "w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
            borderInput,
            bgSurface,
            textPrimary,
            "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
          )}
        />

        {/* 드롭다운 목록 */}
        {isOpen && (
          <div
            className={cn(
              "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border shadow-lg",
              borderInput,
              bgSurface
            )}
          >
            {isSearching ? (
              <div className="p-4 text-center text-sm text-gray-500">
                검색 중...
              </div>
            ) : displayStudents.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchQuery.trim()
                  ? "검색 결과가 없습니다."
                  : "등록된 학생이 없습니다."}
              </div>
            ) : (
              <ul className="flex flex-col">
                {displayStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id;
                  return (
                    <li
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className={cn(
                        "cursor-pointer px-4 py-2 text-sm transition",
                        textPrimary,
                        bgHover,
                        isSelected && "bg-indigo-50 dark:bg-indigo-950/20"
                      )}
                    >
                      {student.name || "이름 없음"}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 외부 클릭 시 드롭다운 닫기 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

