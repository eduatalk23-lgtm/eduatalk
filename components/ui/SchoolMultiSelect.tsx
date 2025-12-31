"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { useSchoolMultiSelectLogic } from "./hooks/useSchoolMultiSelectLogic";
import type { School } from "@/lib/domains/school";

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

function SchoolMultiSelectComponent({
  value = [],
  onChange,
  type,
  placeholder = "대학교를 검색하세요",
  className,
  disabled = false,
  maxCount = 3,
  onSchoolSelect,
}: SchoolMultiSelectProps) {
  const {
    // 상태
    isSearchMode,
    isOpen,
    searchQuery,
    setSearchQuery,
    schools,
    loading,
    selectedSchools,
    canAddMore,

    // refs
    containerRef,
    searchInputRef,

    // 핸들러
    handleSelect,
    handleRemove,
    handleClear,
    handleSearchClick,
    handleSearchSubmit,
    handleSearchKeyDown,
    handleClose,
  } = useSchoolMultiSelectLogic({
    value,
    onChange,
    type,
    disabled,
    maxCount,
    onSchoolSelect,
  });

  // 순위별 스타일 정의
  const getRankStyles = (rank: number) => {
    switch (rank) {
      case 1: // 1순위
        return {
          badge: "bg-gradient-to-br from-amber-500 to-amber-600 text-white font-semibold shadow-[var(--elevation-4)]",
          card: "bg-gradient-to-r from-amber-50 to-indigo-50 border-2 border-amber-300 shadow-[var(--elevation-4)]",
          icon: "text-amber-600",
        };
      case 2: // 2순위
        return {
          badge: "bg-gradient-to-br from-secondary-400 to-secondary-500 text-white font-semibold shadow-[var(--elevation-1)]",
          card: "bg-gradient-to-r from-[rgb(var(--color-secondary-50))] to-primary-50 border border-[rgb(var(--color-secondary-300))] shadow-[var(--elevation-1)]",
          icon: "text-[var(--text-secondary)]",
        };
      case 3: // 3순위
        return {
          badge: "bg-gradient-to-br from-amber-700 to-amber-800 text-white font-semibold shadow-[var(--elevation-1)]",
          card: "bg-gradient-to-r from-amber-50/50 to-indigo-50 border border-amber-200 shadow-[var(--elevation-1)]",
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
    <div ref={containerRef} className={cn("relative flex flex-col gap-3", className)}>
      {/* 선택된 학교 목록 */}
      {selectedSchools.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {selectedSchools.map((school, index) => {
            const rank = index + 1;
            const styles = getRankStyles(rank);
            return (
              <div
                key={school.id || school.name}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-4 py-2.5 text-body-2 transition-base",
                  "hover:shadow-[var(--elevation-8)] hover:scale-[1.02]",
                  styles.card
                )}
              >
                {/* 순위 배지 */}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-2 font-bold",
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
                <span className="text-body-2-bold text-text-primary">{school.name}</span>
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
              "w-full rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 bg-[rgb(var(--color-secondary-50))] text-[var(--text-primary)] cursor-default",
              "disabled:bg-[rgb(var(--color-secondary-100))] disabled:text-[var(--text-disabled)]",
              !canAddMore && "text-[var(--text-tertiary)]"
            )}
          />
          {selectedSchools.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
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
            "flex items-center justify-center rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-[var(--text-secondary)] transition-base",
            "hover:bg-[rgb(var(--color-secondary-50))] focus:outline-none focus:ring-2 focus:ring-primary-200",
            "disabled:bg-[rgb(var(--color-secondary-100))] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed"
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
        <div className="absolute z-50 top-1 w-full rounded-lg border border-[rgb(var(--color-secondary-200))] bg-white dark:bg-secondary-900 shadow-[var(--elevation-8)]">
          {/* 검색 입력 필드 */}
          <div className="border-b border-[rgb(var(--color-secondary-200))] p-3">
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
                className="flex-1 rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-body-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-[rgb(var(--color-secondary-100))] disabled:text-[var(--text-disabled)]"
              />
              {loading && (
                <div className="flex items-center justify-center px-3">
                  <svg
                    className="h-4 w-4 animate-spin text-[var(--text-tertiary)]"
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
                onClick={handleClose}
                className="flex items-center justify-center rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-body-2 text-text-secondary transition-base hover:bg-[rgb(var(--color-secondary-50))] focus:outline-none focus:ring-2 focus:ring-primary-200"
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
                  className="h-5 w-5 animate-spin text-[var(--text-tertiary)]"
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
                <span className="text-body-2 text-text-tertiary">검색 중...</span>
              </div>
            ) : schools.length > 0 ? (
              <ul className="py-1">
                {schools.map((school) => (
                  <li
                    key={school.id || school.name}
                    onClick={() => handleSelect(school)}
                    className={cn(
                      "cursor-pointer px-4 py-2 text-body-2 hover:bg-indigo-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-body-2-bold text-text-primary">
                          {school.name}
                        </div>
                        <div className="flex items-center gap-2">
                          {school.region && (
                            <span className="text-body-2 text-text-tertiary">
                              {school.region}
                            </span>
                          )}
                          {/* 캠퍼스 정보 표시 */}
                          {school.name.includes("캠퍼스") && (
                            <span className="text-body-2 font-medium text-blue-600">
                              {school.name.match(/(.+캠퍼스)/)?.[0] || ""}
                            </span>
                          )}
                        </div>
                      </div>
                      {school.type && (
                        <span className="text-body-2 font-medium text-indigo-600 whitespace-nowrap">
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
              <div className="px-4 py-3 text-center text-body-2 text-text-tertiary">
                검색 결과가 없습니다. 다른 검색어를 시도해보세요.
              </div>
            ) : (
              <div className="px-4 py-3 text-center text-body-2 text-text-tertiary">
                대학교명을 입력하고 검색하세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SchoolMultiSelect = memo(SchoolMultiSelectComponent);
SchoolMultiSelect.displayName = "SchoolMultiSelect";

export default SchoolMultiSelect;