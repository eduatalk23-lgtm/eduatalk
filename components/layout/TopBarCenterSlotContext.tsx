"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TopBarCenterSlotContextValue {
  targetRef: React.RefObject<HTMLDivElement | null>;
  isOccupied: boolean;
  setIsOccupied: (occupied: boolean) => void;
}

const TopBarCenterSlotContext =
  createContext<TopBarCenterSlotContextValue | null>(null);

export function TopBarCenterSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [isOccupied, setIsOccupied] = useState(false);

  return (
    <TopBarCenterSlotContext.Provider
      value={{ targetRef, isOccupied, setIsOccupied }}
    >
      {children}
    </TopBarCenterSlotContext.Provider>
  );
}

export function useTopBarCenterSlot() {
  const ctx = useContext(TopBarCenterSlotContext);
  if (!ctx) {
    throw new Error(
      "useTopBarCenterSlot must be used within TopBarCenterSlotProvider"
    );
  }
  return ctx;
}

/**
 * Portal wrapper: mount 시 isOccupied=true, unmount 시 false
 * 자식 컴포넌트를 TopBar 중앙 slot에 렌더링
 */
export function TopBarCenterSlotPortal({
  children,
}: {
  children: ReactNode;
}) {
  const { targetRef, setIsOccupied } = useTopBarCenterSlot();
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsOccupied(true);
    setPortalTarget(targetRef.current);
    return () => {
      setIsOccupied(false);
    };
  }, [targetRef, setIsOccupied]);

  if (!portalTarget) return null;

  return createPortal(children, portalTarget);
}
