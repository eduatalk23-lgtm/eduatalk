"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { waffleStyles, layoutStyles } from "@/components/navigation/global/navStyles";
import { getCategoriesForRole, type NavigationCategory } from "@/components/navigation/global/categoryConfig";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import type { RoleBasedLayoutProps } from "./types";

type WaffleMenuProps = {
  role: RoleBasedLayoutProps["role"];
};

export function WaffleMenu({ role }: WaffleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const navRole = mapRoleForNavigation(role);
  const categories = getCategoriesForRole(navRole);

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId) ?? null
    : null;

  const hasSubItems = useCallback((category: NavigationCategory) => {
    return category.items.length > 1 || category.items.some((item) => item.children && item.children.length > 0);
  }, []);

  // 전체 닫기
  const closeAll = useCallback(() => {
    setIsOpen(false);
    setSelectedCategoryId(null);
  }, []);

  // 바깥 클릭 처리: 계층적으로 닫기
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inMainMenu = menuRef.current?.contains(target);
      const inSubMenu = subMenuRef.current?.contains(target);

      if (inMainMenu || inSubMenu) return;

      // 둘 다 바깥 → 전체 닫기
      closeAll();
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedCategoryId) {
          setSelectedCategoryId(null);
        } else {
          closeAll();
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, selectedCategoryId, closeAll]);

  const handleCategoryClick = (category: NavigationCategory) => {
    if (hasSubItems(category)) {
      // 같은 카테고리 다시 클릭 → 하위 닫기
      setSelectedCategoryId((prev) => (prev === category.id ? null : category.id));
    } else {
      const firstHref = category.items[0]?.href;
      if (firstHref) {
        router.push(firstHref);
        closeAll();
      }
    }
  };

  const handleNavigate = (href: string) => {
    router.push(href);
    closeAll();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* 트리거 버튼 */}
      <button
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) setSelectedCategoryId(null);
        }}
        className={waffleStyles.trigger}
        aria-label="앱 메뉴"
        aria-expanded={isOpen}
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {/* 상위 와플 그리드 (항상 표시) */}
      {isOpen && (
        <div className={waffleStyles.dropdown}>
          <div className={waffleStyles.grid}>
            {categories.map((category) => {
              const firstHref = category.items[0]?.href;
              if (!firstHref) return null;
              const isSelected = selectedCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  className={cn(
                    waffleStyles.item,
                    "relative",
                    isSelected && "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] ring-1 ring-primary-300 dark:ring-primary-700"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    isSelected
                      ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300"
                      : "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]",
                    !isSelected && layoutStyles.textSecondary
                  )}>
                    {category.icon || (
                      <span className="text-lg">{category.label.charAt(0)}</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs leading-tight truncate max-w-full",
                    isSelected
                      ? "text-primary-700 dark:text-primary-300 font-medium"
                      : layoutStyles.textSecondary
                  )}>
                    {category.label}
                  </span>
                  {/* 하위 메뉴 인디케이터 */}
                  {hasSubItems(category) && !isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 하위 와플 패널 (상위 왼쪽에 붙음) */}
      {isOpen && selectedCategory && (
        <div
          ref={subMenuRef}
          className={cn(
            "absolute top-full mt-2 w-[240px] rounded-xl",
            "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
            "border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
            "shadow-lg p-3",
            // 상위 dropdown 왼쪽에 위치
            "right-[332px]"
          )}
          style={{ zIndex: 51 }}
        >
          {/* 카테고리 헤더 */}
          <div className={cn(
            "flex items-center gap-2 px-2 py-2 mb-1",
            "text-body-2 font-semibold",
            layoutStyles.textHeading
          )}>
            {selectedCategory.icon && (
              <span className="flex-shrink-0">{selectedCategory.icon}</span>
            )}
            <span>{selectedCategory.label}</span>
          </div>

          {/* 구분선 */}
          <div className={cn(layoutStyles.borderBottom, "mb-1")} />

          {/* 아이템 리스트 */}
          <div className="flex flex-col gap-0.5 max-h-[360px] overflow-y-auto">
            {selectedCategory.items.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => handleNavigate(item.href)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body-2",
                    layoutStyles.textSecondary,
                    layoutStyles.hoverBg,
                    layoutStyles.hoverText,
                    "transition-colors text-left"
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>

                {/* 3단계 children */}
                {item.children && item.children.length > 0 && (
                  <div className="pl-6 flex flex-col gap-0.5">
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => handleNavigate(child.href)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-body-2",
                          layoutStyles.textMuted,
                          layoutStyles.hoverBg,
                          layoutStyles.hoverText,
                          "transition-colors text-left"
                        )}
                      >
                        {child.icon && <span className="flex-shrink-0">{child.icon}</span>}
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
