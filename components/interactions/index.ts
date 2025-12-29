/**
 * Interactions - 인터랙션 컴포넌트
 *
 * 고급 사용자 인터랙션을 위한 컴포넌트들을 제공합니다.
 *
 * ## 컴포넌트 개요
 *
 * 1. **FloatingWidget** - 떠다니는 위젯
 *    - 드래그 가능
 *    - 최소화/닫기 지원
 *    - 다중 위젯 관리
 *
 * 2. **FloatingTimer** - 플로팅 타이머
 *    - 미니 플레이어 모드
 *    - 재생/일시정지/정지 컨트롤
 *
 * 3. **ContextMenu** - 컨텍스트 메뉴
 *    - 우클릭 메뉴
 *    - 서브메뉴 지원
 *    - 단축키 힌트
 *
 * 4. **DragDrop** - 드래그 앤 드롭
 *    - 리스트 정렬
 *    - 드래그 핸들
 *    - 다중 컨테이너 지원
 *
 * @module interactions
 */

// ============================================================================
// FloatingWidget
// ============================================================================

export {
  FloatingWidget,
  FloatingWidgetManager,
  FloatingTimer,
  type FloatingPosition,
  type FloatingWidgetPosition,
  type FloatingWidgetProps,
  type FloatingTimerProps,
} from "./FloatingWidget";

// ============================================================================
// ContextMenu
// ============================================================================

export {
  ContextMenu,
  ContextMenuProvider,
  ContextMenuTrigger,
  useContextMenu,
  createTableRowMenuItems,
  createCardMenuItems,
  type ContextMenuItem,
  type ContextMenuPosition,
  type ContextMenuProps,
  type ContextMenuTriggerProps,
} from "./ContextMenu";

// ============================================================================
// DragDrop
// ============================================================================

export {
  DragDropProvider,
  Droppable,
  Draggable,
  SortableList,
  DragHandle,
  useDragDrop,
  reorderArray,
  moveItem,
  type DragItem,
  type DropResult,
  type DragDropContextValue,
  type SortableListProps,
  type DragHandleProps,
  type DroppableProps,
  type DraggableProps,
} from "./DragDrop";
