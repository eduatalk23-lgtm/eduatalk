"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
  type MouseEvent,
  memo,
} from "react";
import { cn } from "@/lib/cn";
import { useDensityOptional } from "@/lib/contexts";

// ============================================================================
// Types
// ============================================================================

export interface ColumnDef<T> {
  /** 고유 ID */
  id: string;
  /** 헤더 라벨 */
  header: ReactNode;
  /** 셀 렌더러 */
  cell: (row: T, index: number) => ReactNode;
  /** 정렬 가능 여부 */
  sortable?: boolean;
  /** 정렬 함수 */
  sortFn?: (a: T, b: T) => number;
  /** 기본 너비 (px) */
  width?: number;
  /** 최소 너비 (px) */
  minWidth?: number;
  /** 최대 너비 (px) */
  maxWidth?: number;
  /** 리사이즈 가능 여부 */
  resizable?: boolean;
  /** 고정 위치 */
  sticky?: "left" | "right";
  /** 숨김 가능 여부 */
  hideable?: boolean;
  /** 기본 숨김 상태 */
  defaultHidden?: boolean;
  /** 정렬 */
  align?: "left" | "center" | "right";
  /** 헤더 클래스 */
  headerClassName?: string;
  /** 셀 클래스 */
  cellClassName?: string;
}

export interface ExpandableRowConfig<T> {
  /** 확장 컨텐츠 렌더러 */
  render: (row: T, index: number) => ReactNode;
  /** 확장 가능 조건 */
  canExpand?: (row: T) => boolean;
}

export interface AdvancedTableProps<T> {
  /** 데이터 배열 */
  data: T[];
  /** 컬럼 정의 */
  columns: ColumnDef<T>[];
  /** 고유 키 추출 함수 */
  getRowKey: (row: T, index: number) => string | number;
  /** 확장 가능 행 설정 */
  expandable?: ExpandableRowConfig<T>;
  /** 컬럼 가시성 제어 */
  columnVisibility?: boolean;
  /** 컬럼 리사이즈 제어 */
  columnResize?: boolean;
  /** 내보내기 기능 */
  exportable?: boolean;
  /** 내보내기 파일명 */
  exportFilename?: string;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 빈 상태 컴포넌트 */
  emptyComponent?: ReactNode;
  /** 컨테이너 클래스 */
  className?: string;
  /** 테이블 클래스 */
  tableClassName?: string;
  /** 행 클릭 핸들러 */
  onRowClick?: (row: T, index: number) => void;
  /** 선택된 행 키 목록 */
  selectedKeys?: (string | number)[];
  /** 행 선택 핸들러 */
  onSelectionChange?: (keys: (string | number)[]) => void;
  /** 다중 선택 허용 */
  multiSelect?: boolean;
  /** 정렬 상태 */
  sortState?: { column: string; direction: "asc" | "desc" } | null;
  /** 정렬 변경 핸들러 */
  onSortChange?: (state: { column: string; direction: "asc" | "desc" } | null) => void;
  /** 고정 헤더 */
  stickyHeader?: boolean;
  /** 최대 높이 (스크롤) */
  maxHeight?: string | number;
  /** 줄무늬 배경 */
  striped?: boolean;
  /** 호버 효과 */
  hoverable?: boolean;
  /** 테두리 스타일 */
  bordered?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 50;
const RESIZE_HANDLE_WIDTH = 4;

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 컬럼 가시성 토글 메뉴
 */
function ColumnVisibilityMenuComponent({
  columns,
  hiddenColumns,
  onToggle,
}: {
  columns: ColumnDef<unknown>[];
  hiddenColumns: Set<string>;
  onToggle: (columnId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const hideableColumns = columns.filter((col) => col.hideable !== false);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
          "text-sm text-secondary-600 dark:text-secondary-400",
          "hover:bg-secondary-100 dark:hover:bg-secondary-800",
          "transition-colors"
        )}
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        컬럼
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full z-50",
            "mt-1 min-w-[200px] py-2", // margin for absolute positioning
            "bg-white dark:bg-secondary-900",
            "rounded-lg shadow-lg",
            "border border-secondary-200 dark:border-secondary-700"
          )}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase">
            컬럼 표시/숨기기
          </div>
          {hideableColumns.map((column) => (
            <label
              key={column.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2",
                "hover:bg-secondary-50 dark:hover:bg-secondary-800",
                "cursor-pointer"
              )}
            >
              <input
                type="checkbox"
                checked={!hiddenColumns.has(column.id)}
                onChange={() => onToggle(column.id)}
                className="rounded border-secondary-300 dark:border-secondary-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-secondary-700 dark:text-secondary-300">
                {typeof column.header === "string" ? column.header : column.id}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const ColumnVisibilityMenu = memo(ColumnVisibilityMenuComponent);

/**
 * 내보내기 메뉴
 */
function ExportMenuComponent({
  data,
  columns,
  filename,
}: {
  data: unknown[];
  columns: ColumnDef<unknown>[];
  filename: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const exportToCSV = useCallback(() => {
    const headers = columns.map((col) =>
      typeof col.header === "string" ? col.header : col.id
    );
    const rows = data.map((row, index) =>
      columns.map((col) => {
        const cellValue = col.cell(row, index);
        if (typeof cellValue === "string" || typeof cellValue === "number") {
          return String(cellValue);
        }
        return "";
      })
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  }, [data, columns, filename]);

  const exportToJSON = useCallback(() => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  }, [data, filename]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
          "text-sm text-secondary-600 dark:text-secondary-400",
          "hover:bg-secondary-100 dark:hover:bg-secondary-800",
          "transition-colors"
        )}
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        내보내기
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-50",
            "min-w-[150px] py-1",
            "bg-white dark:bg-secondary-900",
            "rounded-lg shadow-lg",
            "border border-secondary-200 dark:border-secondary-700"
          )}
        >
          <button
            type="button"
            onClick={exportToCSV}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2",
              "text-sm text-secondary-700 dark:text-secondary-300",
              "hover:bg-secondary-50 dark:hover:bg-secondary-800",
              "transition-colors text-left"
            )}
          >
            <span className="text-secondary-400">📄</span>
            CSV로 내보내기
          </button>
          <button
            type="button"
            onClick={exportToJSON}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2",
              "text-sm text-secondary-700 dark:text-secondary-300",
              "hover:bg-secondary-50 dark:hover:bg-secondary-800",
              "transition-colors text-left"
            )}
          >
            <span className="text-secondary-400">📋</span>
            JSON으로 내보내기
          </button>
        </div>
      )}
    </div>
  );
}

const ExportMenu = memo(ExportMenuComponent);

/**
 * 리사이즈 핸들
 */
const ResizeHandle = memo(function ResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        onResize(delta);
        startXRef.current = moveEvent.clientX;
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize]
  );

  return (
    <div
      className={cn(
        "absolute top-0 right-0 bottom-0",
        "w-1 cursor-col-resize",
        "hover:bg-primary-500/50",
        "transition-colors"
      )}
      style={{ width: RESIZE_HANDLE_WIDTH }}
      onMouseDown={handleMouseDown}
    />
  );
});

/**
 * 정렬 아이콘
 */
const SortIcon = memo(function SortIcon({
  direction,
}: {
  direction: "asc" | "desc" | null;
}) {
  if (!direction) {
    return (
      <svg
        className="size-4 text-secondary-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  return (
    <svg
      className={cn("size-4 text-primary-600 dark:text-primary-400")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
      />
    </svg>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * AdvancedTable 컴포넌트
 *
 * 컬럼 가시성, 리사이즈, 행 확장, 내보내기 기능을 지원하는 고급 데이터 테이블입니다.
 *
 * @example
 * <AdvancedTable
 *   data={students}
 *   columns={[
 *     { id: "name", header: "이름", cell: (row) => row.name, sortable: true },
 *     { id: "grade", header: "학년", cell: (row) => `${row.grade}학년`, width: 100 },
 *     { id: "score", header: "점수", cell: (row) => row.score, align: "right" },
 *   ]}
 *   getRowKey={(row) => row.id}
 *   columnVisibility
 *   columnResize
 *   exportable
 *   expandable={{
 *     render: (row) => <StudentDetails student={row} />,
 *   }}
 * />
 */
function AdvancedTableComponent<T>({
  data,
  columns,
  getRowKey,
  expandable,
  columnVisibility = false,
  columnResize = false,
  exportable = false,
  exportFilename = "export",
  isLoading = false,
  emptyMessage = "데이터가 없습니다",
  emptyComponent,
  className,
  tableClassName,
  onRowClick,
  selectedKeys = [],
  onSelectionChange,
  multiSelect = false,
  sortState,
  onSortChange,
  stickyHeader = false,
  maxHeight,
  striped = false,
  hoverable = true,
  bordered = false,
  compact = false,
}: AdvancedTableProps<T>) {
  const { getDensityClasses } = useDensityOptional();

  // 숨겨진 컬럼
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const hidden = new Set<string>();
    columns.forEach((col) => {
      if (col.defaultHidden) hidden.add(col.id);
    });
    return hidden;
  });

  // 컬럼 너비
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      widths[col.id] = col.width ?? DEFAULT_COLUMN_WIDTH;
    });
    return widths;
  });

  // 확장된 행
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  // 내부 정렬 상태 (외부 제어가 없을 때)
  const [internalSortState, setInternalSortState] = useState<{
    column: string;
    direction: "asc" | "desc";
  } | null>(null);

  const effectiveSortState = sortState ?? internalSortState;

  // 가시적인 컬럼
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.has(col.id)),
    [columns, hiddenColumns]
  );

  // 정렬된 데이터
  const sortedData = useMemo(() => {
    if (!effectiveSortState) return data;

    const column = columns.find((col) => col.id === effectiveSortState.column);
    if (!column || !column.sortFn) return data;

    const sorted = [...data].sort(column.sortFn);
    return effectiveSortState.direction === "desc" ? sorted.reverse() : sorted;
  }, [data, columns, effectiveSortState]);

  // 컬럼 토글
  const toggleColumn = useCallback((columnId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  // 컬럼 리사이즈
  const handleResize = useCallback((columnId: string, delta: number) => {
    setColumnWidths((prev) => {
      const col = columns.find((c) => c.id === columnId);
      const minWidth = col?.minWidth ?? MIN_COLUMN_WIDTH;
      const maxWidth = col?.maxWidth ?? Infinity;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, prev[columnId] + delta));
      return { ...prev, [columnId]: newWidth };
    });
  }, [columns]);

  // 행 확장 토글
  const toggleExpand = useCallback((key: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // 행 선택
  const handleRowSelect = useCallback(
    (key: string | number) => {
      if (!onSelectionChange) return;

      if (multiSelect) {
        const newKeys = selectedKeys.includes(key)
          ? selectedKeys.filter((k) => k !== key)
          : [...selectedKeys, key];
        onSelectionChange(newKeys);
      } else {
        onSelectionChange(selectedKeys.includes(key) ? [] : [key]);
      }
    },
    [selectedKeys, onSelectionChange, multiSelect]
  );

  // 정렬 변경
  const handleSort = useCallback(
    (columnId: string) => {
      const newState =
        effectiveSortState?.column === columnId
          ? effectiveSortState.direction === "asc"
            ? { column: columnId, direction: "desc" as const }
            : null
          : { column: columnId, direction: "asc" as const };

      if (onSortChange) {
        onSortChange(newState);
      } else {
        setInternalSortState(newState);
      }
    },
    [effectiveSortState, onSortChange]
  );

  // 셀 정렬 클래스
  const getAlignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  const hasToolbar = columnVisibility || exportable;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar */}
      {hasToolbar && (
        <div className="flex items-center justify-end gap-2">
          {columnVisibility && (
            <ColumnVisibilityMenu
              columns={columns as ColumnDef<unknown>[]}
              hiddenColumns={hiddenColumns}
              onToggle={toggleColumn}
            />
          )}
          {exportable && (
            <ExportMenu data={data as unknown[]} columns={visibleColumns as ColumnDef<unknown>[]} filename={exportFilename} />
          )}
        </div>
      )}

      {/* Table Container */}
      <div
        className={cn(
          "overflow-auto",
          bordered && "border border-secondary-200 dark:border-secondary-700 rounded-lg"
        )}
        style={{ maxHeight }}
      >
        <table
          className={cn(
            "w-full border-collapse",
            tableClassName
          )}
        >
          {/* Header */}
          <thead
            className={cn(
              "bg-secondary-50 dark:bg-secondary-800/50",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {/* Expand Column */}
              {expandable && (
                <th
                  className={cn(
                    "w-10",
                    compact ? "py-2 px-2" : getDensityClasses("tableRow"),
                    "border-b border-secondary-200 dark:border-secondary-700"
                  )}
                />
              )}

              {/* Selection Column */}
              {onSelectionChange && (
                <th
                  className={cn(
                    "w-10",
                    compact ? "py-2 px-2" : getDensityClasses("tableRow"),
                    "border-b border-secondary-200 dark:border-secondary-700"
                  )}
                />
              )}

              {/* Data Columns */}
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "relative font-semibold text-secondary-700 dark:text-secondary-300",
                    compact ? "py-2 px-3" : getDensityClasses("tableRow"),
                    "border-b border-secondary-200 dark:border-secondary-700",
                    getAlignClass(column.align),
                    column.sortable && "cursor-pointer select-none",
                    column.headerClassName
                  )}
                  style={{ width: columnWidths[column.id] }}
                  onClick={column.sortable ? () => handleSort(column.id) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span className="flex-1">{column.header}</span>
                    {column.sortable && (
                      <SortIcon
                        direction={
                          effectiveSortState?.column === column.id
                            ? effectiveSortState.direction
                            : null
                        }
                      />
                    )}
                  </div>

                  {/* Resize Handle */}
                  {columnResize && column.resizable !== false && (
                    <ResizeHandle onResize={(delta) => handleResize(column.id, delta)} />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {expandable && <td className="py-4 px-2" />}
                  {onSelectionChange && <td className="py-4 px-2" />}
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="py-4 px-3">
                      <div className="h-4 bg-secondary-200 dark:bg-secondary-700 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sortedData.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={
                    visibleColumns.length + (expandable ? 1 : 0) + (onSelectionChange ? 1 : 0)
                  }
                  className="py-12 text-center text-secondary-500 dark:text-secondary-400"
                >
                  {emptyComponent ?? emptyMessage}
                </td>
              </tr>
            ) : (
              // Data Rows
              sortedData.map((row, rowIndex) => {
                const rowKey = getRowKey(row, rowIndex);
                const isExpanded = expandedRows.has(rowKey);
                const isSelected = selectedKeys.includes(rowKey);
                const canExpand = expandable?.canExpand?.(row) ?? true;

                return (
                  <>
                    <tr
                      key={rowKey}
                      className={cn(
                        "transition-colors",
                        striped && rowIndex % 2 === 1 && "bg-secondary-50/50 dark:bg-secondary-800/30",
                        hoverable && "hover:bg-secondary-100 dark:hover:bg-secondary-800/50",
                        isSelected && "bg-primary-50 dark:bg-primary-900/20",
                        onRowClick && "cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row, rowIndex)}
                    >
                      {/* Expand Button */}
                      {expandable && (
                        <td
                          className={cn(
                            compact ? "py-2 px-2" : getDensityClasses("tableRow"),
                            "border-b border-secondary-100 dark:border-secondary-800"
                          )}
                        >
                          {canExpand && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(rowKey);
                              }}
                              className={cn(
                                "p-1 rounded",
                                "text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300",
                                "hover:bg-secondary-200 dark:hover:bg-secondary-700",
                                "transition-colors"
                              )}
                            >
                              <svg
                                className={cn(
                                  "size-4 transition-transform",
                                  isExpanded && "rotate-90"
                                )}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                      )}

                      {/* Selection Checkbox */}
                      {onSelectionChange && (
                        <td
                          className={cn(
                            compact ? "py-2 px-2" : getDensityClasses("tableRow"),
                            "border-b border-secondary-100 dark:border-secondary-800"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleRowSelect(rowKey);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-secondary-300 dark:border-secondary-600 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                      )}

                      {/* Data Cells */}
                      {visibleColumns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            "text-secondary-900 dark:text-secondary-100",
                            compact ? "py-2 px-3" : getDensityClasses("tableRow"),
                            "border-b border-secondary-100 dark:border-secondary-800",
                            getAlignClass(column.align),
                            column.cellClassName
                          )}
                          style={{ width: columnWidths[column.id] }}
                        >
                          {column.cell(row, rowIndex)}
                        </td>
                      ))}
                    </tr>

                    {/* Expanded Row */}
                    {expandable && isExpanded && (
                      <tr key={`${rowKey}-expanded`}>
                        <td
                          colSpan={
                            visibleColumns.length +
                            1 +
                            (onSelectionChange ? 1 : 0)
                          }
                          className="bg-secondary-50 dark:bg-secondary-800/30 border-b border-secondary-200 dark:border-secondary-700"
                        >
                          <div className="p-4">{expandable.render(row, rowIndex)}</div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const AdvancedTable = memo(AdvancedTableComponent) as <T>(
  props: AdvancedTableProps<T>
) => React.ReactElement;

export default AdvancedTable;
