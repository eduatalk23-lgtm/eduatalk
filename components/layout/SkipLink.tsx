"use client";

import Link from "next/link";

/**
 * 스킵 링크 컴포넌트
 * 키보드 사용자가 메인 콘텐츠로 바로 이동할 수 있도록 함
 */
export function SkipLink() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
    >
      메인 콘텐츠로 건너뛰기
    </Link>
  );
}

