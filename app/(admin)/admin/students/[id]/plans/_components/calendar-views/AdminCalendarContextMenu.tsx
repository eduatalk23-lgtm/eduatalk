"use client";

/**
 * 관리자 캘린더 컨텍스트 메뉴
 *
 * 날짜 우클릭 시 제외일 설정/해제 옵션을 제공합니다.
 * 화면 경계를 감지하여 메뉴 위치를 자동 조정합니다.
 */

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { X, CalendarOff, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ContextMenuState } from "./_types/adminCalendar";

// 화면 경계로부터의 최소 여백 (px)
const VIEWPORT_PADDING = 8;

interface AdminCalendarContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onAddExclusion: (date: string) => void;
  onRemoveExclusion: (date: string) => void;
}

/**
 * 메뉴 위치 계산
 * 화면 경계를 벗어나지 않도록 자동 조정
 */
function calculateMenuPosition(
  clickX: number,
  clickY: number,
  menuWidth: number,
  menuHeight: number
): { x: number; y: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = clickX;
  let y = clickY;

  // 오른쪽 경계 체크 - 메뉴가 화면 밖으로 나가면 왼쪽으로 표시
  if (clickX + menuWidth + VIEWPORT_PADDING > viewportWidth) {
    x = Math.max(VIEWPORT_PADDING, clickX - menuWidth);
  }

  // 하단 경계 체크 - 메뉴가 화면 밖으로 나가면 위로 표시
  if (clickY + menuHeight + VIEWPORT_PADDING > viewportHeight) {
    y = Math.max(VIEWPORT_PADDING, clickY - menuHeight);
  }

  // 왼쪽 경계 체크
  if (x < VIEWPORT_PADDING) {
    x = VIEWPORT_PADDING;
  }

  // 상단 경계 체크
  if (y < VIEWPORT_PADDING) {
    y = VIEWPORT_PADDING;
  }

  return { x, y };
}

export default function AdminCalendarContextMenu({
  state,
  onClose,
  onAddExclusion,
  onRemoveExclusion,
}: AdminCalendarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);

  // 메뉴가 열릴 때 위치 초기화
  useEffect(() => {
    if (state.isOpen) {
      setAdjustedPosition(null);
    }
  }, [state.isOpen, state.x, state.y]);

  // 메뉴 렌더링 후 위치 조정 (useLayoutEffect로 깜빡임 방지)
  useLayoutEffect(() => {
    if (state.isOpen && menuRef.current && !adjustedPosition) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const newPosition = calculateMenuPosition(
        state.x,
        state.y,
        menuRect.width,
        menuRect.height
      );
      setAdjustedPosition(newPosition);
    }
  }, [state.isOpen, state.x, state.y, adjustedPosition]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (state.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen || !state.date) {
    return null;
  }

  // 메뉴 위치 스타일 (조정된 위치 사용, 없으면 원래 위치)
  const position = adjustedPosition || { x: state.x, y: state.y };
  const menuStyle = {
    top: position.y,
    left: position.x,
    // 위치 계산 전에는 보이지 않게 (깜빡임 방지)
    visibility: adjustedPosition ? "visible" : "hidden",
  } as const;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={menuStyle}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t-lg">
        <span className="text-sm font-medium text-gray-700">{state.date}</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 메뉴 아이템 */}
      <div className="py-1">
        {state.hasExclusion ? (
          // 제외일이 있는 경우: 제외일 해제 옵션
          <button
            onClick={() => {
              onRemoveExclusion(state.date!);
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
              "hover:bg-red-50 text-red-600 transition-colors"
            )}
          >
            <Trash2 className="w-4 h-4" />
            제외일 해제
          </button>
        ) : (
          // 제외일이 없는 경우: 제외일 설정 옵션
          <button
            onClick={() => {
              onAddExclusion(state.date!);
              onClose();
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
              "hover:bg-gray-100 text-gray-700 transition-colors"
            )}
          >
            <CalendarOff className="w-4 h-4" />
            제외일로 설정
          </button>
        )}
      </div>
    </div>
  );
}
