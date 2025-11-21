"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  getSchoolById,
  getSchoolByName,
  searchSchools,
  autoRegisterSchool,
  type School,
} from "@/app/(student)/actions/schoolActions";

type SchoolSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  type?: "중학교" | "고등학교" | "대학교";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSchoolSelect?: (school: School) => void; // 학교 선택 시 추가 처리
};

export default function SchoolSelect({
  value,
  onChange,
  type,
  placeholder = "학교를 검색하세요",
  className,
  disabled = false,
  onSchoolSelect,
}: SchoolSelectProps) {
  // type이 명시적으로 지정되면 해당 타입만 검색
  const allowedTypes = type ? [type] : ["중학교", "고등학교", "대학교"];
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // 검색 모드로 전환 시 검색 입력 필드에 포커스
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  // 검색어 변경 시 자동 검색 (디바운스)
  useEffect(() => {
    if (!isSearchMode || disabled) {
      return;
    }

    if (searchQuery.trim().length >= 1) {
      const timeoutId = setTimeout(() => {
        handleSearchSchools(searchQuery);
      }, 300); // 디바운스

      return () => clearTimeout(timeoutId);
    } else {
      setSchools([]);
    }
  }, [searchQuery, isSearchMode, disabled]);

  // value가 변경되면 학교 정보 조회 (불필요한 재조회 방지)
  useEffect(() => {
    if (value && value.trim()) {
      // 이미 선택된 학교와 동일하면 조회하지 않음
      if (selectedSchool && selectedSchool.name === value.trim()) {
        return;
      }
      
      // UUID 형식인지 확인 (ID로 조회)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (isUUID) {
        fetchSchoolById(value);
      } else {
        // 학교명으로 조회 (단, 이미 선택된 학교가 아니고 검색 중이 아닐 때만)
        if (!selectedSchool || selectedSchool.name !== value.trim()) {
          fetchSchoolByName(value);
        }
      }
    } else if (!value) {
      setSelectedSchool(null);
    }
  }, [value, selectedSchool]);

  async function fetchSchoolById(schoolId: string) {
    try {
      const school = await getSchoolById(schoolId);
      if (school) {
        setSelectedSchool(school);
      }
    } catch (error) {
      console.error("학교 정보 조회 실패:", error);
    }
  }

  async function fetchSchoolByName(schoolName: string) {
    try {
      const school = await getSchoolByName(schoolName);
      if (school) {
        setSelectedSchool(school);
      } else {
        // 학교명이 DB에 없으면 임시로 설정
        setSelectedSchool({
          id: "",
          name: schoolName,
          type: type || "대학교",
          region: null,
        });
      }
    } catch (error) {
      console.error("학교 정보 조회 실패:", error);
    }
  }

  async function handleSearchSchools(query: string) {
    setLoading(true);
    try {
      const results = await searchSchools(query, type);
      setSchools(results);
    } catch (error) {
      console.error("학교 검색 실패:", error);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(school: School) {
    setSelectedSchool(school);
    onChange(school.name);
    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);

    // 학교가 DB에 없으면 자동 등록
    if (!school.id && school.name && type) {
      try {
        const registeredSchool = await autoRegisterSchool(
          school.name,
          type,
          school.region || null
        );
        if (registeredSchool) {
          setSelectedSchool(registeredSchool);
          if (onSchoolSelect) {
            onSchoolSelect(registeredSchool);
          }
        }
      } catch (error) {
        console.error("학교 자동 등록 실패:", error);
      }
    } else if (onSchoolSelect) {
      onSchoolSelect(school);
    }
  }

  function handleClear() {
    setSelectedSchool(null);
    onChange("");
    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);
  }

  function handleSearchClick() {
    if (disabled) return;
    setIsOpen(true);
    setIsSearchMode(true);
    setSearchQuery("");
    setSchools([]);
    // 검색 입력 필드에 포커스
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  function handleSearchSubmit() {
    if (!searchQuery.trim() || loading) return;
    handleSearchSchools(searchQuery);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearchSubmit();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsSearchMode(false);
      setSearchQuery("");
      setSchools([]);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex gap-2">
        {/* 선택된 학교명 표시 (항상 읽기 전용) */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={selectedSchool ? selectedSchool.name : value || ""}
            readOnly
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 text-gray-900 cursor-default",
              "disabled:bg-gray-100 disabled:text-gray-500",
              !selectedSchool && !value && "text-gray-400"
            )}
          />
          {selectedSchool && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* 검색 버튼 */}
        <button
          type="button"
          onClick={handleSearchClick}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-gray-700 transition-colors",
            "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200",
            "disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* 검색 드롭다운 메뉴 */}
      {isOpen && !disabled && isSearchMode && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* 검색 입력 필드 */}
          <div className="border-b border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  if (disabled) return;
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="학교명을 입력하세요"
                disabled={disabled}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:text-gray-500"
              />
              {loading && (
                <div className="flex items-center justify-center px-3">
                  <svg
                    className="h-4 w-4 animate-spin text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsSearchMode(false);
                  setSearchQuery("");
                  setSchools([]);
                }}
                className="flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* 검색 결과 */}
          <div className="max-h-60 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center px-4 py-6">
                <svg
                  className="h-5 w-5 animate-spin text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="ml-2 text-sm text-gray-500">검색 중...</span>
              </div>
            ) : schools.length > 0 ? (
            <ul className="py-1">
              {schools.map((school) => (
                <li
                  key={school.id || school.name}
                  onClick={() => handleSelect(school)}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-sm hover:bg-indigo-50",
                    selectedSchool?.id === school.id && "bg-indigo-100"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{school.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {school.region && (
                          <span className="text-xs text-gray-500">{school.region}</span>
                        )}
                        {/* 캠퍼스 정보 표시 (안성캠퍼스, 원주캠퍼스 등) */}
                        {school.name.includes("캠퍼스") && (
                          <span className="text-xs text-blue-600 font-medium">
                            {school.name.match(/(.+캠퍼스)/)?.[0] || ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {school.type && (
                      <span className="ml-2 text-xs font-medium text-indigo-600 whitespace-nowrap">
                        {school.type === "중학교" ? "중등" : school.type === "고등학교" ? "고등" : school.type === "대학교" ? "대학" : ""}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            ) : searchQuery.trim().length > 0 ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500">
                검색 결과가 없습니다. 다른 검색어를 시도해보세요.
              </div>
            ) : (
              <div className="px-4 py-3 text-center text-sm text-gray-500">
                학교명을 입력하고 검색 버튼을 클릭하세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

