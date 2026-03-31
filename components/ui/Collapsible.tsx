"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** controlled 모드: 외부에서 열림 상태를 제어 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 헤더 우측 — 접혀 있을 때도 보이는 액션 영역 */
  headerRight?: ReactNode;
  className?: string;
  headerClassName?: string;
}

/**
 * 생기부 도메인 공용 접기/펼치기 컴포넌트
 * controlled/uncontrolled 하이브리드 — SetekEditor 패턴과 동일
 */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  headerRight,
  className,
  headerClassName,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    onOpenChange?.(next);
    if (!isControlled) setInternalOpen(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className={cn("flex w-full items-center gap-2 text-left", headerClassName)}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150",
            isOpen && "rotate-180",
          )}
        />
        <div className="flex-1">{title}</div>
        {headerRight && (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {headerRight}
          </div>
        )}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}
