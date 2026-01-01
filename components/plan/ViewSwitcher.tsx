"use client";

/**
 * ViewSwitcher - 뷰 전환 컴포넌트
 *
 * 다양한 뷰 타입 간 전환을 지원합니다:
 * - Calendar (캘린더)
 * - Timeline (타임라인)
 * - Table (테이블)
 * - List (리스트)
 * - Matrix (매트릭스 - Notion 스타일)
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import {
  Calendar,
  Clock,
  Table,
  List,
  Grid3X3,
  ChevronDown,
  Save,
  Star,
  Trash2,
  Check,
} from "lucide-react";
import type { ViewType, PlanView } from "@/lib/types/plan/views";
import { VIEW_TYPE_CONFIG } from "@/lib/types/plan/views";

// ============================================
// 아이콘 매핑
// ============================================

const VIEW_ICONS: Record<ViewType, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  timeline: Clock,
  table: Table,
  list: List,
  matrix: Grid3X3,
};

// ============================================
// 타입 정의
// ============================================

export interface ViewSwitcherProps {
  /** 현재 뷰 타입 */
  currentView: ViewType;
  /** 뷰 변경 핸들러 */
  onViewChange: (view: ViewType) => void;
  /** 저장된 뷰 목록 */
  savedViews?: PlanView[];
  /** 현재 선택된 뷰 ID */
  selectedViewId?: string;
  /** 뷰 저장 핸들러 */
  onSaveView?: (name: string) => void;
  /** 뷰 불러오기 핸들러 */
  onLoadView?: (viewId: string) => void;
  /** 뷰 삭제 핸들러 */
  onDeleteView?: (viewId: string) => void;
  /** 기본 뷰 설정 핸들러 */
  onSetDefaultView?: (viewId: string) => void;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 컴포넌트
// ============================================

export function ViewSwitcher({
  currentView,
  onViewChange,
  savedViews = [],
  selectedViewId,
  onSaveView,
  onLoadView,
  onDeleteView,
  onSetDefaultView,
  compact = false,
  className,
}: ViewSwitcherProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const CurrentIcon = VIEW_ICONS[currentView];

  // 뷰 저장 핸들러
  const handleSave = useCallback(() => {
    if (newViewName.trim() && onSaveView) {
      onSaveView(newViewName.trim());
      setNewViewName("");
      setShowSaveDialog(false);
    }
  }, [newViewName, onSaveView]);

  return (
    <div className={cn("relative inline-flex items-center gap-2", className)}>
      {/* 뷰 타입 버튼 그룹 */}
      <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
        {(Object.keys(VIEW_TYPE_CONFIG) as ViewType[]).map((viewType) => {
          const Icon = VIEW_ICONS[viewType];
          const config = VIEW_TYPE_CONFIG[viewType];
          const isActive = currentView === viewType;

          return (
            <button
              key={viewType}
              onClick={() => onViewChange(viewType)}
              title={config.description}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all",
                compact ? "text-xs" : "text-sm",
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              )}
            >
              <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              {!compact && <span>{config.label}</span>}
            </button>
          );
        })}
      </div>

      {/* 저장된 뷰 드롭다운 */}
      {(savedViews.length > 0 || onSaveView) && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
              textSecondary
            )}
          >
            <span className={compact ? "text-xs" : "text-sm"}>
              {selectedViewId
                ? savedViews.find((v) => v.id === selectedViewId)?.name || "뷰"
                : "저장된 뷰"}
            </span>
            <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </button>

          {/* 드롭다운 메뉴 */}
          {showDropdown && (
            <>
              {/* 배경 클릭 시 닫기 */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />

              <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                {/* 저장된 뷰 목록 */}
                {savedViews.length > 0 && (
                  <>
                    <div className={cn("px-3 py-1.5", textMuted, "text-xs font-medium")}>
                      저장된 뷰
                    </div>
                    {savedViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 group"
                      >
                        <button
                          onClick={() => {
                            onLoadView?.(view.id);
                            setShowDropdown(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 flex-1 text-left",
                            textPrimary,
                            "text-sm"
                          )}
                        >
                          {VIEW_ICONS[view.viewType] && (
                            <span className="h-4 w-4">
                              {(() => {
                                const Icon = VIEW_ICONS[view.viewType];
                                return <Icon className="h-4 w-4" />;
                              })()}
                            </span>
                          )}
                          <span className="truncate">{view.name}</span>
                          {view.isDefault && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                          {view.id === selectedViewId && (
                            <Check className="h-3 w-3 text-green-500" />
                          )}
                        </button>

                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!view.isDefault && onSetDefaultView && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetDefaultView(view.id);
                              }}
                              title="기본 뷰로 설정"
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            >
                              <Star className="h-3 w-3 text-gray-400" />
                            </button>
                          )}
                          {onDeleteView && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteView(view.id);
                              }}
                              title="삭제"
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                  </>
                )}

                {/* 현재 뷰 저장 */}
                {onSaveView && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowSaveDialog(true);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      "hover:bg-gray-50 dark:hover:bg-gray-700",
                      textPrimary,
                      "text-sm"
                    )}
                  >
                    <Save className="h-4 w-4" />
                    <span>현재 뷰 저장</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 뷰 저장 다이얼로그 */}
      {showSaveDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowSaveDialog(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl">
            <h3 className={cn("text-lg font-medium mb-3", textPrimary)}>
              뷰 저장
            </h3>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="뷰 이름을 입력하세요"
              className={cn(
                "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700",
                "bg-white dark:bg-gray-900",
                "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none",
                textPrimary
              )}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowSaveDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className={cn(
                  "px-3 py-1.5 rounded-lg",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  textSecondary
                )}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!newViewName.trim()}
                className={cn(
                  "px-3 py-1.5 rounded-lg",
                  "bg-blue-500 text-white hover:bg-blue-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                저장
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// 간단한 뷰 탭 컴포넌트
// ============================================

export interface ViewTabsProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  views?: ViewType[];
  className?: string;
}

export function ViewTabs({
  currentView,
  onViewChange,
  views = ["calendar", "timeline", "list", "matrix"],
  className,
}: ViewTabsProps) {
  return (
    <div className={cn("flex border-b border-gray-200 dark:border-gray-700", className)}>
      {views.map((viewType) => {
        const Icon = VIEW_ICONS[viewType];
        const config = VIEW_TYPE_CONFIG[viewType];
        const isActive = currentView === viewType;

        return (
          <button
            key={viewType}
            onClick={() => onViewChange(viewType)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
