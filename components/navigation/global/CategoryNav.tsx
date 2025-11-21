"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { getCategoriesForRole, type NavigationRole, type NavigationCategory, type NavigationItem } from "./categoryConfig";
import { resolveActiveCategory, isCategoryPath } from "./resolveActiveCategory";

type CategoryNavProps = {
  role: NavigationRole;
  className?: string;
};

export function CategoryNav({ role, className }: CategoryNavProps) {
  const pathname = usePathname();
  const categories = getCategoriesForRole(role);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // 현재 활성 카테고리 초기 확장
    const active = resolveActiveCategory(pathname || "", role);
    return new Set(active ? [active.category.id] : [categories[0]?.id].filter(Boolean));
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (!pathname) return false;
    
    // exactMatch 체크
    if (item.exactMatch) {
      return pathname === item.href;
    }
    
    // startsWith 매칭
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return true;
    }

    // children 검색
    if (item.children) {
      if (item.children.some((child) => isItemActive(child))) {
        return true;
      }
      // children 중 하나라도 활성화되면 부모도 활성화
    }

    // 동적 라우트 매칭 (예: /contents/books → /contents/books/[id])
    // item.href가 부모 경로이고, pathname이 그 하위 동적 라우트인 경우
    const pathSegments = pathname.split("/").filter(Boolean);
    const itemSegments = item.href.split("/").filter(Boolean);
    
    // 경로 길이가 같거나 더 길고, 앞부분이 일치하는 경우
    if (pathSegments.length >= itemSegments.length) {
      const matches = itemSegments.every((seg, idx) => seg === pathSegments[idx]);
      if (matches && pathSegments.length > itemSegments.length) {
        // 마지막 세그먼트가 ID 형태인 경우 (동적 라우트)
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment.match(/^[0-9a-f-]{8,}$/i) || lastSegment.length > 15) {
          return true;
        }
      }
    }

    return false;
  };

  const isCategoryActive = (category: NavigationCategory): boolean => {
    return isCategoryPath(pathname || "", category);
  };

  const activeInfo = resolveActiveCategory(pathname || "", role);

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {categories.map((category) => {
        const isActive = isCategoryActive(category);
        const isExpanded = expandedCategories.has(category.id);
        
        // 하위 메뉴가 1개인 경우 바로 링크로 처리
        const singleItem = category.items.length === 1 && !category.items[0].children;
        const singleItemHref = singleItem ? category.items[0].href : null;
        const singleItemActive = singleItem ? isItemActive(category.items[0]) : false;

        return (
          <div key={category.id} className="space-y-1">
            {/* 하위 메뉴가 1개인 경우: 카테고리 자체를 링크로 */}
            {singleItem ? (
              <Link
                href={singleItemHref!}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  singleItemActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {category.icon && <span>{category.icon}</span>}
                <span>{category.label}</span>
              </Link>
            ) : (
              <>
                {/* 카테고리 헤더 */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {category.icon && <span>{category.icon}</span>}
                    <span>{category.label}</span>
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

                {/* 카테고리 아이템들 */}
                {isExpanded && (
                  <div className="ml-4 space-y-1">
                    {category.items.map((item) => {
                      // 역할 체크
                      if (item.roles && !item.roles.includes(role)) {
                        return null;
                      }

                      const itemActive = isItemActive(item);

                      return (
                        <div key={item.id}>
                          {/* 메인 아이템 */}
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                              itemActive
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            )}
                          >
                            {item.icon && <span>{item.icon}</span>}
                            <span>{item.label}</span>
                          </Link>

                          {/* Children 아이템 (예: 콘텐츠 > 교재 > 등록) */}
                          {item.children && item.children.length > 0 && (
                            <div className="ml-6 mt-1 space-y-1">
                              {item.children.map((child) => {
                                const childActive = isItemActive(child);
                                return (
                                  <Link
                                    key={child.id}
                                    href={child.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                                      childActive
                                        ? "bg-indigo-100 text-indigo-800"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                  >
                                    {child.icon && <span className="text-xs">{child.icon}</span>}
                                    <span>{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}

