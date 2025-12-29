"use client";

import React, {
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type DragEvent,
  createContext,
  useContext,
  memo,
  useMemo,
} from "react";
import { cn } from "@/lib/cn";

// ============================================================================
// Types
// ============================================================================

export interface DragItem<T = unknown> {
  /** 아이템 ID */
  id: string | number;
  /** 아이템 데이터 */
  data: T;
  /** 소스 컨테이너 ID */
  sourceId?: string;
  /** 인덱스 */
  index: number;
}

export interface DropResult<T = unknown> {
  /** 드래그된 아이템 */
  draggedItem: DragItem<T>;
  /** 드롭된 위치 */
  targetIndex: number;
  /** 타겟 컨테이너 ID */
  targetContainerId?: string;
}

export interface DragDropContextValue<T = unknown> {
  /** 현재 드래그 중인 아이템 */
  draggedItem: DragItem<T> | null;
  /** 드래그 시작 */
  startDrag: (item: DragItem<T>) => void;
  /** 드래그 종료 */
  endDrag: () => void;
  /** 드래그 중 여부 */
  isDragging: boolean;
}

export interface SortableListProps<T> {
  /** 아이템 목록 */
  items: T[];
  /** 아이템 키 추출 함수 */
  getItemKey: (item: T) => string | number;
  /** 아이템 렌더러 */
  renderItem: (item: T, index: number, dragHandleProps: DragHandleProps) => ReactNode;
  /** 순서 변경 핸들러 */
  onReorder: (result: { fromIndex: number; toIndex: number; items: T[] }) => void;
  /** 컨테이너 ID */
  containerId?: string;
  /** 드래그 방향 */
  direction?: "vertical" | "horizontal";
  /** 드래그 핸들 사용 */
  useDragHandle?: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 컨테이너 클래스 */
  className?: string;
  /** 아이템 클래스 */
  itemClassName?: string;
  /** 드래그 중 아이템 클래스 */
  draggingClassName?: string;
  /** 드롭 타겟 클래스 */
  dropTargetClassName?: string;
  /** 빈 목록 컴포넌트 */
  emptyComponent?: ReactNode;
  /** 드래그 가능 조건 */
  canDrag?: (item: T) => boolean;
}

export interface DragHandleProps {
  /** 드래그 가능 여부 */
  draggable: boolean;
  /** 드래그 시작 핸들러 */
  onDragStart: (e: DragEvent) => void;
  /** 드래그 종료 핸들러 */
  onDragEnd: (e: DragEvent) => void;
  /** 커서 스타일 */
  className: string;
  /** 역할 */
  role: string;
  /** aria-grabbed */
  "aria-grabbed": boolean;
}

export interface DroppableProps {
  /** 컨테이너 ID */
  id: string;
  /** 자식 요소 */
  children: ReactNode;
  /** 드롭 허용 조건 */
  accept?: (item: DragItem) => boolean;
  /** 드롭 핸들러 */
  onDrop: (result: DropResult) => void;
  /** 드래그 오버 핸들러 */
  onDragOver?: () => void;
  /** 클래스 */
  className?: string;
  /** 드래그 오버 시 클래스 */
  dragOverClassName?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface DraggableProps<T = unknown> {
  /** 아이템 데이터 */
  item: DragItem<T>;
  /** 자식 요소 (render prop) */
  children: (props: {
    dragHandleProps: DragHandleProps;
    isDragging: boolean;
  }) => ReactNode;
  /** 드래그 핸들 사용 */
  useDragHandle?: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
}

// ============================================================================
// Context
// ============================================================================

const DragDropContext = createContext<DragDropContextValue | null>(null);

export function useDragDrop<T = unknown>(): DragDropContextValue<T> {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error("useDragDrop must be used within a DragDropProvider");
  }
  return context as DragDropContextValue<T>;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * DragDropProvider
 *
 * 드래그 앤 드롭 기능을 제공하는 프로바이더입니다.
 *
 * @example
 * <DragDropProvider>
 *   <SortableList items={items} onReorder={handleReorder} />
 * </DragDropProvider>
 */
export function DragDropProvider({ children }: { children: ReactNode }) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);

  const startDrag = useCallback((item: DragItem) => {
    setDraggedItem(item);
  }, []);

  const endDrag = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const isDragging = draggedItem !== null;

  const value = useMemo(
    () => ({ draggedItem, startDrag, endDrag, isDragging }),
    [draggedItem, startDrag, endDrag, isDragging]
  );

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}

// ============================================================================
// Droppable Component
// ============================================================================

/**
 * Droppable 컴포넌트
 *
 * 드롭 가능한 영역을 정의합니다.
 *
 * @example
 * <Droppable id="list-1" onDrop={handleDrop}>
 *   {items.map(item => <DraggableItem key={item.id} item={item} />)}
 * </Droppable>
 */
export function Droppable({
  id,
  children,
  accept,
  onDrop,
  onDragOver,
  className,
  dragOverClassName = "ring-2 ring-primary-500 ring-opacity-50",
  disabled = false,
}: DroppableProps) {
  const [isOver, setIsOver] = useState(false);
  const context = useContext(DragDropContext);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;

      e.preventDefault();

      const item = context?.draggedItem;
      if (!item) return;

      if (accept && !accept(item)) return;

      setIsOver(true);
      onDragOver?.();
    },
    [disabled, context?.draggedItem, accept, onDragOver]
  );

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsOver(false);

      if (disabled) return;

      const item = context?.draggedItem;
      if (!item) return;

      if (accept && !accept(item)) return;

      onDrop({
        draggedItem: item,
        targetIndex: 0, // 기본값, SortableList에서 오버라이드
        targetContainerId: id,
      });
    },
    [disabled, context?.draggedItem, accept, onDrop, id]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(className, isOver && dragOverClassName)}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Draggable Component
// ============================================================================

/**
 * Draggable 컴포넌트
 *
 * 드래그 가능한 아이템을 정의합니다.
 *
 * @example
 * <Draggable item={{ id: 1, data: item, index: 0 }}>
 *   {({ dragHandleProps, isDragging }) => (
 *     <div {...dragHandleProps}>
 *       {item.name}
 *     </div>
 *   )}
 * </Draggable>
 */
export function Draggable<T>({
  item,
  children,
  useDragHandle: _useDragHandle = false,
  disabled = false,
}: DraggableProps<T>) {
  // Note: useDragHandle is reserved for future implementation
  void _useDragHandle;
  const context = useContext(DragDropContext);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      if (disabled) {
        e.preventDefault();
        return;
      }

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(item.id));

      context?.startDrag(item as DragItem);
      setIsDragging(true);

      // 드래그 이미지 지연 설정 (Safari 호환)
      setTimeout(() => {
        const target = e.target as HTMLElement;
        if (target) {
          target.style.opacity = "0.5";
        }
      }, 0);
    },
    [disabled, item, context]
  );

  const handleDragEnd = useCallback(
    (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        target.style.opacity = "1";
      }

      context?.endDrag();
      setIsDragging(false);
    },
    [context]
  );

  const dragHandleProps: DragHandleProps = {
    draggable: !disabled,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    className: disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
    role: "button",
    "aria-grabbed": isDragging,
  };

  return <>{children({ dragHandleProps, isDragging })}</>;
}

// ============================================================================
// SortableList Component
// ============================================================================

/**
 * SortableList 컴포넌트
 *
 * 드래그로 순서를 변경할 수 있는 리스트입니다.
 *
 * @example
 * <SortableList
 *   items={tasks}
 *   getItemKey={(task) => task.id}
 *   renderItem={(task, index, dragHandleProps) => (
 *     <div className="flex items-center gap-2">
 *       <div {...dragHandleProps}>⋮⋮</div>
 *       <span>{task.title}</span>
 *     </div>
 *   )}
 *   onReorder={({ items }) => setTasks(items)}
 * />
 */
function SortableListComponent<T>({
  items,
  getItemKey,
  renderItem,
  onReorder,
  containerId: _containerId = "sortable-list",
  direction = "vertical",
  useDragHandle = true,
  disabled = false,
  className,
  itemClassName,
  draggingClassName = "opacity-50 bg-secondary-100 dark:bg-secondary-800",
  dropTargetClassName = "border-t-2 border-primary-500",
  emptyComponent,
  canDrag,
}: SortableListProps<T>) {
  // Note: containerId is reserved for future multi-container support
  void _containerId;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent) => {
      if (disabled || (canDrag && !canDrag(items[index]))) {
        e.preventDefault();
        return;
      }

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      setDragIndex(index);

      // 드래그 이미지
      setTimeout(() => {
        const target = e.target as HTMLElement;
        if (target) {
          target.style.opacity = "0.5";
        }
      }, 0);
    },
    [disabled, canDrag, items]
  );

  const handleDragEnd = useCallback((e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (target) {
      target.style.opacity = "1";
    }

    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (index: number) => (e: DragEvent) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === index) return;

      setDropIndex(index);
    },
    [dragIndex]
  );

  const handleDrop = useCallback(
    (targetIndex: number) => (e: DragEvent) => {
      e.preventDefault();

      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }

      const newItems = [...items];
      const [removed] = newItems.splice(dragIndex, 1);
      newItems.splice(targetIndex > dragIndex ? targetIndex - 1 : targetIndex, 0, removed);

      onReorder({
        fromIndex: dragIndex,
        toIndex: targetIndex,
        items: newItems,
      });

      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, items, onReorder]
  );

  if (items.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex",
        direction === "vertical" ? "flex-col" : "flex-row",
        className
      )}
    >
      {items.map((item, index) => {
        const key = getItemKey(item);
        const isDragging = dragIndex === index;
        const isDropTarget = dropIndex === index;
        const itemDisabled = disabled || (canDrag && !canDrag(item));

        const dragHandleProps: DragHandleProps = {
          draggable: !itemDisabled,
          onDragStart: handleDragStart(index),
          onDragEnd: handleDragEnd,
          className: itemDisabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          role: "button",
          "aria-grabbed": isDragging,
        };

        return (
          <div
            key={key}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            className={cn(
              itemClassName,
              isDragging && draggingClassName,
              isDropTarget && dropTargetClassName
            )}
          >
            {useDragHandle ? (
              renderItem(item, index, dragHandleProps)
            ) : (
              <div {...dragHandleProps}>
                {renderItem(item, index, dragHandleProps)}
              </div>
            )}
          </div>
        );
      })}

      {/* 마지막 위치 드롭 영역 */}
      {dragIndex !== null && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDropIndex(items.length);
          }}
          onDrop={handleDrop(items.length)}
          className={cn(
            "h-2",
            dropIndex === items.length && dropTargetClassName
          )}
        />
      )}
    </div>
  );
}

export const SortableList = memo(SortableListComponent) as typeof SortableListComponent;

// ============================================================================
// Drag Handle Component
// ============================================================================

/**
 * DragHandle 컴포넌트
 *
 * 드래그 핸들 아이콘을 제공합니다.
 *
 * @example
 * <DragHandle {...dragHandleProps} />
 */
export function DragHandle({
  className,
  ...props
}: Omit<DragHandleProps, "className"> & { className?: string }) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center justify-center p-1",
        "text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300",
        "transition-colors",
        props.draggable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50",
        className
      )}
    >
      <svg
        className="size-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8h16M4 16h16"
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 배열의 아이템 순서를 변경합니다.
 */
export function reorderArray<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * 다른 배열로 아이템을 이동합니다.
 */
export function moveItem<T>(
  source: T[],
  destination: T[],
  fromIndex: number,
  toIndex: number
): { source: T[]; destination: T[] } {
  const sourceClone = [...source];
  const destClone = [...destination];
  const [removed] = sourceClone.splice(fromIndex, 1);
  destClone.splice(toIndex, 0, removed);

  return {
    source: sourceClone,
    destination: destClone,
  };
}

export default SortableList;
