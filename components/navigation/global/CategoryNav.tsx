"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { getCategoriesForRole, type NavigationRole, type NavigationCategory } from "./categoryConfig";
import { isItemActive, type ActiveCategoryInfo } from "./resolveActiveCategory";
import { useSidebar } from "@/components/layout/SidebarContext";
import { isCampMode, ensurePathname, getActiveCategoryWithCampMode } from "@/lib/navigation/utils";
import { getNavItemClasses, getCategoryHeaderClasses, getSubItemClasses, getChildItemClasses, tooltipStyles } from "./navStyles";
import {
  isSingleItemCategory,
  getSingleItemHref,
  isSingleItemActive,
  getCategoryIndex,
  getCategoryAriaLabel,
  getCategoryDescription,
  filterCategoryItemsByRole,
} from "./categoryNavUtils";
import { motion, AnimatePresence } from "framer-motion";
import { useCategoryNavigation } from "./useCategoryNavigation";

type CategoryNavProps = {
  role: NavigationRole;
  className?: string;
  onNavigate?: () => void; // 모바일에서 네비게이션 후 드로어 닫기용
  /** 
   * Context의 isCollapsed 상태를 덮어쓸 값.
   * Hover 등으로 인해 시각적으로만 펼쳐지는 경우, Context는 collapsed여도 이 prop을 false로 전달하여 펼침 UI를 보여줄 수 있음.
   */
  isCollapsed?: boolean; 
};

export function CategoryNav({ role, className, onNavigate, isCollapsed: propIsCollapsed }: CategoryNavProps) {
  const { isCollapsed: contextIsCollapsed } = useSidebar();
  // prop이 있으면 prop 사용, 없으면 context 사용
  const isCollapsed = propIsCollapsed ?? contextIsCollapsed;

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

  const isCategoryActive = useCallback((category: NavigationCategory): boolean => {
    // 기존: activeCategoryInfo의 카테고리 ID만 확인
    if (activeCategoryInfo?.category.id === category.id) {
      return true;
    }
    
    // 개선: 카테고리 내 모든 아이템 확인 (동일 위계 활성 효과 개선)
    return category.items.some(item => {
      // 직접 매칭
      if (isItemActive(safePathname, item, searchParams)) {
        return true;
      }
      // children 확인
      if (item.children) {
        return item.children.some(child => 
          isItemActive(safePathname, child, searchParams)
        );
      }
      return false;
    });
  }, [activeCategoryInfo, safePathname, searchParams]);



  const handleLinkClick = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  const { categoryRefs, handleKeyDown } = useCategoryNavigation({
    categories,
    toggleCategory,
  });

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
            <div className="relative group/nav">
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
                {!isCollapsed ? (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {category.label}
                  </motion.span>
                ) : (
                  <span className="sr-only">{category.label}</span>
                )}
              </Link>
              {/* Collapsed 모드 툴팁 */}
              {isCollapsed && (
                <span className={tooltipStyles.side} role="tooltip">
                  {category.label}
                </span>
              )}
            </div>
          ) : (
            <>
              {/* 카테고리 헤더 */}
              <div className="relative group/nav">
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
                    <AnimatePresence mode="wait">
                      {!isCollapsed ? (
                        <motion.span 
                          className="origin-left"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {category.label}
                        </motion.span>
                      ) : (
                        <span className="sr-only">{category.label}</span>
                      )}
                    </AnimatePresence>
                  </div>
                  {!isCollapsed && (
                    <motion.svg
                      className="h-4 w-4 flex-shrink-0"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  )}
                </button>
                {/* Collapsed 모드 툴팁 */}
                {isCollapsed && (
                  <span className={tooltipStyles.side} role="tooltip">
                    {category.label}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span id={`category-desc-${category.id}`} className="sr-only">
                  {getCategoryDescription(category)}
                </span>
              )}

              {/* 카테고리 아이템들 - Framer Motion Animation */}
              <AnimatePresence initial={false}>
                {!isCollapsed && isExpanded && (
                  <motion.div
                    id={`category-items-${category.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                      opacity: { duration: 0.2, delay: 0.1 }
                    }}
                    role="group"
                    aria-label={`${category.label} 하위 메뉴`}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-1 pl-4 pt-1 pb-1 pr-1">
                      {(() => {
                        // 같은 레벨의 형제 아이템들 중 가장 구체적인 경로만 활성화
                        const filteredItems = filterCategoryItemsByRole(category.items, role);

                        // 모든 아이템의 활성화 상태를 먼저 계산
                        const activeItems = filteredItems.filter(item =>
                          isItemActive(safePathname, item, searchParams)
                        );

                        // 활성화된 아이템들 중 가장 긴 href를 가진 아이템 찾기
                        const longestActiveHref = activeItems.length > 0
                          ? activeItems.reduce((longest, item) =>
                              item.href.length > longest.length ? item.href : longest
                            , "")
                          : "";

                        return filteredItems.map((item, itemIndex) => {
                          // 가장 구체적인 경로만 활성화 (형제 중 중복 방지)
                          const itemActive = isItemActive(safePathname, item, searchParams) &&
                            item.href.length >= longestActiveHref.length;

                          return (
                            <motion.div 
                              key={item.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: itemIndex * 0.05 }}
                            >
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

                              {/* Children 아이템 */}
                              {item.children && item.children.length > 0 && (
                                <div className="flex flex-col gap-1 pl-6" role="group" aria-label={`${item.label} 하위 메뉴`}>
                                  {(() => {
                                    const children = item.children!;
                                    const activeChildren = children.filter(child =>
                                      isItemActive(safePathname, child, searchParams)
                                    );
                                    const longestChildHref = activeChildren.length > 0
                                      ? activeChildren.reduce((longest, child) =>
                                          child.href.length > longest.length ? child.href : longest
                                        , "")
                                      : "";

                                    return children.map((child) => {
                                      const childActive = isItemActive(safePathname, child, searchParams) &&
                                        child.href.length >= longestChildHref.length;
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
                                    });
                                  })()}
                                </div>
                              )}
                            </motion.div>
                          );
                        });
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      );
    });
  }, [
    categories,
    expandedCategories,
    activeCategoryInfo?.category.id, // 전체 객체 대신 ID만
    isCollapsed,
    safePathname,
    searchParams,
    role,
    handleLinkClick,
    handleKeyDown,
    toggleCategory,
    isCategoryActive,
  ]);

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="메인 네비게이션" role="navigation">
      {categoryElements}
    </nav>
  );
}

