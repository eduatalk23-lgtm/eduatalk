"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { getBreadcrumbChain } from "./resolveActiveCategory";
import type { NavigationRole } from "./categoryConfig";
import { useBreadcrumbLabels } from "@/lib/components/BreadcrumbContext";
import { breadcrumbStyles, tooltipStyles } from "./navStyles";
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
        {enrichedChain.map((item, index) => {
          const isLast = index === enrichedChain.length - 1;
          const isLongLabel = item.label.length > 15;
          
          return (
            <BreadcrumbItem
              key={`${item.href}-${index}`}
              item={item}
              isLast={isLast}
              isLongLabel={isLongLabel}
              showSeparator={index > 0}
            />
          );
        })}
      </ol>
    </nav>
  );
}

type BreadcrumbItemProps = {
  item: { label: string; href: string };
  isLast: boolean;
  isLongLabel: boolean;
  showSeparator: boolean;
};

function BreadcrumbItem({ item, isLast, isLongLabel, showSeparator }: BreadcrumbItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const itemRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (itemRef.current && isLongLabel) {
      const element = itemRef.current;
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    }
  }, [isLongLabel]);

  const shouldShowTooltip = isLongLabel && isOverflowing;

  const content = (
    <>
      {showSeparator && (
        <span className={breadcrumbStyles.separator} aria-hidden="true">
          /
        </span>
      )}
      {isLast ? (
        <span
          ref={itemRef as React.RefObject<HTMLSpanElement>}
          className={breadcrumbStyles.current}
          aria-current="page"
          onMouseEnter={() => shouldShowTooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => shouldShowTooltip && setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          {item.label}
          {shouldShowTooltip && showTooltip && (
            <span
              className={tooltipStyles.base}
              role="tooltip"
            >
              {item.label}
              <span className={tooltipStyles.arrow}></span>
            </span>
          )}
        </span>
      ) : (
        <Link
          ref={itemRef as React.RefObject<HTMLAnchorElement>}
          href={item.href}
          className={cn(breadcrumbStyles.link, "relative")}
          onMouseEnter={() => shouldShowTooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => shouldShowTooltip && setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          {item.label}
          {shouldShowTooltip && showTooltip && (
            <span
              className={tooltipStyles.base}
              role="tooltip"
            >
              {item.label}
              <span className={tooltipStyles.arrow}></span>
            </span>
          )}
        </Link>
      )}
    </>
  );

  return (
    <li className="flex items-center gap-1 flex-shrink-0 relative">
      {content}
    </li>
  );
}

