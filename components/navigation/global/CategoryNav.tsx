"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { getCategoriesForRole, type NavigationRole, type NavigationCategory, type NavigationItem } from "./categoryConfig";
import { resolveActiveCategory, isCategoryPath, isItemActive, type ActiveCategoryInfo } from "./resolveActiveCategory";
import { useSidebar } from "@/components/layout/SidebarContext";
import { isCampMode, ensurePathname, getActiveCategoryWithCampMode } from "@/lib/navigation/utils";
import { getNavItemClasses, getCategoryHeaderClasses, getSubItemClasses, getChildItemClasses, navItemStyles } from "./navStyles";
import {
  isSingleItemCategory,
  getSingleItemHref,
  isSingleItemActive,
  getCategoryIndex,
  getCategoryAriaLabel,
  getCategoryDescription,
  getNextCategoryIndex,
  getPrevCategoryIndex,
  findCategoryBySearch,
  filterCategoryItemsByRole,
} from "./categoryNavUtils";

type CategoryNavProps = {
  role: NavigationRole;
  className?: string;
  onNavigate?: () => void; // 모바일에서 네비게이션 후 드로어 닫기용
};

export function CategoryNav({ role, className, onNavigate }: CategoryNavProps) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safePathname = ensurePathname(pathname);
  
  // categories 메모이제이션 (role이 변경될 때만 재계산)
  const categories = useMemo(
    () => getCategoriesForRole(role),
    [role]
  );
  
  // campMode 메모이제이션 (pathname, searchParams 변경 시만 재계산)
  const campMode = useMemo(
    () => isCampMode(pathname, searchParams),
    [pathname, searchParams]
  );
  
  // 활성 카테고리 정보를 계산 (useMemo로 값 직접 계산)
  const activeCategoryInfo = useMemo((): ActiveCategoryInfo | null => {
    return getActiveCategoryWithCampMode(
      safePathname,
      role,
      searchParams,
      categories,
      campMode
    );
  }, [safePathname, role, campMode, categories, searchParams]);
  
  // 초기 상태 설정 (초기화 함수 내부에서 직접 계산)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // 초기 렌더링 시 직접 계산 (SSR 안전)
    const initialCampMode = isCampMode(pathname, searchParams);
    const active = getActiveCategoryWithCampMode(
      safePathname,
      role,
      searchParams,
      categories,
      initialCampMode
    );
    return new Set(active ? [active.category.id] : [categories[0]?.id].filter(Boolean));
  });

  // pathname 변경 시 활성 카테고리 자동 확장
  useEffect(() => {
    if (activeCategoryInfo) {
      setExpandedCategories((prev) => {
        if (prev.has(activeCategoryInfo.category.id)) return prev;
        return new Set([...prev, activeCategoryInfo.category.id]);
      });
    }
  }, [activeCategoryInfo]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      // 불필요한 업데이트 방지: 이미 포함되어 있고 다른 항목이 없으면 변경하지 않음
      if (prev.has(categoryId) && prev.size === 1) {
        return prev;
      }
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const isCategoryActive = (category: NavigationCategory): boolean => {
    // activeCategoryInfo를 활용하여 중복 제거
    if (activeCategoryInfo) {
      return activeCategoryInfo.category.id === category.id;
    }
    return isCategoryPath(safePathname, category, searchParams);
  };

  const handleLinkClick = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  // 키보드 네비게이션을 위한 ref
  const categoryRefs = useRef<Map<string, HTMLButtonElement | HTMLAnchorElement>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchStringRef = useRef<string>("");

  // 타입 검색 기능 (getKeyForSearch)
  const getKeyForSearch = useCallback((search: string, fromKey?: string | null): string | null => {
    const categoriesList = Array.from(categories);
    const matchedCategory = findCategoryBySearch(search, categoriesList, fromKey);
    return matchedCategory?.id ?? null;
  }, [categories]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent, categoryId: string, index: number) => {
    const categoriesList = Array.from(categories);
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        const nextIndex = getNextCategoryIndex(index, categoriesList.length);
        const nextCategory = categoriesList[nextIndex];
        const nextRef = categoryRefs.current.get(nextCategory.id);
        nextRef?.focus();
        break;
      
      case "ArrowUp":
        e.preventDefault();
        const prevIndex = getPrevCategoryIndex(index, categoriesList.length);
        const prevCategory = categoriesList[prevIndex];
        const prevRef = categoryRefs.current.get(prevCategory.id);
        prevRef?.focus();
        break;
      
      case "Home":
        e.preventDefault();
        if (categoriesList.length > 0) {
          const firstRef = categoryRefs.current.get(categoriesList[0].id);
          firstRef?.focus();
        }
        break;
      
      case "End":
        e.preventDefault();
        if (categoriesList.length > 0) {
          const lastRef = categoryRefs.current.get(categoriesList[categoriesList.length - 1].id);
          lastRef?.focus();
        }
        break;
      
      case "Enter":
      case " ":
        e.preventDefault();
        toggleCategory(categoryId);
        break;
      
      case "Escape":
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
        break;
      
      default:
        // 타입 검색 기능 (문자 입력)
        if (e.key.length === 1 && /[a-zA-Z가-힣]/.test(e.key)) {
          e.preventDefault();
          
          // 검색 문자열 누적
          if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
          }
          
          searchStringRef.current += e.key.toLowerCase();
          const matchedKey = getKeyForSearch(searchStringRef.current, categoryId);
          
          if (matchedKey) {
            const matchedRef = categoryRefs.current.get(matchedKey);
            matchedRef?.focus();
          }
          
          // 500ms 후 검색 문자열 초기화
          searchTimeoutRef.current = setTimeout(() => {
            searchStringRef.current = "";
          }, 500);
        }
        break;
    }
  }, [categories, toggleCategory, getKeyForSearch]);

  // cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // 카테고리 렌더링 결과 메모이제이션
  const categoryElements = useMemo(() => {
    return categories.map((category) => {
      const isActive = isCategoryActive(category);
      const isExpanded = expandedCategories.has(category.id);
      
      // 하위 메뉴가 1개인 경우 바로 링크로 처리
      const singleItem = isSingleItemCategory(category);
      const singleItemHref = getSingleItemHref(category);
      const singleItemActive = isSingleItemActive(category, safePathname, searchParams);
      const categoryIndex = getCategoryIndex(category.id, categories);

      return (
        <div key={category.id} className="flex flex-col gap-1">
          {/* 하위 메뉴가 1개인 경우: 카테고리 자체를 링크로 */}
          {singleItem && singleItemHref ? (
            <Link
              ref={(el) => {
                if (el) categoryRefs.current.set(category.id, el);
                else categoryRefs.current.delete(category.id);
              }}
              href={singleItemHref}
              onClick={handleLinkClick}
              onKeyDown={(e) => handleKeyDown(e, category.id, categoryIndex)}
              className={getNavItemClasses({
                isActive: singleItemActive,
                isCollapsed,
              })}
              aria-label={getCategoryAriaLabel(category, isCollapsed)}
              aria-describedby={isCollapsed ? undefined : `category-desc-${category.id}`}
              aria-current={singleItemActive ? "page" : undefined}
            >
              {category.icon && <span className="flex-shrink-0" aria-hidden="true">{category.icon}</span>}
              <span className={cn("transition-opacity", isCollapsed && navItemStyles.textHidden)}>
                {category.label}
              </span>
            </Link>
          ) : (
            <>
              {/* 카테고리 헤더 */}
              <button
                ref={(el) => {
                  if (el) categoryRefs.current.set(category.id, el);
                  else categoryRefs.current.delete(category.id);
                }}
                onClick={() => toggleCategory(category.id)}
                onKeyDown={(e) => handleKeyDown(e, category.id, categoryIndex)}
                className={getCategoryHeaderClasses({
                  isActive,
                  isCollapsed,
                })}
                aria-label={isCollapsed ? category.label : undefined}
                aria-describedby={isCollapsed ? undefined : `category-desc-${category.id}`}
                aria-expanded={isExpanded}
                aria-controls={`category-items-${category.id}`}
              >
                <div className="flex items-center gap-2">
                  {category.icon && <span className="flex-shrink-0" aria-hidden="true">{category.icon}</span>}
                  <span className={cn("transition-opacity", isCollapsed && navItemStyles.textHidden)}>
                    {category.label}
                  </span>
                </div>
                {!isCollapsed && (
                  <svg
                    className={cn(
                      "h-4 w-4 transition-transform flex-shrink-0 motion-reduce:transition-none",
                      isExpanded ? "rotate-180" : ""
                    )}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                    style={isExpanded ? { willChange: "transform" } : undefined}
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {!isCollapsed && (
                <span id={`category-desc-${category.id}`} className="sr-only">
                  {getCategoryDescription(category)}
                </span>
              )}

              {/* 카테고리 아이템들 */}
              {!isCollapsed && (
                <div
                  id={`category-items-${category.id}`}
                  className={cn(
                    "flex flex-col gap-1 pl-4 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none",
                    isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                  )}
                  role="group"
                  aria-label={`${category.label} 하위 메뉴`}
                  aria-hidden={!isExpanded}
                  style={isExpanded ? { willChange: "max-height, opacity" } : undefined}
                >
                    {filterCategoryItemsByRole(category.items, role).map((item) => {
                      const itemActive = isItemActive(safePathname, item, searchParams);

                    return (
                      <div key={item.id}>
                        {/* 메인 아이템 */}
                        <Link
                          href={item.href}
                          onClick={handleLinkClick}
                          className={getSubItemClasses({
                            isActive: itemActive,
                          })}
                          aria-current={itemActive ? "page" : undefined}
                        >
                          {item.icon && <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>}
                          <span>{item.label}</span>
                        </Link>

                        {/* Children 아이템 (예: 콘텐츠 > 교재 > 등록) */}
                        {item.children && item.children.length > 0 && (
                          <div className="flex flex-col gap-1 pl-6" role="group" aria-label={`${item.label} 하위 메뉴`}>
                            {item.children.map((child) => {
                              const childActive = isItemActive(safePathname, child, searchParams);
                              return (
                                <Link
                                  key={child.id}
                                  href={child.href}
                                  onClick={handleLinkClick}
                                  className={getChildItemClasses({
                                    isActive: childActive,
                                  })}
                                  aria-current={childActive ? "page" : undefined}
                                >
                                  {child.icon && <span className="flex-shrink-0" aria-hidden="true">{child.icon}</span>}
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
    });
  }, [categories, expandedCategories, activeCategoryInfo, isCollapsed, safePathname, searchParams, role, handleLinkClick, handleKeyDown, toggleCategory, isCategoryActive]);

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="메인 네비게이션" role="navigation">
      {categoryElements}
    </nav>
  );
}

