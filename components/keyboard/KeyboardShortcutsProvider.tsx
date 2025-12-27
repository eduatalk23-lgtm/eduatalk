"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useGlobalShortcuts, type ShortcutAction, DEFAULT_SHORTCUTS } from "@/lib/hooks/useGlobalShortcuts";
import { ShortcutHelpModal } from "./ShortcutHelpModal";

interface KeyboardShortcutsContextValue {
  showHelp: () => void;
  hideHelp: () => void;
  isHelpVisible: boolean;
  registerHandler: (action: ShortcutAction, handler: () => void) => void;
  unregisterHandler: (action: ShortcutAction) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  }
  return context;
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function KeyboardShortcutsProvider({
  children,
  enabled = true,
}: KeyboardShortcutsProviderProps) {
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [handlers, setHandlers] = useState<Map<ShortcutAction, () => void>>(new Map());

  const showHelp = useCallback(() => setIsHelpVisible(true), []);
  const hideHelp = useCallback(() => setIsHelpVisible(false), []);

  const registerHandler = useCallback((action: ShortcutAction, handler: () => void) => {
    setHandlers((prev) => {
      const next = new Map(prev);
      next.set(action, handler);
      return next;
    });
  }, []);

  const unregisterHandler = useCallback((action: ShortcutAction) => {
    setHandlers((prev) => {
      const next = new Map(prev);
      next.delete(action);
      return next;
    });
  }, []);

  const handleAction = useCallback(
    (action: ShortcutAction) => {
      const handler = handlers.get(action);
      if (handler) {
        handler();
      }
    },
    [handlers]
  );

  // ? 키로 도움말 토글 추가
  const shortcutsWithHelp = [
    ...DEFAULT_SHORTCUTS,
    {
      key: "?",
      shift: true,
      action: "showHelp" as ShortcutAction,
      description: "단축키 도움말",
    },
  ];

  useGlobalShortcuts({
    enabled,
    shortcuts: shortcutsWithHelp,
    onAction: (action) => {
      if (action === ("showHelp" as ShortcutAction)) {
        setIsHelpVisible((prev) => !prev);
      } else {
        handleAction(action);
      }
    },
    onToggleTimer: () => handlers.get("toggleTimer")?.(),
    onCompleteCurrentPlan: () => handlers.get("completeCurrentPlan")?.(),
    onCloseOverlay: () => {
      if (isHelpVisible) {
        hideHelp();
      } else {
        handlers.get("closeOverlay")?.();
      }
    },
  });

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        showHelp,
        hideHelp,
        isHelpVisible,
        registerHandler,
        unregisterHandler,
      }}
    >
      {children}
      <ShortcutHelpModal isOpen={isHelpVisible} onClose={hideHelp} />
    </KeyboardShortcutsContext.Provider>
  );
}
