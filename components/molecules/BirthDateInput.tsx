"use client";

import { useCallback, useRef, useMemo } from "react";

type BirthDateInputProps = {
  /** YYYY-MM-DD 문자열 (react-hook-form field.value) */
  value: string;
  /** YYYY-MM-DD 문자열 변경 (react-hook-form field.onChange) */
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
};

const CURRENT_YEAR = new Date().getFullYear();

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  if (d < 1) return false;
  const maxDay = new Date(y, m, 0).getDate(); // 해당 월의 마지막 날
  return d <= maxDay;
}

/**
 * 생년월일 전용 입력 — 년/월/일 3개 숫자 필드
 *
 * - 숫자 키패드 (inputMode="numeric")
 * - 자리수 충족 시 자동 포커스 이동
 * - Backspace 시 이전 필드로 이동
 * - 내부적으로 YYYY-MM-DD 문자열 생산 (기존 서버/DB 호환)
 */
export default function BirthDateInput({
  value,
  onChange,
  onBlur,
  name,
  label = "생년월일",
  required,
  disabled,
  error,
}: BirthDateInputProps) {
  const yearRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  // YYYY-MM-DD 파싱
  const { year, month, day } = useMemo(() => {
    if (!value) return { year: "", month: "", day: "" };
    const parts = value.split("-");
    return {
      year: parts[0] || "",
      month: parts[1] || "",
      day: parts[2] || "",
    };
  }, [value]);

  const buildValue = useCallback(
    (y: string, m: string, d: string) => {
      // 3필드 모두 채워졌을 때만 YYYY-MM-DD 생성, 아니면 빈 문자열
      if (y.length === 4 && m.length >= 1 && d.length >= 1) {
        const padM = m.padStart(2, "0");
        const padD = d.padStart(2, "0");
        onChange(`${y}-${padM}-${padD}`);
      } else if (!y && !m && !d) {
        onChange("");
      }
      // 부분 입력 중에는 onChange 호출하지 않음 (유효하지 않은 중간값 방지)
    },
    [onChange],
  );

  const handleYearChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (v.length === 4) {
        monthRef.current?.focus();
      }
      buildValue(v, month, day);
      // 부분값 업데이트를 위해 내부적으로 임시 저장
      if (yearRef.current) yearRef.current.value = v;
    },
    [month, day, buildValue],
  );

  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 2);
      // 2 이상 입력 시 즉시 다음 필드 (3~9는 03~09로)
      if (v.length === 1 && parseInt(v) > 1) {
        v = `0${v}`;
      }
      if (v.length === 2) {
        dayRef.current?.focus();
      }
      buildValue(year, v, day);
      if (monthRef.current) monthRef.current.value = v;
    },
    [year, day, buildValue],
  );

  const handleDayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 2);
      if (v.length === 1 && parseInt(v) > 3) {
        v = `0${v}`;
      }
      buildValue(year, month, v);
      if (dayRef.current) dayRef.current.value = v;
    },
    [year, month, buildValue],
  );

  // Backspace로 빈 필드에서 이전 필드 이동
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      prevRef: React.RefObject<HTMLInputElement | null> | null,
    ) => {
      if (e.key === "Backspace" && e.currentTarget.value === "" && prevRef?.current) {
        e.preventDefault();
        prevRef.current.focus();
      }
    },
    [],
  );

  // 인라인 검증 메시지
  const inlineError = useMemo(() => {
    if (!year || !month || !day) return null;
    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);
    if (y < 2000 || y > CURRENT_YEAR) return "올바른 출생연도를 입력해주세요";
    if (m < 1 || m > 12) return "월은 1~12 사이여야 합니다";
    if (!isValidDate(y, m, d)) return "올바른 날짜를 입력해주세요";
    return null;
  }, [year, month, day]);

  const fieldClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-center tabular-nums transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:opacity-50 disabled:bg-gray-50";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={yearRef}
          type="text"
          inputMode="numeric"
          placeholder="YYYY"
          maxLength={4}
          defaultValue={year}
          onChange={handleYearChange}
          onKeyDown={(e) => handleKeyDown(e, null)}
          onBlur={onBlur}
          disabled={disabled}
          aria-label={`${name || "birth_date"} 년`}
          className={fieldClass}
          style={{ maxWidth: "5rem" }}
        />
        <span className="text-gray-400 select-none">-</span>
        <input
          ref={monthRef}
          type="text"
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          defaultValue={month}
          onChange={handleMonthChange}
          onKeyDown={(e) => handleKeyDown(e, yearRef)}
          onBlur={onBlur}
          disabled={disabled}
          aria-label={`${name || "birth_date"} 월`}
          className={fieldClass}
          style={{ maxWidth: "3.5rem" }}
        />
        <span className="text-gray-400 select-none">-</span>
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          placeholder="DD"
          maxLength={2}
          defaultValue={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, monthRef)}
          onBlur={onBlur}
          disabled={disabled}
          aria-label={`${name || "birth_date"} 일`}
          className={fieldClass}
          style={{ maxWidth: "3.5rem" }}
        />
      </div>
      {(inlineError || error) && (
        <p className="text-xs text-red-500">{inlineError || error}</p>
      )}
    </div>
  );
}
