"use client";

import React, { useState, useEffect, useRef, useId, ReactNode, ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type DropdownMenuContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  triggerId: string;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within DropdownMenu.Root");
  }
  return context;
}

type DropdownMenuRootProps = {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function DropdownMenuRoot({ children, open: controlledOpen, onOpenChange: controlledOnOpenChange }: DropdownMenuRootProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange || (() => {}) : setInternalOpen;

  const contentId = useId();
  const triggerId = useId();

  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange, contentId, triggerId }}>
      <div className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

function DropdownMenuTrigger({ asChild, className, children, ...props }: DropdownMenuTriggerProps) {
  const { open, onOpenChange, triggerId } = useDropdownMenuContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenChange(!open);
    props.onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      id: triggerId,
      "aria-haspopup": "true",
      "aria-expanded": open,
      onClick: handleClick,
    } as any);
  }

  return (
    <button
      {...props}
      id={triggerId}
      type="button"
      aria-haspopup="true"
      aria-expanded={open}
      onClick={handleClick}
      className={cn(className)}
    >
      {children}
    </button>
  );
}

type DropdownMenuContentProps = {
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
  sideOffset?: number;
};


function DropdownMenuContent({ 
  children, 
  align = "end", 
  side = "bottom", 
  className,
  sideOffset = 8 
}: DropdownMenuContentProps) {
  const { open, onOpenChange, contentId, triggerId } = useDropdownMenuContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const itemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      // 트리거 요소 찾기
      const triggerElement = document.getElementById(triggerId);
      triggerRef.current = triggerElement;
    }
  }, [open, triggerId]);

  // 외부 클릭 감지
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  // 키보드 네비게이션
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!contentRef.current) return;

      const focusableItems = itemsRef.current.filter(item => {
        if (!item || item.offsetParent === null) return false;
        // HTMLButtonElement인 경우에만 disabled 체크
        if (item instanceof HTMLButtonElement && item.disabled) return false;
        return true;
      });

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          triggerRef.current?.focus();
          break;

        case "ArrowDown":
          e.preventDefault();
          if (focusedIndex === null || focusedIndex >= focusableItems.length - 1) {
            setFocusedIndex(0);
            focusableItems[0]?.focus();
          } else {
            const nextIndex = focusedIndex + 1;
            setFocusedIndex(nextIndex);
            focusableItems[nextIndex]?.focus();
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (focusedIndex === null || focusedIndex <= 0) {
            const lastIndex = focusableItems.length - 1;
            setFocusedIndex(lastIndex);
            focusableItems[lastIndex]?.focus();
          } else {
            const prevIndex = focusedIndex - 1;
            setFocusedIndex(prevIndex);
            focusableItems[prevIndex]?.focus();
          }
          break;

        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          focusableItems[0]?.focus();
          break;

        case "End":
          e.preventDefault();
          const lastIndex = focusableItems.length - 1;
          setFocusedIndex(lastIndex);
          focusableItems[lastIndex]?.focus();
          break;

        case "Tab":
          // Tab 키로 메뉴를 닫음
          onOpenChange(false);
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange, focusedIndex]);

  // DOM에서 focusable items 수집
  useEffect(() => {
    if (open && contentRef.current) {
      const updateItemsRef = () => {
        const menuItems = contentRef.current?.querySelectorAll('[role="menuitem"]') || [];
        itemsRef.current = Array.from(menuItems) as (HTMLAnchorElement | HTMLButtonElement)[];
        
        // 첫 번째 항목에 포커스
        const focusableItems = itemsRef.current.filter(item => {
          if (!item || item.offsetParent === null) return false;
          if (item instanceof HTMLButtonElement && item.disabled) return false;
          return true;
        });
        
        if (focusableItems.length > 0) {
          setFocusedIndex(0);
          focusableItems[0]?.focus();
        }
      };
      
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 실행
      setTimeout(updateItemsRef, 0);
    } else {
      setFocusedIndex(null);
      itemsRef.current = [];
    }
  }, [open]);

  if (!open || !mounted) return null;

  const alignClasses = align === "start" ? "left-0" : "right-0";
  const sideClasses = side === "top" ? "bottom-full mb-1" : "top-full mt-1";

  const content = (
    <div
      ref={contentRef}
      id={contentId}
      role="menu"
      aria-labelledby={triggerId}
      className={cn(
        "absolute z-50 min-w-[200px] rounded-lg border shadow-lg",
        "bg-white dark:bg-gray-800",
        "border-gray-200 dark:border-gray-700",
        "py-1",
        alignClasses,
        sideClasses,
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      style={{ marginTop: side === "bottom" ? sideOffset : undefined, marginBottom: side === "top" ? sideOffset : undefined }}
    >
      {children}
    </div>
  );

  return content;
}

type DropdownMenuItemProps = ComponentPropsWithoutRef<"a" | "button"> & {
  asChild?: boolean;
  href?: string;
  disabled?: boolean;
};

const DropdownMenuItem = React.forwardRef<HTMLAnchorElement | HTMLButtonElement, DropdownMenuItemProps>(
  ({ asChild, className, children, href, disabled, onClick, ...props }, ref) => {
    const { onOpenChange } = useDropdownMenuContext();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement> | React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onOpenChange(false);
      if (onClick) {
        onClick(e as any);
      }
    };

    const baseClasses = cn(
      "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-4 py-2 text-sm outline-none transition-colors",
      "text-gray-700 dark:text-gray-200",
      "hover:bg-gray-100 dark:hover:bg-gray-700",
      "focus:bg-gray-100 dark:focus:bg-gray-700",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      disabled && "pointer-events-none opacity-50",
      className
    );

    if (href) {
      return (
        <Link
          {...(props as ComponentPropsWithoutRef<typeof Link>)}
          href={href}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          onClick={handleClick}
          className={baseClasses}
          role="menuitem"
        >
          {children}
        </Link>
      );
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ref,
        onClick: handleClick,
        className: cn(baseClasses, (children.props as any).className),
        role: "menuitem",
      } as any);
    }

    return (
      <button
        {...(props as ComponentPropsWithoutRef<"button">)}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={baseClasses}
        role="menuitem"
      >
        {children}
      </button>
    );
  }
);

DropdownMenuItem.displayName = "DropdownMenuItem";

type DropdownMenuSeparatorProps = {
  className?: string;
};

function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return (
    <div
      className={cn("my-1 h-px bg-gray-200 dark:bg-gray-700", className)}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}

export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};


