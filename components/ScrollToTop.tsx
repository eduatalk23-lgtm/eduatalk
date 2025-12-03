"use client";

import { useEffect } from "react";
import { scrollToTop } from "@/lib/utils/scroll";

/**
 * 페이지 마운트 시 스크롤을 상단으로 이동시키는 클라이언트 컴포넌트
 */
export function ScrollToTop() {
  useEffect(() => {
    scrollToTop();
  }, []);

  return null;
}

