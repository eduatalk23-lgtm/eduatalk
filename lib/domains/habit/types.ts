/**
 * Habit Domain Types
 * 습관 트래커 도메인 타입 정의
 */

// ============================================
// 기본 타입
// ============================================

export type FrequencyType = 'daily' | 'weekly' | 'custom';

export type HabitStatus = 'active' | 'paused' | 'archived';

// ============================================
// 데이터베이스 타입
// ============================================

export interface Habit {
  id: string;
  tenantId: string;
  studentId: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  frequencyType: FrequencyType;
  frequencyDays: number[]; // 0-6 (일-토)
  targetCount: number;
  currentStreak: number;
  longestStreak: number;
  status: HabitStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  logDate: string;
  completedCount: number;
  isCompleted: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 입력 타입
// ============================================

export interface CreateHabitInput {
  tenantId: string;
  studentId: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  frequencyType?: FrequencyType;
  frequencyDays?: number[];
  targetCount?: number;
}

export interface UpdateHabitInput {
  title?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  frequencyType?: FrequencyType;
  frequencyDays?: number[];
  targetCount?: number;
  status?: HabitStatus;
  orderIndex?: number;
}

export interface CheckInInput {
  habitId: string;
  logDate: string;
  completedCount?: number;
  notes?: string;
}

// ============================================
// 응답 타입
// ============================================

export interface HabitActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// 유틸리티 타입
// ============================================

export interface HabitWithLogs extends Habit {
  logs: HabitLog[];
  todayLog?: HabitLog;
}

export interface HabitStats {
  totalHabits: number;
  activeHabits: number;
  todayCompleted: number;
  currentMaxStreak: number;
}

export interface WeeklyHabitProgress {
  date: string;
  dayOfWeek: number;
  isCompleted: boolean;
  completedCount: number;
  targetCount: number;
}

// ============================================
// 상수
// ============================================

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export const HABIT_ICONS = [
  { name: 'Check', label: '체크' },
  { name: 'BookOpen', label: '책' },
  { name: 'Dumbbell', label: '운동' },
  { name: 'Droplet', label: '물' },
  { name: 'Moon', label: '수면' },
  { name: 'Sun', label: '아침' },
  { name: 'Brain', label: '명상' },
  { name: 'Pencil', label: '글쓰기' },
  { name: 'Music', label: '음악' },
  { name: 'Heart', label: '건강' },
  { name: 'Coffee', label: '커피' },
  { name: 'Apple', label: '식단' },
] as const;

export const HABIT_COLORS = [
  { value: '#3B82F6', label: '파랑' },
  { value: '#10B981', label: '초록' },
  { value: '#F59E0B', label: '주황' },
  { value: '#EF4444', label: '빨강' },
  { value: '#8B5CF6', label: '보라' },
  { value: '#EC4899', label: '분홍' },
  { value: '#06B6D4', label: '시안' },
  { value: '#84CC16', label: '라임' },
] as const;

// ============================================
// 변환 함수
// ============================================

export function dbToHabit(row: Record<string, unknown>): Habit {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studentId: row.student_id as string,
    title: row.title as string,
    description: row.description as string | null,
    icon: row.icon as string,
    color: row.color as string,
    frequencyType: row.frequency_type as FrequencyType,
    frequencyDays: (row.frequency_days as number[]) || [],
    targetCount: row.target_count as number,
    currentStreak: row.current_streak as number,
    longestStreak: row.longest_streak as number,
    status: row.status as HabitStatus,
    orderIndex: row.order_index as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archivedAt: row.archived_at as string | null,
  };
}

export function dbToHabitLog(row: Record<string, unknown>): HabitLog {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    logDate: row.log_date as string,
    completedCount: row.completed_count as number,
    isCompleted: row.is_completed as boolean,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================
// 스트릭 계산
// ============================================

/**
 * 연속 달성 일수 계산
 */
export function calculateStreak(logs: HabitLog[], frequencyDays: number[]): number {
  if (logs.length === 0) return 0;

  // 날짜 내림차순 정렬
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
  );

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const log of sortedLogs) {
    const logDate = new Date(log.logDate);
    logDate.setHours(0, 0, 0, 0);

    const dayOfWeek = logDate.getDay();

    // 해당 요일이 습관 대상 요일인지 확인
    if (frequencyDays.length > 0 && !frequencyDays.includes(dayOfWeek)) {
      continue;
    }

    // 날짜 차이 계산
    const diffDays = Math.floor(
      (currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 연속성 확인 (1일 차이까지 허용)
    if (diffDays > 1) {
      break;
    }

    if (log.isCompleted) {
      streak++;
      currentDate = logDate;
    } else {
      break;
    }
  }

  return streak;
}
