"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { getBreadcrumbChain } from "./resolveActiveCategory";
import type { NavigationRole } from "./categoryConfig";
import { useBreadcrumbLabels } from "@/lib/components/BreadcrumbContext";
import { breadcrumbStyles } from "./navStyles";
import { enrichBreadcrumbChain } from "./breadcrumbUtils";

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
  
  // Breadcrumb 체인 생성 및 메모이제이션
  const chain = useMemo(
    () => getBreadcrumbChain(pathname || "", role),
    [pathname, role]
  );

  // 동적 라벨 적용 및 메모이제이션
  const enrichedChain = useMemo(
    () => enrichBreadcrumbChain(chain, dynamicLabels),
    [chain, dynamicLabels]
  );

  // breadcrumb이 없으면 렌더링하지 않음
  if (enrichedChain.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(breadcrumbStyles.container, className)}
      aria-label="Breadcrumb"
    >
      <ol className={breadcrumbStyles.list}>
        {enrichedChain.map((item, index) => (
          <li key={`${item.href}-${index}`} className="flex items-center gap-1 flex-shrink-0">
            {index > 0 && (
              <span className={breadcrumbStyles.separator} aria-hidden="true">
                /
              </span>
            )}
            {index === enrichedChain.length - 1 ? (
              // 마지막 항목은 현재 페이지 (비활성화)
              <span
                className={breadcrumbStyles.current}
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              // 나머지 항목은 링크
              <Link
                href={item.href}
                className={breadcrumbStyles.link}
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

