"use client";

import { useState, useEffect } from "react";

/**
 * useReducedMotion - prefers-reduced-motion 미디어 쿼리 감지 훅
 *
 * 사용자가 시스템 설정에서 "모션 줄이기"를 활성화했는지 감지합니다.
 * 접근성 향상을 위해 애니메이션과 전환 효과를 조건부로 적용할 때 사용합니다.
 *
 * @returns {boolean} true이면 사용자가 모션 줄이기를 선호함
 *
 * @example
 * const prefersReducedMotion = useReducedMotion();
 * const animationClass = prefersReducedMotion ? '' : 'transition-all duration-300';
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // SSR 환경에서는 matchMedia가 없을 수 있음
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // 초기값 설정
    setPrefersReducedMotion(mediaQuery.matches);

    // 변경 감지 핸들러
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // 이벤트 리스너 등록
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * getMotionSafeClass - 모션 안전 클래스 유틸리티
 *
 * Tailwind의 motion-safe/motion-reduce 변형을 사용하여
 * 접근성을 고려한 클래스 문자열을 생성합니다.
 *
 * @param baseClass - 모션이 허용될 때 적용할 기본 클래스
 * @param reduceClass - 모션 줄이기 시 대체할 클래스 (기본값: 빈 문자열)
 * @returns Tailwind 클래스 문자열
 *
 * @example
 * // 결과: "motion-safe:transition-all motion-safe:duration-300"
 * getMotionSafeClass("transition-all duration-300")
 */
export function getMotionSafeClass(
  baseClass: string,
  reduceClass: string = ""
): string {
  const safeClasses = baseClass
    .split(" ")
    .filter(Boolean)
    .map((cls) => `motion-safe:${cls}`)
    .join(" ");

  if (reduceClass) {
    const reduceClasses = reduceClass
      .split(" ")
      .filter(Boolean)
      .map((cls) => `motion-reduce:${cls}`)
      .join(" ");
    return `${safeClasses} ${reduceClasses}`;
  }

  return safeClasses;
}
