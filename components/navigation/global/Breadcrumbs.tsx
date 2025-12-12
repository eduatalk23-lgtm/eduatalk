"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBreadcrumbChain } from "./resolveActiveCategory";
import { getAllNavigationItems, type NavigationRole } from "./categoryConfig";
import { useBreadcrumbLabels } from "@/lib/components/BreadcrumbContext";

type BreadcrumbsProps = {
  role: NavigationRole;
  className?: string;
  // 동적 페이지에서 추가 정보 전달 (예: 책 제목, 학생 이름 등)
  dynamicLabels?: Record<string, string>;
};

export function Breadcrumbs({ role, className, dynamicLabels: propDynamicLabels }: BreadcrumbsProps) {
  const pathname = usePathname();
  const contextLabels = useBreadcrumbLabels();
  // props로 전달된 라벨이 우선, 없으면 Context에서 가져옴
  const dynamicLabels = propDynamicLabels || contextLabels || {};
  const chain = getBreadcrumbChain(pathname || "", role);
  const allItems = getAllNavigationItems(role);

  // 동적 라벨 적용 (예: /contents/books/[id] → 책 제목)
  const enrichedChain = chain.map((item) => {
    // 동적 라벨이 제공된 경우 적용
    if (dynamicLabels && dynamicLabels[item.href]) {
      return {
        ...item,
        label: dynamicLabels[item.href],
      };
    }

    // "상세보기" 라벨을 더 구체적으로 변경 시도
    if (item.label === "상세보기") {
      // 경로 패턴 분석하여 더 구체적인 라벨 생성
      const pathSegments = item.href.split("/").filter(Boolean);
      
      // /contents/books/[id] → 책 제목 또는 "교재"
      if (pathSegments.includes("books") && pathSegments.includes("contents")) {
        // 동적 라벨이 제공된 경우 사용 (예: 책 제목)
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        // 동적 라벨이 없으면 "교재" 표시 (추후 동적으로 변경 가능)
        return { ...item, label: "교재" };
      }
      // /contents/lectures/[id] → "강의 상세"
      if (pathSegments.includes("lectures") && pathSegments.includes("contents")) {
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        return { ...item, label: "강의" };
      }
      // /plan/[id] → "플랜 상세"
      if (pathSegments.includes("plan") && pathSegments.length === 2) {
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        return { ...item, label: "플랜 상세" };
      }
      // /plan/[id]/edit → "플랜 수정"
      if (pathSegments.includes("plan") && pathSegments.includes("edit")) {
        return { ...item, label: "플랜 수정" };
      }
      // /contents/books/[id]/edit → "책 수정"
      if (pathSegments.includes("books") && pathSegments.includes("edit")) {
        return { ...item, label: "책 수정" };
      }
      // /contents/lectures/[id]/edit → "강의 수정"
      if (pathSegments.includes("lectures") && pathSegments.includes("edit")) {
        return { ...item, label: "강의 수정" };
      }
      // /goals/[id] → "목표 상세"
      if (pathSegments.includes("goals") && pathSegments.length === 2) {
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        return { ...item, label: "목표 상세" };
      }
      // /scores/[id] → "성적 상세"
      if (pathSegments.includes("scores") && pathSegments.length === 2) {
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        return { ...item, label: "성적 상세" };
      }
      // /admin/students/[id] → "학생 상세"
      if (pathSegments.includes("students") && pathSegments.includes("admin")) {
        if (dynamicLabels && dynamicLabels[item.href]) {
          return { ...item, label: dynamicLabels[item.href] };
        }
        return { ...item, label: "학생 상세" };
      }
    }

    return item;
  });

  // breadcrumb이 없으면 렌더링하지 않음
  if (enrichedChain.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        "flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-100",
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-1 flex-wrap max-w-full">
        {enrichedChain.map((item, index) => (
          <li key={`${item.href}-${index}`} className="flex items-center gap-1 flex-shrink-0">
            {index > 0 && (
              <span className="text-gray-400" aria-hidden="true">
                /
              </span>
            )}
            {index === enrichedChain.length - 1 ? (
              // 마지막 항목은 현재 페이지 (비활성화)
              <span
                className="font-medium text-gray-900 truncate max-w-[150px] sm:max-w-[200px]"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              // 나머지 항목은 링크
              <Link
                href={item.href}
                className="hover:text-gray-900 truncate max-w-[150px] sm:max-w-[200px] transition"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

