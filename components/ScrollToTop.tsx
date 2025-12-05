"use client";

import { useEffect } from "react";
import { scrollToTop } from "@/lib/utils/scroll";

/**
 * 페이지 마운트 시 스크롤을 상단으로 이동시키는 클라이언트 컴포넌트
 */
export function ScrollToTop() {
  useEffect(() => {
    // DOM이 준비된 후에만 스크롤 실행
    if (typeof window !== "undefined") {
      // 다음 틱에서 실행하여 DOM이 완전히 렌더링된 후 실행
      const timer = setTimeout(() => {
        scrollToTop();
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}

