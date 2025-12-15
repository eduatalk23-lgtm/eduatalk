"use client";

import { useState, useEffect } from "react";

/**
 * useDebounce 훅
 * 
 * 입력값 변경을 debounce하여 불필요한 재계산을 방지합니다.
 * 주로 서버 요청이나 무거운 계산을 지연시킬 때 사용합니다.
 * 
 * @param value - debounce할 값
 * @param delay - 지연 시간 (밀리초), 기본값 500ms
 * @returns debounce된 값
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState("");
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     // 500ms 후에 실행됨
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // delay 시간 후에 값을 업데이트
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // cleanup: 컴포넌트 언마운트 또는 value/delay 변경 시 이전 타이머 취소
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

