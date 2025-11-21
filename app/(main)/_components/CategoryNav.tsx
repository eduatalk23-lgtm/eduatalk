"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavCategory = {
  category: string;
  icon: string;
  items: NavItem[];
};

const navCategories: NavCategory[] = [
  {
    category: "학습 관리",
    icon: "📚",
    items: [
      { href: "/today", label: "오늘", icon: "📅" },
      { href: "/plan", label: "플랜", icon: "📋" },
      { href: "/scheduler", label: "스케줄러", icon: "🤖" },
      { href: "/blocks", label: "시간블록", icon: "⏰" },
    ],
  },
  {
    category: "콘텐츠",
    icon: "📖",
    items: [
      { href: "/contents", label: "콘텐츠 관리", icon: "📚" },
    ],
  },
  {
    category: "성과 추적",
    icon: "📊",
    items: [
      { href: "/scores", label: "성적 관리", icon: "📝" },
      { href: "/goals", label: "목표", icon: "🎯" },
      { href: "/reports", label: "리포트", icon: "📄" },
    ],
  },
  {
    category: "분석",
    icon: "📈",
    items: [
      { href: "/dashboard", label: "대시보드", icon: "📊" },
      { href: "/analysis", label: "분석", icon: "🔍" },
    ],
  },
];

// 모바일에서 항상 보여줄 주요 메뉴
const primaryMobileItems = [
  { href: "/today", icon: "📅", label: "오늘" },
  { href: "/dashboard", icon: "📊", label: "대시보드" },
  { href: "/plan", icon: "📋", label: "플랜" },
  { href: "/contents", icon: "📚", label: "콘텐츠" },
];

export function CategoryNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["학습 관리"])
  );
  const navRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setExpandedCategories(new Set());
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        // 다른 카테고리는 모두 닫고 현재 카테고리만 열기
        next.clear();
        next.add(category);
      }
      return next;
    });
  };

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some((item) => isItemActive(item.href));
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
        {/* 첫 번째 줄: 로고 + 데스크톱 메뉴 + 모바일 주요 메뉴 */}
        <div className="flex h-14 items-center justify-between">
          {/* 로고 */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-base font-semibold text-gray-900 transition hover:bg-gray-100 sm:px-3"
          >
            <span>⏱️</span>
            <span className="hidden sm:inline">TimeLevelUp</span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            {navCategories.map((category) => {
              const isActive = isCategoryActive(category);
              const isExpanded = expandedCategories.has(category.category);

              return (
                <div key={category.category} className="relative group">
                  <button
                    onClick={() => toggleCategory(category.category)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <span>{category.icon}</span>
                    <span>{category.category}</span>
                    <svg
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded ? "rotate-180" : ""
                      )}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {isExpanded && (
                    <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
                      <div className="p-1">
                        {category.items.map((item) => {
                          const itemActive = isItemActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                                itemActive
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-gray-700 hover:bg-gray-100"
                              )}
                            >
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 모바일: 주요 메뉴 아이콘 + 더보기 버튼 */}
          <div className="flex items-center gap-1 lg:hidden">
            {primaryMobileItems.map((item) => {
              const isActive = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center rounded-lg p-2 text-lg transition",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                  title={item.label}
                >
                  {item.icon}
                </Link>
              );
            })}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 확장 메뉴 */}
        <div
          className={cn(
            "border-t border-gray-200 transition-all duration-200 lg:hidden",
            mobileMenuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
          )}
        >
          <div className="py-2">
            {navCategories.map((category) => {
              const isExpanded = expandedCategories.has(category.category);
              return (
                <div key={category.category} className="mb-1">
                  <button
                    onClick={() => toggleCategory(category.category)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.category}</span>
                    </div>
                    <svg
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded ? "rotate-180" : ""
                      )}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {category.items.map((item) => {
                        const itemActive = isItemActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                              itemActive
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

