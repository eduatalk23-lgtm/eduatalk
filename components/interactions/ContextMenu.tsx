"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  createContext,
  useContext,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { createPortal } from "react-dom";

// ============================================================================
// Client-Only Hook
// ============================================================================

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 클라이언트 사이드에서만 true를 반환하는 훅
 * SSR에서는 false를 반환
 */
function useIsClient() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

// ============================================================================
// Types
// ============================================================================

export interface ContextMenuItem {
  /** 고유 ID */
  id: string;
  /** 라벨 */
  label: string;
  /** 아이콘 */
  icon?: ReactNode;
  /** 단축키 힌트 */
  shortcut?: string;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 구분선 여부 */
  divider?: boolean;
  /** 위험 액션 여부 (빨간색 표시) */
  danger?: boolean;
  /** 서브메뉴 */
  submenu?: ContextMenuItem[];
  /** 숨김 여부 */
  hidden?: boolean;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  /** 메뉴 아이템 목록 */
  items: ContextMenuItem[];
  /** 트리거 요소 */
  children: ReactNode;
  /** 메뉴 열릴 때 콜백 */
  onOpen?: () => void;
  /** 메뉴 닫힐 때 콜백 */
  onClose?: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 클래스 */
  className?: string;
  /** 메뉴 클래스 */
  menuClassName?: string;
}

export interface ContextMenuTriggerProps {
  /** 트리거 요소 */
  children: ReactNode;
  /** 메뉴 아이템 목록 */
  items: ContextMenuItem[];
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 메뉴 열릴 때 콜백 */
  onOpen?: () => void;
  /** 메뉴 닫힐 때 콜백 */
  onClose?: () => void;
  /** 트리거 클래스 */
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

interface ContextMenuContextValue {
  isOpen: boolean;
  position: ContextMenuPosition | null;
  items: ContextMenuItem[];
  openMenu: (position: ContextMenuPosition, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useContextMenu(): ContextMenuContextValue {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * ContextMenuProvider
 *
 * 전역 컨텍스트 메뉴를 관리합니다.
 *
 * @example
 * <ContextMenuProvider>
 *   <App />
 * </ContextMenuProvider>
 */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const openMenu = useCallback((pos: ContextMenuPosition, menuItems: ContextMenuItem[]) => {
    setPosition(pos);
    setItems(menuItems);
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
    setItems([]);
  }, []);

  return (
    <ContextMenuContext.Provider value={{ isOpen, position, items, openMenu, closeMenu }}>
      {children}
      {isOpen && position && <ContextMenuPortal position={position} items={items} onClose={closeMenu} />}
    </ContextMenuContext.Provider>
  );
}

// ============================================================================
// Menu Portal
// ============================================================================

interface ContextMenuPortalProps {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
}

function ContextMenuPortal({ position, items, onClose }: ContextMenuPortalProps) {
  const isClient = useIsClient();

  if (!isClient) return null;

  return createPortal(
    <ContextMenuContent position={position} items={items} onClose={onClose} />,
    document.body
  );
}

// ============================================================================
// Menu Content
// ============================================================================

interface ContextMenuContentProps {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
  isSubmenu?: boolean;
}

const ContextMenuContent = memo(function ContextMenuContent({
  position,
  items,
  onClose,
  isSubmenu = false,
}: ContextMenuContentProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<ContextMenuPosition | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // 뷰포트 경계 조정
  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    let newX = position.x;
    let newY = position.y;

    // 오른쪽 경계 체크
    if (position.x + rect.width > window.innerWidth) {
      newX = isSubmenu ? position.x - rect.width : window.innerWidth - rect.width - 8;
    }

    // 아래쪽 경계 체크
    if (position.y + rect.height > window.innerHeight) {
      newY = window.innerHeight - rect.height - 8;
    }

    // 왼쪽/위쪽 경계 체크
    newX = Math.max(8, newX);
    newY = Math.max(8, newY);

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, isSubmenu]);

  // 외부 클릭 감지
  useEffect(() => {
    if (isSubmenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose, isSubmenu]);

  // 서브메뉴 열기
  const handleSubmenuOpen = useCallback(
    (itemId: string, itemRef: HTMLButtonElement | null) => {
      if (!itemRef) return;

      const rect = itemRef.getBoundingClientRect();
      setActiveSubmenu(itemId);
      setSubmenuPosition({
        x: rect.right,
        y: rect.top,
      });
    },
    []
  );

  // 아이템 클릭
  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.submenu) return;

      item.onClick?.();
      onClose();
    },
    [onClose]
  );

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <>
      <div
        ref={menuRef}
        className={cn(
          "fixed z-[10000]",
          "min-w-[180px] py-1",
          "bg-white dark:bg-secondary-900",
          "rounded-lg shadow-xl",
          "border border-secondary-200 dark:border-secondary-700",
          "animate-in fade-in-0 zoom-in-95 duration-100"
        )}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {visibleItems.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={`divider-${index}`}
                className="my-1 h-px bg-secondary-200 dark:bg-secondary-700"
              />
            );
          }

          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isSubmenuOpen = activeSubmenu === item.id;

          return (
            <ContextMenuItemComponent
              key={item.id}
              item={item}
              hasSubmenu={hasSubmenu}
              isSubmenuOpen={isSubmenuOpen}
              onClick={() => handleItemClick(item)}
              onSubmenuOpen={(ref) => handleSubmenuOpen(item.id, ref)}
              onSubmenuClose={() => setActiveSubmenu(null)}
            />
          );
        })}
      </div>

      {/* 서브메뉴 */}
      {activeSubmenu && submenuPosition && (
        <ContextMenuContent
          position={submenuPosition}
          items={visibleItems.find((item) => item.id === activeSubmenu)?.submenu ?? []}
          onClose={onClose}
          isSubmenu
        />
      )}
    </>
  );
});

// ============================================================================
// Menu Item
// ============================================================================

interface ContextMenuItemComponentProps {
  item: ContextMenuItem;
  hasSubmenu?: boolean;
  isSubmenuOpen?: boolean;
  onClick: () => void;
  onSubmenuOpen: (ref: HTMLButtonElement | null) => void;
  onSubmenuClose: () => void;
}

const ContextMenuItemComponent = memo(function ContextMenuItemComponent({
  item,
  hasSubmenu,
  isSubmenuOpen,
  onClick,
  onSubmenuOpen,
  onSubmenuClose,
}: ContextMenuItemComponentProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseEnter = useCallback(() => {
    if (hasSubmenu) {
      timeoutRef.current = setTimeout(() => {
        onSubmenuOpen(buttonRef.current);
      }, 150);
    }
  }, [hasSubmenu, onSubmenuOpen]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (!isSubmenuOpen) {
      onSubmenuClose();
    }
  }, [isSubmenuOpen, onSubmenuClose]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={item.disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2",
        "text-sm text-left",
        item.disabled
          ? "text-secondary-400 dark:text-secondary-600 cursor-not-allowed"
          : item.danger
            ? "text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
            : "text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800",
        "transition-colors",
        isSubmenuOpen && "bg-secondary-100 dark:bg-secondary-800"
      )}
    >
      {/* 아이콘 */}
      {item.icon && (
        <span className={cn("flex-shrink-0", item.disabled ? "opacity-50" : "")}>
          {item.icon}
        </span>
      )}

      {/* 라벨 */}
      <span className="flex-1">{item.label}</span>

      {/* 단축키 힌트 */}
      {item.shortcut && !hasSubmenu && (
        <span className="text-xs text-secondary-400 dark:text-secondary-500 ml-4">
          {item.shortcut}
        </span>
      )}

      {/* 서브메뉴 화살표 */}
      {hasSubmenu && (
        <svg
          className="size-4 text-secondary-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
});

// ============================================================================
// Trigger Component
// ============================================================================

/**
 * ContextMenuTrigger
 *
 * 우클릭으로 컨텍스트 메뉴를 여는 트리거 컴포넌트입니다.
 *
 * @example
 * <ContextMenuTrigger
 *   items={[
 *     { id: "edit", label: "편집", icon: <Edit className="size-4" />, onClick: handleEdit },
 *     { id: "delete", label: "삭제", danger: true, onClick: handleDelete },
 *   ]}
 * >
 *   <div className="p-4 border">우클릭하세요</div>
 * </ContextMenuTrigger>
 */
export function ContextMenuTrigger({
  children,
  items,
  disabled = false,
  onOpen,
  onClose,
  className,
}: ContextMenuTriggerProps) {
  const context = useContext(ContextMenuContext);
  const [localOpen, setLocalOpen] = useState(false);
  const [localPosition, setLocalPosition] = useState<ContextMenuPosition | null>(null);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      const position = { x: e.clientX, y: e.clientY };

      if (context) {
        context.openMenu(position, items);
      } else {
        setLocalPosition(position);
        setLocalOpen(true);
      }

      onOpen?.();
    },
    [disabled, items, context, onOpen]
  );

  const handleClose = useCallback(() => {
    setLocalOpen(false);
    setLocalPosition(null);
    onClose?.();
  }, [onClose]);

  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>

      {/* 로컬 메뉴 (Provider 없을 때) */}
      {!context && localOpen && localPosition && (
        <ContextMenuPortal position={localPosition} items={items} onClose={handleClose} />
      )}
    </>
  );
}

// ============================================================================
// Standalone Component
// ============================================================================

/**
 * ContextMenu 컴포넌트
 *
 * 컨텍스트 메뉴와 트리거를 함께 제공하는 컴포넌트입니다.
 *
 * @example
 * <ContextMenu
 *   items={[
 *     { id: "copy", label: "복사", shortcut: "Ctrl+C", onClick: handleCopy },
 *     { id: "paste", label: "붙여넣기", shortcut: "Ctrl+V", onClick: handlePaste },
 *     { id: "divider", divider: true },
 *     { id: "delete", label: "삭제", danger: true, onClick: handleDelete },
 *   ]}
 * >
 *   <Card>우클릭하세요</Card>
 * </ContextMenu>
 */
export function ContextMenu({
  items,
  children,
  onOpen,
  onClose,
  disabled = false,
  className,
}: ContextMenuProps) {
  return (
    <ContextMenuTrigger
      items={items}
      disabled={disabled}
      onOpen={onOpen}
      onClose={onClose}
      className={className}
    >
      {children}
    </ContextMenuTrigger>
  );
}

// ============================================================================
// Utility: Create Context Menu Items
// ============================================================================

/**
 * 테이블 행용 기본 컨텍스트 메뉴 아이템 생성
 */
export function createTableRowMenuItems(options: {
  onView?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  extraItems?: ContextMenuItem[];
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (options.onView) {
    items.push({
      id: "view",
      label: "상세 보기",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: options.onView,
    });
  }

  if (options.onEdit) {
    items.push({
      id: "edit",
      label: "편집",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      shortcut: "Enter",
      onClick: options.onEdit,
    });
  }

  if (options.onDuplicate) {
    items.push({
      id: "duplicate",
      label: "복제",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: options.onDuplicate,
    });
  }

  if (options.extraItems && options.extraItems.length > 0) {
    items.push({ id: "divider-1", label: "", divider: true });
    items.push(...options.extraItems);
  }

  if (options.onDelete) {
    if (items.length > 0) {
      items.push({ id: "divider-delete", label: "", divider: true });
    }
    items.push({
      id: "delete",
      label: "삭제",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      shortcut: "Del",
      danger: true,
      onClick: options.onDelete,
    });
  }

  return items;
}

/**
 * 카드용 기본 컨텍스트 메뉴 아이템 생성
 */
export function createCardMenuItems(options: {
  onOpen?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  extraItems?: ContextMenuItem[];
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (options.onOpen) {
    items.push({
      id: "open",
      label: "열기",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      ),
      onClick: options.onOpen,
    });
  }

  if (options.onEdit) {
    items.push({
      id: "edit",
      label: "편집",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: options.onEdit,
    });
  }

  if (options.onShare) {
    items.push({
      id: "share",
      label: "공유",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      onClick: options.onShare,
    });
  }

  if (options.extraItems && options.extraItems.length > 0) {
    items.push({ id: "divider-1", label: "", divider: true });
    items.push(...options.extraItems);
  }

  if (options.onArchive) {
    items.push({ id: "divider-archive", label: "", divider: true });
    items.push({
      id: "archive",
      label: "보관",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      onClick: options.onArchive,
    });
  }

  if (options.onDelete) {
    if (!options.onArchive && items.length > 0) {
      items.push({ id: "divider-delete", label: "", divider: true });
    }
    items.push({
      id: "delete",
      label: "삭제",
      icon: (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      danger: true,
      onClick: options.onDelete,
    });
  }

  return items;
}

export default ContextMenu;
