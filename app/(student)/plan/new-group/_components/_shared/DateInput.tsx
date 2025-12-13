"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

type DateInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  labelClassName?: string;
  required?: boolean;
  placeholder?: string;
};

/**
 * 날짜 입력 필드 컴포넌트
 * 전체 영역 클릭 가능하도록 최적화된 날짜 선택 필드
 */
export function DateInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  min,
  max,
  className,
  labelClassName,
  required = false,
  placeholder,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleWrapperClick = () => {
    if (disabled || !inputRef.current) return;
    
    // input을 포커스
    inputRef.current.focus();
    
    // 최신 브라우저에서 showPicker() 메서드 지원 (Chrome 99+, Edge 99+)
    if (
      typeof inputRef.current.showPicker === "function" &&
      document.activeElement === inputRef.current
    ) {
      try {
        inputRef.current.showPicker();
      } catch (error) {
        // showPicker가 실패하면 기본 동작(포커스)만 수행
        console.debug("[DateInput] showPicker not supported or failed:", error);
      }
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    // input 자체를 클릭한 경우에도 showPicker 호출
    const target = e.currentTarget;
    if (typeof target.showPicker === "function") {
      try {
        target.showPicker();
      } catch (error) {
        // showPicker가 실패하면 기본 동작 수행
        console.debug("[DateInput] showPicker not supported or failed:", error);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "block text-sm font-medium text-gray-800",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          labelClassName
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div
        className={cn(
          "relative",
          !disabled && "cursor-pointer"
        )}
        onClick={handleWrapperClick}
      >
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleInputClick}
          disabled={disabled}
          min={min}
          max={max}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900",
            "focus:border-gray-900 focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60",
            // 전체 영역 클릭 가능하도록 스타일 적용
            !disabled && "cursor-pointer",
            // WebKit 브라우저에서 달력 아이콘을 더 크고 클릭하기 쉽게 만들기
            !disabled && "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6 [&::-webkit-calendar-picker-indicator]:ml-2",
            className
          )}
          style={{
            // Firefox 및 다른 브라우저를 위한 전체 영역 클릭 가능 처리
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
      </div>
    </div>
  );
}

