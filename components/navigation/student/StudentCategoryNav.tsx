"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { studentCategories } from "./studentCategories";

function StudentCategoryNavContent() {
  const pathname = usePathname();

  // pathname이 /dashboard, /today, /plan, /contents, /analysis 중 하나와 매칭되는지 확인
  const isActive = (href: string) => {
    if (pathname === href) return true;
    // prefix 매칭: /plan/new는 /plan과 매칭
    if (pathname.startsWith(href + "/")) return true;
    return false;
  };

  return (
    <nav className="flex items-center gap-4 overflow-x-auto border-b bg-white p-3">
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
          >
            <Icon size={18} />
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

