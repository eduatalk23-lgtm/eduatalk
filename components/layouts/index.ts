/**
 * Layouts - 레이아웃 컴포넌트
 *
 * 웹 환경 최적화된 레이아웃 컴포넌트들을 제공합니다.
 *
 * ## 컴포넌트 개요
 *
 * 1. **SplitPane** - Master-Detail 레이아웃
 *    - 리사이즈 가능한 분할 패널
 *    - 목록 + 상세 뷰 패턴
 *
 * 2. **DashboardGrid** - 대시보드 그리드
 *    - 반응형 위젯 그리드
 *    - 12컬럼 시스템
 *
 * 3. **KPISummaryBar** - KPI 요약 바
 *    - 주요 지표 표시
 *    - 트렌드 및 상태 지원
 *
 * 4. **SidePanel** - 사이드 패널
 *    - 슬라이드 아웃 패널
 *    - 필터, 상세 정보 표시
 *
 * 5. **SlideOver** - 스택 가능한 슬라이드오버
 *    - 모달 대체 패널
 *    - 여러 패널 스택 지원
 *
 * 6. **ContextSidebar** - 컨텍스트 사이드바
 *    - 퀵 액션, 최근 활동
 *    - 페이지별 컨텍스트 정보
 *
 * @module layouts
 */

// ============================================================================
// SplitPane (Master-Detail Layout)
// ============================================================================

export {
  SplitPane,
  MasterDetailLayout,
  EditorLayout,
  type SplitDirection,
  type SplitPaneProps,
} from "./SplitPane";

// ============================================================================
// DashboardGrid
// ============================================================================

export {
  DashboardGrid,
  GridItem,
  WidgetCard,
  StandardDashboardLayout,
  ThreeColumnGrid,
  TwoColumnGrid,
  type GridColumns,
  type GridItemSpan,
  type DashboardGridProps,
  type GridItemProps,
  type WidgetCardProps,
} from "./DashboardGrid";

// ============================================================================
// KPISummaryBar
// ============================================================================

export {
  KPISummaryBar,
  SimpleKPIBar,
  StatusKPIBar,
  type KPITrend,
  type KPIStatus,
  type KPIItem,
  type KPISummaryBarProps,
} from "./KPISummaryBar";

// ============================================================================
// SidePanel
// ============================================================================

export {
  SidePanel,
  SidePanelSection,
  FilterSidePanel,
  DetailSidePanel,
  useSidePanel,
  type SidePanelPosition,
  type SidePanelSize,
  type SidePanelMode,
  type SidePanelProps,
  type SidePanelSectionProps,
} from "./SidePanel";

// ============================================================================
// SlideOver (Stackable Slide Panel)
// ============================================================================

export {
  SlideOverProvider,
  SlideOverPanel,
  useSlideOver,
  useSlideOverState,
  type SlideOverSize,
  type SlideOverConfig,
  type SlideOverProviderProps,
  type SlideOverPanelProps,
} from "./SlideOver";

// ============================================================================
// ContextSidebar
// ============================================================================

export {
  ContextSidebar,
  AdminContextSidebar,
  StudentContextSidebar,
  type QuickAction,
  type ActivityItem,
  type SidebarSection,
  type ContextSidebarProps,
} from "./ContextSidebar";
