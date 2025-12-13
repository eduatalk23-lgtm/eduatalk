"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { studentCategories } from "./studentCategories";

function StudentCategoryNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // 캠프 모드 감지: /plan/group/[id] 경로이고 camp=true 쿼리 파라미터가 있는 경우
  // 또는 /camp/calendar, /camp/today 경로인 경우
  const isCampMode = 
    (pathname?.startsWith("/plan/group/") && searchParams?.get("camp") === "true") ||
    pathname?.startsWith("/camp/");

  // pathname이 /dashboard, /today, /plan, /contents, /analysis 중 하나와 매칭되는지 확인
  const isActive = (href: string) => {
    // 캠프 모드인 경우 "캠프 참여"만 활성화
    if (isCampMode) {
      return href === "/camp";
    }
    
    // /plan 경로인 경우, 캠프 모드가 아닐 때만 활성화
    if (href === "/plan" && isCampMode) {
      return false;
    }
    
    if (pathname === href) return true;
    // prefix 매칭: /plan/new는 /plan과 매칭
    if (pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <nav className="flex items-center gap-4 overflow-x-auto border-b bg-white p-3" aria-label="주요 메뉴">
      {studentCategories.map((category) => {
        const active = isActive(category.href);
        const Icon = category.icon;

        return (
          <Link
            key={category.href}
            href={category.href}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
              active
                ? "bg-gray-100 font-semibold text-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{category.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentCategoryNav() {
  return (
    <Suspense fallback={
      <nav className="flex items-center gap-4 overflow-x-auto border-b bg-white p-3">
        <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
      </nav>
    }>
      <StudentCategoryNavContent />
    </Suspense>
  );
}

