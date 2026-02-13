"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  required,
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");       // 검색어 (타이핑 중일 때만 사용)
  const [isTyping, setIsTyping] = useState(false); // 유저가 직접 타이핑 중인지
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 포커스 시 전체 옵션 표시 (필터 없이)
  const handleFocus = useCallback(() => {
    setIsOpen(true);
    setIsTyping(false);
    setQuery("");
  }, []);

  // 타이핑 시 필터 적용
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setIsTyping(true);
      setIsOpen(true);
      onChange(val);
    },
    [onChange]
  );

  // 옵션 선택
  const handleSelect = useCallback(
    (opt: string) => {
      onChange(opt);
      setQuery("");
      setIsTyping(false);
      setIsOpen(false);
    },
    [onChange]
  );

  // 표시할 입력값: 타이핑 중이면 query, 아니면 선택된 value
  const displayValue = isTyping ? query : value;

  // 드롭다운 옵션: 타이핑 중이면 필터, 아니면 전체
  const visibleOptions = isTyping && query
    ? options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
    : options;

  // 현재 값이 프리셋에 없는 커스텀 값인지
  const isCustomValue = isTyping && query && visibleOptions.length === 0;

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
    className
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        required={required}
        className={inputClass}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsOpen(false);
            setIsTyping(false);
            setQuery("");
            inputRef.current?.blur();
          }
          if (e.key === "Enter" && isOpen) {
            // 필터된 옵션이 1개면 자동 선택
            if (visibleOptions.length === 1) {
              e.preventDefault();
              handleSelect(visibleOptions[0]);
            }
          }
        }}
      />

      {isOpen && visibleOptions.length > 0 && (
        <ul
          className={cn(
            "absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border shadow-lg",
            borderInput,
            "bg-white dark:bg-gray-900"
          )}
        >
          {visibleOptions.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition",
                  textPrimary,
                  opt === value
                    ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isCustomValue && (
        <div
          className={cn(
            "absolute z-20 mt-1 w-full rounded-lg border px-3 py-2 shadow-lg",
            borderInput,
            "bg-white dark:bg-gray-900"
          )}
        >
          <span className={cn("text-xs", textSecondary)}>
            &quot;{query}&quot; 직접 입력됨
          </span>
        </div>
      )}
    </div>
  );
}
