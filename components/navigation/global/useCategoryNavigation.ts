import { useCallback, useEffect, useRef } from "react";
import type { NavigationCategory } from "./categoryConfig";
import {
  getNextCategoryIndex,
  getPrevCategoryIndex,
  findCategoryBySearch,
} from "./categoryNavUtils";

type UseCategoryNavigationProps = {
  categories: NavigationCategory[];
  toggleCategory: (categoryId: string) => void;
};

export function useCategoryNavigation({
  categories,
  toggleCategory,
}: UseCategoryNavigationProps) {
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
    try {
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
    } catch (error) {
      console.error("Keyboard navigation error:", error);
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

  return {
    categoryRefs,
    handleKeyDown,
  };
}
