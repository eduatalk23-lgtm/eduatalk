"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

// ============================================================================
// Types
// ============================================================================

export type CommandType = "navigation" | "action" | "search" | "recent";

export interface Command {
  /** 고유 ID */
  id: string;
  /** 표시 라벨 */
  label: string;
  /** 부가 설명 */
  description?: string;
  /** 아이콘 */
  icon?: ReactNode;
  /** 명령어 타입 */
  type: CommandType;
  /** 그룹 */
  group?: string;
  /** 키보드 단축키 */
  shortcut?: string[];
  /** 실행 함수 */
  action: () => void | Promise<void>;
  /** 검색 키워드 (라벨 외 추가 검색어) */
  keywords?: string[];
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 숨김 여부 */
  hidden?: boolean;
}

export interface CommandGroup {
  id: string;
  label: string;
  priority?: number;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommand: (command: Command) => void;
  unregisterCommand: (id: string) => void;
  registerCommands: (commands: Command[]) => void;
  commands: Command[];
}

export interface CommandPaletteProviderProps {
  children: ReactNode;
  /** 기본 명령어 목록 */
  defaultCommands?: Command[];
  /** 그룹 정의 */
  groups?: CommandGroup[];
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 빈 결과 메시지 */
  emptyMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_GROUPS: CommandGroup[] = [
  { id: "recent", label: "최근", priority: 0 },
  { id: "navigation", label: "페이지 이동", priority: 1 },
  { id: "action", label: "작업", priority: 2 },
  { id: "search", label: "검색", priority: 3 },
];

const typeIcons: Record<CommandType, ReactNode> = {
  navigation: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  action: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  search: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  recent: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

// ============================================================================
// Context
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * CommandPalette 프로바이더
 *
 * Cmd+K (Mac) / Ctrl+K (Windows/Linux)로 열리는 커맨드 팔레트를 제공합니다.
 *
 * @example
 * // 앱 루트에서 사용
 * <CommandPaletteProvider
 *   defaultCommands={[
 *     { id: "dashboard", label: "대시보드", type: "navigation", action: () => router.push("/dashboard") },
 *     { id: "new-plan", label: "새 플랜 만들기", type: "action", action: openNewPlanModal },
 *   ]}
 * >
 *   <App />
 * </CommandPaletteProvider>
 */
export function CommandPaletteProvider({
  children,
  defaultCommands = [],
  groups = DEFAULT_GROUPS,
  placeholder = "검색하거나 명령어 입력...",
  emptyMessage = "결과가 없습니다",
}: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>(defaultCommands);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerCommand = useCallback((command: Command) => {
    setCommands((prev) => {
      const exists = prev.some((c) => c.id === command.id);
      if (exists) {
        return prev.map((c) => (c.id === command.id ? command : c));
      }
      return [...prev, command];
    });
  }, []);

  const unregisterCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const registerCommands = useCallback((newCommands: Command[]) => {
    setCommands((prev) => {
      const merged = [...prev];
      newCommands.forEach((cmd) => {
        const existingIndex = merged.findIndex((c) => c.id === cmd.id);
        if (existingIndex !== -1) {
          merged[existingIndex] = cmd;
        } else {
          merged.push(cmd);
        }
      });
      return merged;
    });
  }, []);

  // 전역 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Cmd+K (Mac) / Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      // ESC로 닫기
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggle, close]);

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        registerCommand,
        unregisterCommand,
        registerCommands,
        commands,
      }}
    >
      {children}
      <CommandPaletteModal
        isOpen={isOpen}
        onClose={close}
        commands={commands}
        groups={groups}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
      />
    </CommandPaletteContext.Provider>
  );
}

// ============================================================================
// Modal Component
// ============================================================================

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  groups: CommandGroup[];
  placeholder: string;
  emptyMessage: string;
}

function CommandPaletteModal({
  isOpen,
  onClose,
  commands,
  groups,
  placeholder,
  emptyMessage,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 필터링된 명령어
  const filteredCommands = useMemo(() => {
    const visibleCommands = commands.filter((cmd) => !cmd.hidden && !cmd.disabled);

    if (!query.trim()) {
      return visibleCommands;
    }

    const lowerQuery = query.toLowerCase();
    return visibleCommands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchDescription = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery));
      return matchLabel || matchDescription || matchKeywords;
    });
  }, [commands, query]);

  // 그룹별로 정렬된 명령어
  const groupedCommands = useMemo(() => {
    const grouped = new Map<string, Command[]>();

    // 그룹 초기화
    groups
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .forEach((g) => grouped.set(g.id, []));
    grouped.set("other", []);

    // 명령어 그룹화
    filteredCommands.forEach((cmd) => {
      const groupId = cmd.group ?? cmd.type;
      if (grouped.has(groupId)) {
        grouped.get(groupId)!.push(cmd);
      } else {
        grouped.get("other")!.push(cmd);
      }
    });

    // 빈 그룹 제거
    const result: { group: CommandGroup; commands: Command[] }[] = [];
    grouped.forEach((cmds, groupId) => {
      if (cmds.length > 0) {
        const group = groups.find((g) => g.id === groupId) ?? { id: groupId, label: groupId };
        result.push({ group, commands: cmds });
      }
    });

    return result;
  }, [filteredCommands, groups]);

  // 평탄화된 명령어 목록 (키보드 네비게이션용)
  const flatCommands = useMemo(() => {
    return groupedCommands.flatMap((g) => g.commands);
  }, [groupedCommands]);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // 선택 인덱스 범위 제한
  useEffect(() => {
    if (selectedIndex >= flatCommands.length) {
      setSelectedIndex(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, selectedIndex]);

  // 선택된 항목 스크롤
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // 명령어 실행
  const executeCommand = useCallback(
    (command: Command) => {
      onClose();
      command.action();
    },
    [onClose]
  );

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            executeCommand(flatCommands[selectedIndex]);
          }
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
          } else {
            setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1));
          }
          break;
      }
    },
    [flatCommands, selectedIndex, executeCommand]
  );

  if (!isOpen) return null;

  let currentFlatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex items-start justify-center pt-[15vh]">
        <div
          className={cn(
            "relative w-full max-w-xl",
            "bg-white dark:bg-gray-900",
            "rounded-xl shadow-2xl",
            "border border-gray-200 dark:border-gray-700",
            "overflow-hidden"
          )}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-800">
            <svg
              className="size-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "flex-1 py-4",
                "bg-transparent",
                "text-gray-900 dark:text-gray-100",
                "placeholder-gray-400 dark:placeholder-gray-500",
                "outline-none",
                "text-base"
              )}
              aria-label="명령어 검색"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
            {flatCommands.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </div>
            ) : (
              groupedCommands.map(({ group, commands: groupCommands }) => (
                <div key={group.id} className="mb-2 last:mb-0">
                  {/* Group Header */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </div>

                  {/* Commands */}
                  {groupCommands.map((command) => {
                    const index = currentFlatIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <CommandItem
                        key={command.id}
                        command={command}
                        isSelected={isSelected}
                        index={index}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↓</kbd>
                이동
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
                실행
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {flatCommands.length}개 결과
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Command Item
// ============================================================================

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  index: number;
  onClick: () => void;
  onMouseEnter: () => void;
}

const CommandItem = memo(function CommandItem({
  command,
  isSelected,
  index,
  onClick,
  onMouseEnter,
}: CommandItemProps) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
        "text-left transition-colors",
        isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      {/* Icon */}
      <span
        className={cn(
          "flex-shrink-0",
          isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"
        )}
      >
        {command.icon ?? typeIcons[command.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {command.description}
          </div>
        )}
      </div>

      {/* Shortcut */}
      {command.shortcut && command.shortcut.length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {command.shortcut.map((key, i) => (
            <kbd
              key={i}
              className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700"
            >
              {key}
            </kbd>
          ))}
        </div>
      )}
    </button>
  );
});

// ============================================================================
// Utility Hook
// ============================================================================

/**
 * 페이지별 명령어 등록 훅
 *
 * @example
 * usePageCommands([
 *   { id: "save", label: "저장", type: "action", shortcut: ["⌘", "S"], action: handleSave },
 * ]);
 */
export function usePageCommands(commands: Command[]) {
  const { registerCommands, unregisterCommand } = useCommandPalette();

  useEffect(() => {
    registerCommands(commands);

    return () => {
      commands.forEach((cmd) => unregisterCommand(cmd.id));
    };
  }, [commands, registerCommands, unregisterCommand]);
}

/**
 * 네비게이션 명령어 생성 헬퍼
 * Note: router must be passed as parameter since this is not a React hook
 */
export function createNavigationCommands(
  routes: { path: string; label: string; description?: string; icon?: ReactNode }[],
  router: ReturnType<typeof useRouter>
): Command[] {
  return routes.map((route) => ({
    id: `nav-${route.path}`,
    label: route.label,
    description: route.description,
    icon: route.icon,
    type: "navigation" as const,
    group: "navigation",
    action: () => router.push(route.path),
  }));
}

/**
 * 네비게이션 명령어 생성 훅 (React 컴포넌트 내에서 사용)
 */
export function useNavigationCommands(
  routes: { path: string; label: string; description?: string; icon?: ReactNode }[]
): Command[] {
  const router = useRouter();

  return useMemo(
    () => createNavigationCommands(routes, router),
    [routes, router]
  );
}

// ============================================================================
// Trigger Button
// ============================================================================

/**
 * 커맨드 팔레트 트리거 버튼
 */
export function CommandPaletteTrigger({
  className,
  showShortcut = true,
}: {
  className?: string;
  showShortcut?: boolean;
}) {
  const { open } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "bg-gray-100 dark:bg-gray-800",
        "text-gray-500 dark:text-gray-400",
        "hover:bg-gray-200 dark:hover:bg-gray-700",
        "transition-colors",
        className
      )}
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <span className="text-sm">검색...</span>
      {showShortcut && (
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 rounded">
          ⌘K
        </kbd>
      )}
    </button>
  );
}

export default CommandPaletteProvider;
