/**
 * Gamification Domain Types
 * 업적, XP, 레벨, 스트릭 시스템 타입 정의
 */

// ============================================
// 기본 타입
// ============================================

export type AchievementCategory =
  | 'study_time'
  | 'streak'
  | 'completion'
  | 'special'
  | 'habit'
  | 'level';

export type AchievementTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

// ============================================
// 데이터베이스 타입
// ============================================

export interface AchievementDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: AchievementCategory;
  tier: AchievementTier;
  xpReward: number;
  thresholdValue: number | null;
  iconName: string;
  isActive: boolean;
  isHidden: boolean;
  sortOrder: number;
}

export interface StudentAchievement {
  id: string;
  studentId: string;
  achievementId: string;
  earnedAt: string;
  isNotified: boolean;
}

export interface StudentGamificationStats {
  id: string;
  studentId: string;
  tenantId: string;
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  streakProtectionCount: number;
  totalStudyMinutes: number;
  totalPlansCompleted: number;
  lastStudyDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentStudyHeatmap {
  id: string;
  studentId: string;
  studyDate: string;
  totalMinutes: number;
  plansCompleted: number;
  intensityLevel: number; // 0-4
}

// ============================================
// 응답 타입
// ============================================

export interface GamificationActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AchievementWithDefinition extends StudentAchievement {
  definition: AchievementDefinition;
}

export interface GamificationDashboard {
  stats: StudentGamificationStats;
  achievements: AchievementWithDefinition[];
  recentAchievements: AchievementWithDefinition[];
  unnotifiedAchievements: AchievementWithDefinition[];
  availableAchievements: AchievementDefinition[];
  heatmapData: StudentStudyHeatmap[];
}

export interface LevelInfo {
  level: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  currentProgress: number; // 0-100 percentage
}

// ============================================
// 이벤트 타입
// ============================================

export interface GamificationEvent {
  studentId: string;
  tenantId: string;
  eventType: 'plan_completed' | 'study_session' | 'habit_completed' | 'streak_update';
  studyDurationMinutes?: number;
  completedAt?: Date;
  planId?: string;
  habitId?: string;
}

// ============================================
// 상수
// ============================================

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
};

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아몬드',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  study_time: '학습 시간',
  streak: '스트릭',
  completion: '플랜 완료',
  special: '특별',
  habit: '습관',
  level: '레벨',
};

// ============================================
// 레벨 계산 함수
// ============================================

/**
 * XP로 레벨 계산
 * 레벨 공식: 100 * 1.5^(level-1)
 */
export function calculateLevelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let xpRequired = 100;
  let accumulatedXp = 0;

  while (accumulatedXp + xpRequired <= totalXp) {
    accumulatedXp += xpRequired;
    level++;
    xpRequired = Math.floor(100 * Math.pow(1.5, level - 1));
  }

  const xpInCurrentLevel = totalXp - accumulatedXp;
  const xpForNextLevel = xpRequired;
  const progress = Math.floor((xpInCurrentLevel / xpForNextLevel) * 100);

  return {
    level,
    xpForCurrentLevel: xpInCurrentLevel,
    xpForNextLevel,
    currentProgress: progress,
  };
}

/**
 * 특정 레벨에 도달하기 위해 필요한 총 XP
 */
export function getXpForLevel(targetLevel: number): number {
  let totalXp = 0;
  for (let i = 1; i < targetLevel; i++) {
    totalXp += Math.floor(100 * Math.pow(1.5, i - 1));
  }
  return totalXp;
}

/**
 * 스트릭 보너스 배율 계산 (최대 2배)
 */
export function getStreakMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  // 30일 스트릭에서 최대 2배
  return Math.min(1 + streak * 0.033, 2);
}

/**
 * 학습 강도 레벨 계산 (0-4)
 */
export function calculateIntensityLevel(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

// ============================================
// 변환 함수
// ============================================

export function dbToAchievementDefinition(row: Record<string, unknown>): AchievementDefinition {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    description: row.description as string | null,
    category: row.category as AchievementCategory,
    tier: row.tier as AchievementTier,
    xpReward: row.xp_reward as number,
    thresholdValue: row.threshold_value as number | null,
    iconName: row.icon_name as string,
    isActive: row.is_active as boolean,
    isHidden: row.is_hidden as boolean,
    sortOrder: row.sort_order as number,
  };
}

export function dbToStudentAchievement(row: Record<string, unknown>): StudentAchievement {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    achievementId: row.achievement_id as string,
    earnedAt: row.earned_at as string,
    isNotified: row.is_notified as boolean,
  };
}

export function dbToStudentGamificationStats(row: Record<string, unknown>): StudentGamificationStats {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    tenantId: row.tenant_id as string,
    totalXp: row.total_xp as number,
    currentLevel: row.current_level as number,
    currentStreak: row.current_streak as number,
    longestStreak: row.longest_streak as number,
    streakProtectionCount: row.streak_protection_count as number,
    totalStudyMinutes: row.total_study_minutes as number,
    totalPlansCompleted: row.total_plans_completed as number,
    lastStudyDate: row.last_study_date as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function dbToStudentStudyHeatmap(row: Record<string, unknown>): StudentStudyHeatmap {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    studyDate: row.study_date as string,
    totalMinutes: row.total_minutes as number,
    plansCompleted: row.plans_completed as number,
    intensityLevel: row.intensity_level as number,
  };
}
