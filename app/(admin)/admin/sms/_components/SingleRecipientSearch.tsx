"use client";

import { useState, useMemo } from "react";
import Input from "@/components/atoms/Input";
import Label from "@/components/atoms/Label";
import Button from "@/components/atoms/Button";
import Select from "@/components/atoms/Select";
import {
  filterStudents,
  getPhoneByRecipientType,
  type Student,
  type RecipientType,
} from "@/lib/utils/studentFilterUtils";
import type { RecipientType as SMSRecipientType } from "./SMSFilterPanel";

type SingleRecipientSearchProps = {
  students: Student[];
  onSelect: (
    phone: string,
    studentName?: string,
    recipientType?: SMSRecipientType
  ) => void;
  selectedPhone?: string;
  recipientType?: SMSRecipientType;
  onRecipientTypeChange?: (type: SMSRecipientType) => void;
};

export function SingleRecipientSearch({
  students,
  onSelect,
  selectedPhone,
  recipientType = "mother",
  onRecipientTypeChange,
}: SingleRecipientSearchProps) {
  // 검색어 입력 상태
  const [searchQuery, setSearchQuery] = useState("");
  // 실제 검색 실행된 검색어
  const [executedSearchQuery, setExecutedSearchQuery] = useState("");

  // 검색 실행 함수
  const handleSearch = () => {
    setExecutedSearchQuery(searchQuery.trim());
  };

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // 검색 필터링된 학생 목록 (공통 유틸리티 함수 사용)
  // executedSearchQuery 기반으로 필터링
  const filteredStudents = useMemo(() => {
    if (!executedSearchQuery) {
      return [];
    }

    const query = executedSearchQuery.toLowerCase().trim();

    // 디버깅: 검색 전 학생 데이터 확인
    if (process.env.NODE_ENV === "development") {
      console.log("[SingleRecipientSearch] 검색 실행:", {
        query,
        totalStudents: students.length,
        recipientType: recipientType || "mother",
      });
    }

    // 공통 유틸리티 함수 사용
    const results = filterStudents(students, { search: query }).slice(0, 10); // 최대 10개만 표시

    // 디버깅: 검색 결과 확인
    if (process.env.NODE_ENV === "development") {
      console.log("[SingleRecipientSearch] 검색 결과:", {
        query,
        resultCount: results.length,
        recipientType: recipientType || "mother",
        results: results.map((s) => ({
          name: s.name,
          phone: s.phone,
          mother_phone: s.mother_phone,
          father_phone: s.father_phone,
          grade: s.grade,
          class: s.class,
        })),
      });
    }

    return results;
  }, [students, executedSearchQuery, recipientType]);

  const handleSelect = (student: Student) => {
    const phone = getPhoneByRecipientType(student, recipientType as RecipientType);
    if (phone) {
      onSelect(phone, student.name || undefined, recipientType);
      setSearchQuery(""); // 검색어 초기화
      setExecutedSearchQuery(""); // 검색 결과도 초기화
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="recipient-search">수신자 검색</Label>
        {onRecipientTypeChange && (
          <div className="flex items-center gap-2">
            <Label htmlFor="recipient-type" className="text-xs text-gray-600">
              전송 대상:
            </Label>
            <Select
              id="recipient-type"
              value={recipientType}
              onChange={(e) =>
                onRecipientTypeChange(e.target.value as RecipientType)
              }
              className="text-xs"
            >
              <option value="student">학생</option>
              <option value="mother">어머니</option>
              <option value="father">아버지</option>
            </Select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id="recipient-search"
          type="text"
          placeholder="학생 이름, 전화번호, 학년, 반으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          type="button"
          variant="primary"
          onClick={handleSearch}
          disabled={!searchQuery.trim()}
        >
          검색
        </Button>
      </div>

      {/* 검색 결과 목록 */}
      {executedSearchQuery && filteredStudents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const phone = getPhoneByRecipientType(student, recipientType as RecipientType);
                const isSelected = selectedPhone === phone;
                const recipientTypeLabel =
                  recipientType === "student"
                    ? "학생"
                    : recipientType === "mother"
                    ? "어머니"
                    : "아버지";

                return (
                  <div
                    key={student.id}
                    className={`p-3 hover:bg-gray-50 ${
                      isSelected ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {student.name || "이름 없음"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {student.grade && student.class
                            ? `${student.grade}학년 ${student.class}반`
                            : student.grade
                            ? `${student.grade}학년`
                            : ""}
                          {phone && (
                            <span>
                              ({recipientTypeLabel}) {phone}
                            </span>
                          )}
                          {!phone && (
                            <span className="text-red-500">
                              ({recipientTypeLabel} 연락처 없음)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isSelected ? "primary" : "outline"}
                        size="sm"
                        onClick={() => handleSelect(student)}
                        disabled={!phone}
                      >
                        {isSelected ? "선택됨" : "선택"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {executedSearchQuery && filteredStudents.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          검색 결과가 없습니다.
        </div>
      )}

      {/* 검색 안내 */}
      {!executedSearchQuery && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            학생 이름, 전화번호, 학년, 반으로 검색하여 선택할 수 있습니다. 검색
            버튼을 클릭하거나 Enter 키를 눌러 검색하세요.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-gray-400">
              디버깅: 전체 학생 {students.length}명
            </p>
          )}
        </div>
      )}
    </div>
  );
}
