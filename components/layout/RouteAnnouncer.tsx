"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * SPA 라우트 전환 시 스크린 리더에 페이지 변경을 알리고
 * 메인 콘텐츠로 포커스를 이동하는 컴포넌트.
 *
 * Next.js App Router는 클라이언트 내비게이션 시 브라우저의
 * 기본 페이지 로드 이벤트를 발생시키지 않으므로,
 * 스크린 리더 사용자는 페이지가 변경되었는지 알 수 없습니다.
 *
 * 이 컴포넌트는:
 * 1. pathname 변경 감지 시 document.title을 aria-live 영역에 알림
 * 2. 메인 콘텐츠(#main-content)로 포커스 이동
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // 초기 로드 시에는 실행하지 않음
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    // Next.js App Router의 title 갱신은 비동기 — setTimeout으로 안정적 대기
    const timer = setTimeout(() => {
      const title = document.title;

      // 1. 메인 콘텐츠로 포커스 이동
      const main = document.getElementById("main-content");
      if (main) {
        if (!main.hasAttribute("tabindex")) {
          main.setAttribute("tabindex", "-1");
        }
        main.focus({ preventScroll: true });
      }

      // 2. 스크린 리더에 페이지 제목 알림
      const announcer = document.getElementById("route-announcer");
      if (announcer) {
        announcer.textContent = "";
        requestAnimationFrame(() => {
          announcer.textContent = title || "페이지가 이동되었습니다";
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      id="route-announcer"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
