/**
 * 관리자 대시보드 캐싱 전략
 * Next.js Cache API를 활용한 분석 데이터 캐싱
 */

import { unstable_cache } from "next/cache";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 캐시 태그 상수
 */
export const CACHE_TAGS = {
  DASHBOARD_STATS: "dashboard:stats",
  DASHBOARD_TOP_STUDENTS: "dashboard:top-students",
  DASHBOARD_AT_RISK: "dashboard:at-risk",
  DASHBOARD_NOTES: "dashboard:notes",
} as const;

/**
 * 캐시 재검증 시간 (초)
 */
const CACHE_REVALIDATE_TIME = {
  STATS: 60, // 1분
  TOP_STUDENTS: 300, // 5분
  AT_RISK: 600, // 10분
  NOTES: 300, // 5분
} as const;

/**
 * 학생 통계 캐싱
 */
export async function getCachedStudentStatistics(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date,
  getStatsFn: (
    supabase: SupabaseServerClient,
    weekStart: Date,
    weekEnd: Date
  ) => Promise<{
    total: number;
    activeThisWeek: number;
    withScores: number;
    withPlans: number;
  }>
) {
  return unstable_cache(
    async () => {
      return getStatsFn(supabase, weekStart, weekEnd);
    },
    [`dashboard-stats-${weekStart.toISOString()}-${weekEnd.toISOString()}`],
    {
      tags: [CACHE_TAGS.DASHBOARD_STATS],
      revalidate: CACHE_REVALIDATE_TIME.STATS,
    }
  )();
}

/**
 * Top 학생 데이터 캐싱
 */
export async function getCachedTopStudents<T>(
  cacheKey: string,
  getDataFn: () => Promise<T[]>,
  revalidateSeconds: number = CACHE_REVALIDATE_TIME.TOP_STUDENTS
) {
  return unstable_cache(
    async () => {
      return getDataFn();
    },
    [cacheKey],
    {
      tags: [CACHE_TAGS.DASHBOARD_TOP_STUDENTS],
      revalidate: revalidateSeconds,
    }
  )();
}

/**
 * 위험 학생 데이터 캐싱
 */
export async function getCachedAtRiskStudents<T>(
  getDataFn: () => Promise<T[]>
) {
  return unstable_cache(
    async () => {
      return getDataFn();
    },
    ["dashboard-at-risk-students"],
    {
      tags: [CACHE_TAGS.DASHBOARD_AT_RISK],
      revalidate: CACHE_REVALIDATE_TIME.AT_RISK,
    }
  )();
}

/**
 * 상담노트 데이터 캐싱
 */
export async function getCachedConsultingNotes<T>(
  getDataFn: () => Promise<T[]>
) {
  return unstable_cache(
    async () => {
      return getDataFn();
    },
    ["dashboard-consulting-notes"],
    {
      tags: [CACHE_TAGS.DASHBOARD_NOTES],
      revalidate: CACHE_REVALIDATE_TIME.NOTES,
    }
  )();
}

