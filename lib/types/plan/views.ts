/**
 * 플랜 뷰 관련 타입 정의
 *
 * 다중 뷰 시스템을 위한 타입:
 * - ViewType: 지원하는 뷰 타입
 * - MatrixTimeSlot: 매트릭스 뷰용 시간 슬롯 정보 (1교시, 2교시 등)
 * - PlanView: 저장된 뷰 설정
 * - ViewSettings: 뷰별 설정
 *
 * NOTE: timezone.ts의 TimeSlot과 구분하기 위해 MatrixTimeSlot으로 명명
 */

import type { Tables } from "@/lib/supabase/database.types";

// ============================================
// 뷰 타입 정의
// ============================================

/**
 * 지원하는 뷰 타입
 */
export type ViewType = "calendar" | "timeline" | "table" | "list" | "matrix";

/**
 * 뷰 타입별 메타데이터
 */
export const VIEW_TYPE_CONFIG: Record<
  ViewType,
  {
    label: string;
    icon: string;
    description: string;
  }
> = {
  calendar: {
    label: "캘린더",
    icon: "calendar",
    description: "월간/주간 캘린더 형태로 플랜 확인",
  },
  timeline: {
    label: "타임라인",
    icon: "clock",
    description: "시간순으로 플랜 나열",
  },
  table: {
    label: "테이블",
    icon: "table",
    description: "스프레드시트 형태로 플랜 관리",
  },
  list: {
    label: "리스트",
    icon: "list",
    description: "간단한 목록 형태",
  },
  matrix: {
    label: "매트릭스",
    icon: "grid",
    description: "시간 × 요일 매트릭스 (Notion 스타일)",
  },
};

// ============================================
// 시간 슬롯 타입
// ============================================

export type TimeSlotRow = Tables<"time_slots">;

/**
 * 시간 슬롯 타입
 */
export type SlotType = "study" | "break" | "meal" | "free" | "academy";

/**
 * 매트릭스 뷰용 시간 슬롯 정보 (1교시, 2교시 등)
 * NOTE: timezone.ts의 TimeSlot과 구분 - 이것은 교시 정의용
 */
export interface MatrixTimeSlot {
  id: string;
  name: string;
  startTime: string; // HH:mm 형식
  endTime: string; // HH:mm 형식
  order: number;
  type: SlotType;
  color?: string;
  isDefault: boolean;
  isActive: boolean;
}

/**
 * DB Row를 MatrixTimeSlot으로 변환
 */
export function toMatrixTimeSlot(row: TimeSlotRow): MatrixTimeSlot {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    order: row.slot_order,
    type: row.slot_type as SlotType,
    color: row.color ?? undefined,
    isDefault: row.is_default ?? false,
    isActive: row.is_active ?? true,
  };
}

// ============================================
// 플랜 뷰 타입
// ============================================

export type PlanViewRow = Tables<"plan_views">;

/**
 * 뷰 설정 (JSONB)
 */
export interface ViewSettings {
  /** 필터 설정 */
  filters?: {
    status?: ("pending" | "in_progress" | "completed" | "cancelled")[];
    subjects?: string[];
    contentTypes?: ("book" | "lecture" | "custom")[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
  /** 정렬 설정 */
  sort?: {
    field: "start_time" | "subject" | "status" | "created_at";
    direction: "asc" | "desc";
  };
  /** 그룹화 설정 */
  groupBy?: "date" | "subject" | "status" | "none";
  /** 표시 설정 */
  display?: {
    showCompleted?: boolean;
    showEmptySlots?: boolean;
    compactMode?: boolean;
    colorBySubject?: boolean;
  };
  /** 매트릭스 뷰 전용 설정 */
  matrix?: {
    startHour: number; // 시작 시간 (0-23)
    endHour: number; // 종료 시간 (0-23)
    slotDuration: number; // 슬롯 크기 (분)
    showWeekends: boolean;
  };
}

/**
 * 플랜 뷰 정보
 */
export interface PlanView {
  id: string;
  studentId: string;
  tenantId: string;
  name: string;
  viewType: ViewType;
  settings: ViewSettings;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DB Row를 PlanView로 변환
 */
export function toPlanView(row: PlanViewRow): PlanView {
  return {
    id: row.id,
    studentId: row.student_id,
    tenantId: row.tenant_id,
    name: row.name,
    viewType: row.view_type as ViewType,
    settings: (row.settings as ViewSettings) || {},
    isDefault: row.is_default ?? false,
    createdAt: new Date(row.created_at!),
    updatedAt: new Date(row.updated_at!),
  };
}

/**
 * 기본 뷰 설정
 */
export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  filters: {
    status: ["pending", "in_progress"],
  },
  sort: {
    field: "start_time",
    direction: "asc",
  },
  groupBy: "none",
  display: {
    showCompleted: true,
    showEmptySlots: true,
    compactMode: false,
    colorBySubject: true,
  },
  matrix: {
    startHour: 8,
    endHour: 22,
    slotDuration: 50,
    showWeekends: false,
  },
};

// ============================================
// 매트릭스 뷰 전용 타입
// ============================================

/**
 * 요일 타입
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = 일요일

/**
 * 매트릭스 셀 데이터
 */
export interface MatrixCell {
  slotId: string;
  dayOfWeek: DayOfWeek;
  date: string; // YYYY-MM-DD
  plans: MatrixPlanItem[];
  isEmpty: boolean;
}

/**
 * 매트릭스에 표시할 플랜 아이템
 */
export interface MatrixPlanItem {
  id: string;
  title: string;
  subject?: string;
  subjectCategory?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  startTime?: string;
  endTime?: string;
  progress?: number;
  color?: string;
  planType: "student_plan" | "ad_hoc_plan";
  isSimpleCompletion?: boolean;
}

/**
 * 매트릭스 뷰 데이터
 */
export interface MatrixViewData {
  weekStart: Date;
  weekEnd: Date;
  slots: MatrixTimeSlot[];
  days: {
    date: string;
    dayOfWeek: DayOfWeek;
    isToday: boolean;
    isWeekend: boolean;
  }[];
  cells: Map<string, MatrixCell>; // key: `${slotId}-${date}`
}

// ============================================
// 뷰 컨텍스트 타입
// ============================================

/**
 * 뷰 컨텍스트 상태
 */
export interface ViewContextState {
  /** 현재 뷰 타입 */
  currentView: ViewType;
  /** 현재 뷰 설정 */
  settings: ViewSettings;
  /** 저장된 뷰 목록 */
  savedViews: PlanView[];
  /** 현재 선택된 뷰 ID */
  selectedViewId?: string;
  /** 로딩 상태 */
  isLoading: boolean;
}

/**
 * 뷰 컨텍스트 액션
 */
export interface ViewContextActions {
  /** 뷰 타입 변경 */
  setViewType: (type: ViewType) => void;
  /** 설정 업데이트 */
  updateSettings: (settings: Partial<ViewSettings>) => void;
  /** 뷰 저장 */
  saveView: (name: string) => Promise<void>;
  /** 뷰 불러오기 */
  loadView: (viewId: string) => void;
  /** 뷰 삭제 */
  deleteView: (viewId: string) => Promise<void>;
  /** 기본 뷰로 설정 */
  setDefaultView: (viewId: string) => Promise<void>;
}

export type ViewContextValue = ViewContextState & ViewContextActions;
