"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  getSchoolById,
  searchSchools,
  type School,
} from "@/app/(student)/actions/schoolActions";

type SchoolMultiSelectProps = {
  value?: string[]; // 선택된 학교 ID 배열
  onChange: (value: string[]) => void; // 선택된 학교 ID 배열 변경
  type?: "중학교" | "고등학교" | "대학교";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxCount?: number; // 최대 선택 개수 (기본값: 3)
  onSchoolSelect?: (school: School) => void; // 학교 선택 시 추가 처리
};

export default function SchoolMultiSelect({
  value = [],
  onChange,
  type,
  placeholder = "대학교를 검색하세요",
  className,
  disabled = false,
  maxCount = 3,
  onSchoolSelect,
}: SchoolMultiSelectProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // value가 변경되면 학교 정보 조회
  useEffect(() => {
    if (value && value.length > 0) {
      fetchSchoolsByIds(value);
    } else {
      setSelectedSchools([]);
    }
  }, [value]);

  async function fetchSchoolsByIds(schoolIds: string[]) {
    try {
      const schools = await Promise.all(
        schoolIds.map((id) => getSchoolById(id))
      );
      const validSchools = schools.filter(
        (school): school is School => school !== null
      );
      setSelectedSchools(validSchools);
    } catch (error) {
      console.error("학교 정보 조회 실패:", error);
    }
  }

  async function handleSearchSchools(query: string) {
    setLoading(true);
    try {
      const results = await searchSchools(query, type);
      // 이미 선택된 학교는 제외
      const filteredResults = results.filter(
        (school) => !selectedSchools.some((selected) => selected.id === school.id)
      );
      setSchools(filteredResults);
    } catch (error) {
      console.error("학교 검색 실패:", error);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(school: School) {
    // 최대 개수 체크
    if (selectedSchools.length >= maxCount) {
      return;
    }

    // 이미 선택된 학교인지 확인
    if (selectedSchools.some((s) => s.id === school.id)) {
      return;
    }

    const newSelectedSchools = [...selectedSchools, school];
    setSelectedSchools(newSelectedSchools);

    // ID 배열로 변환하여 onChange 호출
    const newIds = newSelectedSchools
      .map((s) => s.id)
      .filter((id): id is string => !!id);
    onChange(newIds);

    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);

    // 학교 선택 콜백 호출
    if (onSchoolSelect) {
      onSchoolSelect(school);
    }
  }

  function handleRemove(schoolId: string) {
    const newSelectedSchools = selectedSchools.filter(
      (s) => s.id !== schoolId
    );
    setSelectedSchools(newSelectedSchools);
    const newIds = newSelectedSchools
      .map((s) => s.id)
      .filter((id): id is string => !!id);
    onChange(newIds);
  }

  function handleClear() {
    setSelectedSchools([]);
    onChange([]);
    setSearchQuery("");
    setIsOpen(false);
    setIsSearchMode(false);
  }

  function handleSearchClick() {
    if (disabled) return;
    // 최대 개수에 도달했으면 검색 불가
    if (selectedSchools.length >= maxCount) {
      return;
    }
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

  const canAddMore = selectedSchools.length < maxCount;

  // 순위별 스타일 정의
  const getRankStyles = (rank: number) => {
    switch (rank) {
      case 1: // 1순위
        return {
          badge: "bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-md",
          card: "bg-gradient-to-r from-amber-50 to-indigo-50 border-2 border-amber-300 shadow-md",
          icon: "text-amber-600",
        };
      case 2: // 2순위
        return {
          badge: "bg-gradient-to-br from-gray-400 to-gray-500 text-white font-semibold shadow-sm",
          card: "bg-gradient-to-r from-gray-50 to-indigo-50 border border-gray-300 shadow-sm",
          icon: "text-gray-600",
        };
      case 3: // 3순위
        return {
          badge: "bg-gradient-to-br from-amber-700 to-amber-800 text-white font-semibold shadow-sm",
          card: "bg-gradient-to-r from-amber-50/50 to-indigo-50 border border-amber-200 shadow-sm",
          icon: "text-amber-700",
        };
      default:
        return {
          badge: "bg-indigo-200 text-indigo-800",
          card: "bg-indigo-50 border border-indigo-200",
          icon: "text-indigo-600",
        };
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* 선택된 학교 목록 */}
      {selectedSchools.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {selectedSchools.map((school, index) => {
            const rank = index + 1;
            const styles = getRankStyles(rank);
            return (
              <div
                key={school.id || school.name}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-all",
                  "hover:shadow-lg hover:scale-[1.02]",
                  styles.card
                )}
              >
                {/* 순위 배지 */}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    styles.badge
                  )}
                  aria-label={`${rank}순위`}
                >
                  {rank === 1 && (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  {rank !== 1 && rank}
                </div>
                {/* 학교 이름 */}
                <span className="font-medium text-gray-900">{school.name}</span>
                {/* 삭제 버튼 */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(school.id || "")}
                    className={cn(
                      "ml-auto shrink-0 rounded-full p-1 transition-colors",
                      "hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-offset-1",
                      styles.icon
                    )}
                    aria-label={`${school.name} 제거`}
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
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        {/* 검색 입력 필드 */}
        <div className="relative flex-1">
          <input
            type="text"
            value=""
            readOnly
            placeholder={
              canAddMore
                ? placeholder
                : `최대 ${maxCount}개까지 선택 가능합니다`
            }
            disabled={disabled || !canAddMore}
            className={cn(
              "w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 text-gray-900 cursor-default",
              "disabled:bg-gray-100 disabled:text-gray-500",
              !canAddMore && "text-gray-400"
            )}
          />
          {selectedSchools.length > 0 && !disabled && (
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
          disabled={disabled || !canAddMore}
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
      {isOpen && !disabled && isSearchMode && canAddMore && (
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
                placeholder="대학교명을 입력하세요"
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
                      "cursor-pointer px-4 py-2 text-sm hover:bg-indigo-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {school.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {school.region && (
                            <span className="text-xs text-gray-500">
                              {school.region}
                            </span>
                          )}
                          {/* 캠퍼스 정보 표시 */}
                          {school.name.includes("캠퍼스") && (
                            <span className="text-xs text-blue-600 font-medium">
                              {school.name.match(/(.+캠퍼스)/)?.[0] || ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {school.type && (
                        <span className="ml-2 text-xs font-medium text-indigo-600 whitespace-nowrap">
                          {school.type === "중학교"
                            ? "중등"
                            : school.type === "고등학교"
                            ? "고등"
                            : school.type === "대학교"
                            ? "대학"
                            : ""}
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
                대학교명을 입력하고 검색하세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

