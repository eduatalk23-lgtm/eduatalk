/**
 * 관리자 캘린더 뷰 타입 정의
 */

import type { DailyScheduleInfo, PlanExclusion, Plan } from "@/lib/types/plan/domain";
import type { TimeSlot } from "@/lib/types/plan-generation";

// ============================================
// 뷰 모드 타입
// ============================================

/**
 * 관리자 플랜 관리 뷰 모드
 * - dock: 기존 Dock 기반 뷰 (DailyDock)
 * - month: 월간 캘린더 그리드 뷰
 */
export type AdminViewMode = "dock" | "month";

// ============================================
// 캘린더 데이터 타입
// ============================================

/**
 * 캘린더에서 표시할 플랜 데이터
 *
 * Calendar-First: calendar_events에서 변환된 데이터도 포함합니다.
 */
export type CalendarPlan = Pick<
  Plan,
  | "id"
  | "plan_date"
  | "content_type"
  | "content_id"
  | "content_title"
  | "content_subject"
  | "content_subject_category"
  | "status"
  | "start_time"
  | "end_time"
  | "estimated_minutes"
  | "planned_start_page_or_time"
  | "planned_end_page_or_time"
  | "progress"
  | "custom_title"
  | "custom_range_display"
  | "plan_group_id"
  | "container_type"
  | "sequence"
  | "time_slot_type"
  // 1730 Timetable 필드
  | "week"
  | "day"
  | "day_type"
  | "cycle_day_number"
> & {
  /** calendar_events 색상 (GCal 스타일 칩) */
  color?: string | null;
  /** 이벤트가 속한 캘린더 ID (캘린더 색상 해석용) */
  calendar_id?: string | null;
};

/**
 * 날짜별 플랜 그룹
 */
export type PlansByDate = Record<string, CalendarPlan[]>;

/**
 * 날짜별 제외일 정보
 */
export type ExclusionsByDate = Record<string, PlanExclusion>;

/**
 * 날짜별 일일 스케줄 정보
 */
export type DailySchedulesByDate = Record<string, DailyScheduleInfo>;

// ============================================
// 날짜 셀 타입
// ============================================

/**
 * 날짜 셀의 상태
 */
export type DayCellStatus = {
  /** 제외일 여부 */
  isExclusion: boolean;
  /** 제외일 유형 */
  exclusionType?: string;
  /** 제외일 사유 */
  exclusionReason?: string;
  /** 오늘 여부 */
  isToday: boolean;
  /** 선택된 날짜 여부 */
  isSelected: boolean;
  /** 현재 월 여부 */
  isCurrentMonth: boolean;
  /** 과거 날짜 여부 */
  isPast: boolean;
  /** 드래그 오버 여부 */
  isDragOver: boolean;
  /** 1730 Timetable 주차 번호 */
  weekNumber?: number | null;
  /** 1730 Timetable 주기 내 일차 (1-7) */
  cycleDayNumber?: number | null;
  /** 날짜 타입 (학습일/복습일 등) */
  dayType?: string;
};

/**
 * 날짜 셀 통계
 */
export type DayCellStats = {
  /** 총 플랜 개수 */
  totalPlans: number;
  /** 완료된 플랜 개수 */
  completedPlans: number;
  /** 진행 중인 플랜 개수 */
  inProgressPlans: number;
  /** 대기 중인 플랜 개수 */
  pendingPlans: number;
  /** 완료율 (0-100) */
  completionRate: number;
  /** 총 예상 학습 시간 (분) */
  totalEstimatedMinutes: number;
  // Phase 4: 시간대 유형별 플랜 개수
  /** 학습 시간에 배치된 플랜 개수 */
  studySlotPlans?: number;
  /** 자율학습 시간에 배치된 플랜 개수 */
  selfStudySlotPlans?: number;
  /** 시간대 미지정 플랜 개수 */
  noSlotPlans?: number;
};

// ============================================
// 드래그앤드롭 타입
// ============================================

/**
 * 드래그 가능한 플랜 데이터
 */
export type DraggableAdminPlanData = {
  id: string;
  type: "plan";
  title: string;
  originalDate: string;
  originalStartTime: string | null;
  estimatedMinutes: number | null;
  planGroupId: string | null;
  /** Google Calendar 스타일 오버레이용 색상 정보 */
  subject?: string | null;
  status?: string;
  color?: string | null;
  calendarId?: string | null;
  /** 해석된 캘린더 색상 hex (drag overlay 표시용) */
  calendarColor?: string | null;
};

/**
 * 드롭 타겟 데이터
 */
export type DroppableTargetData = {
  date: string;
  isExclusion: boolean;
};

/**
 * 드래그앤드롭 컨텍스트 값
 */
export type AdminCalendarDragContextValue = {
  isDragging: boolean;
  activePlan: DraggableAdminPlanData | null;
  overTarget: DroppableTargetData | null;
  isPending: boolean;
};

// ============================================
// 제외일 관리 타입
// ============================================

/**
 * 제외일 생성 입력
 */
export type CreateExclusionInput = {
  date: string;
  exclusionType: string;
  reason?: string;
};

/**
 * 컨텍스트 메뉴 상태
 */
export type ContextMenuState = {
  isOpen: boolean;
  x: number;
  y: number;
  date: string | null;
  hasExclusion: boolean;
};

// ============================================
// 컴포넌트 Props 타입
// ============================================

/**
 * AdminCalendarView Props
 */
export type AdminCalendarViewProps = {
  studentId: string;
  tenantId: string;
  calendarId: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
  selectedDate: string;
  onDateChange: (date: string) => void;
  calendarExclusions: Array<{
    exclusionDate: string;
    exclusionType: string;
    reason?: string | null;
  }>;
  calendarDailySchedules: DailyScheduleInfo[][];
  /** 날짜별 시간대 타임슬롯 (학습시간, 점심시간, 학원일정 등) */
  dateTimeSlots?: Record<string, TimeSlot[]>;
  /** 타임라인 클릭 시 상세 모달 열기 */
  onTimelineClick?: (date: string) => void;
  onRefresh: () => void;
};

/**
 * AdminMonthView Props
 */
export type AdminMonthViewProps = {
  studentId: string;
  tenantId: string;
  calendarId: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  planGroupId?: string | null;
  currentMonth: Date;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onMonthChange: (date: Date) => void;
  plansByDate: PlansByDate;
  exclusionsByDate: ExclusionsByDate;
  dailySchedulesByDate: DailySchedulesByDate;
  /** 날짜별 시간대 타임슬롯 */
  dateTimeSlots?: Record<string, TimeSlot[]>;
  /** 타임라인 클릭 콜백 */
  onTimelineClick?: (date: string) => void;
  /** @deprecated 레거시 — 월간뷰에서는 더 이상 사용 안 함 (EventDetailPopover로 대체) */
  onPlanClick?: (planId: string) => void;
  onPlanEdit?: (planId: string) => void;
  onPlanDelete?: (planId: string) => void;
  onExclusionToggle: (date: string, hasExclusion: boolean) => void;
  onContextMenu?: (e: React.MouseEvent, date: string, hasExclusion: boolean) => void;
  onRefresh: () => void;
  /** 선택 모드 활성화 여부 */
  isSelectionMode?: boolean;
  /** 선택된 플랜 ID Set */
  selectedPlanIds?: Set<string>;
  /** 플랜 선택 토글 콜백 */
  onPlanSelect?: (planId: string, shiftKey: boolean) => void;
  /** 검색 하이라이트된 플랜 ID Set */
  highlightedPlanIds?: Set<string>;
  /** 날짜 더블클릭 → 일간뷰 전환 + 생성 */
  onDoubleClickDate?: (dateStr: string) => void;
  /** 공휴일 표시 여부 (사이드바 토글) */
  showHolidays?: boolean;
};

/**
 * AdminCalendarDayCell Props
 */
export type AdminCalendarDayCellProps = {
  date: string;
  status: DayCellStatus;
  stats: DayCellStats;
  plans: CalendarPlan[];
  onDateClick: (date: string) => void;
  onPlanClick: (plan: CalendarPlan, anchorRect: DOMRect) => void;
  onContextMenu: (e: React.MouseEvent, date: string) => void;
};

/**
 * AdminCalendarPlanCard Props
 */
export type AdminCalendarPlanCardProps = {
  plan: CalendarPlan;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  compact?: boolean;
};
