/**
 * 재조정 통계 집계
 * 
 * 재조정 기능의 사용 통계를 집계합니다.
 * 
 * @module lib/reschedule/analytics
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 통계
 */
export interface RescheduleStats {
  totalRequests: number;
  averagePlansPerRequest: number;
  failureRate: number;
  averageProcessingTime: number;
  rollbackRate: number;
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
}

/**
 * 재조정 통계 상세
 */
export interface RescheduleStatsDetail extends RescheduleStats {
  byStatus: {
    pending: number;
    completed: number;
    failed: number;
    rolled_back: number;
  };
  byDay: Array<{
    date: string;
    count: number;
    averagePlans: number;
  }>;
}

// ============================================
// 통계 조회 함수
// ============================================

/**
 * 재조정 통계 조회
 * 
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param period 기간 ('day' | 'week' | 'month')
 * @returns 재조정 통계
 */
export async function getRescheduleStats(
  supabase: SupabaseClient,
  tenantId: string,
  period: 'day' | 'week' | 'month' = 'day'
): Promise<RescheduleStats> {
  // 기간 계산
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = now.toISOString().split('T')[0];

  // 재조정 로그 조회
  const { data: logs, error } = await supabase
    .from('reschedule_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  if (error) {
    console.error('[analytics] 재조정 로그 조회 실패:', error);
    throw new Error(`통계 조회 실패: ${error.message}`);
  }

  if (!logs || logs.length === 0) {
    return {
      totalRequests: 0,
      averagePlansPerRequest: 0,
      failureRate: 0,
      averageProcessingTime: 0,
      rollbackRate: 0,
      period,
      startDate: startDateStr,
      endDate: endDateStr,
    };
  }

  // 통계 계산
  const totalRequests = logs.length;
  const completed = logs.filter((l) => l.status === 'completed').length;
  const failed = logs.filter((l) => l.status === 'failed').length;
  const rolledBack = logs.filter((l) => l.status === 'rolled_back').length;

  const totalPlans = logs.reduce((sum, log) => {
    return sum + (log.plans_before_count || 0);
  }, 0);

  const averagePlansPerRequest = totalRequests > 0 ? totalPlans / totalRequests : 0;
  const failureRate = totalRequests > 0 ? (failed / totalRequests) * 100 : 0;
  const rollbackRate = completed > 0 ? (rolledBack / completed) * 100 : 0;

  // 평균 처리 시간 계산 (completed_at - created_at)
  const processingTimes: number[] = [];
  logs.forEach((log) => {
    if (log.status === 'completed' && log.created_at) {
      // NOTE: completed_at 컬럼 추가 시 정확한 처리 시간 측정 가능
      const createdAt = new Date(log.created_at).getTime();
      const completedAt = new Date().getTime(); // 임시: 현재 시간 사용
      processingTimes.push((completedAt - createdAt) / 1000); // 초 단위
    }
  });

  const averageProcessingTime =
    processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

  return {
    totalRequests,
    averagePlansPerRequest: Math.round(averagePlansPerRequest * 10) / 10,
    failureRate: Math.round(failureRate * 10) / 10,
    averageProcessingTime: Math.round(averageProcessingTime),
    rollbackRate: Math.round(rollbackRate * 10) / 10,
    period,
    startDate: startDateStr,
    endDate: endDateStr,
  };
}

/**
 * 재조정 통계 상세 조회
 * 
 * @param supabase Supabase 클라이언트
 * @param tenantId 테넌트 ID
 * @param period 기간
 * @returns 재조정 통계 상세
 */
export async function getRescheduleStatsDetail(
  supabase: SupabaseClient,
  tenantId: string,
  period: 'day' | 'week' | 'month' = 'day'
): Promise<RescheduleStatsDetail> {
  const basicStats = await getRescheduleStats(supabase, tenantId, period);

  // 기간 계산
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = now.toISOString().split('T')[0];

  // 재조정 로그 조회
  const { data: logs, error } = await supabase
    .from('reschedule_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  if (error) {
    throw new Error(`통계 상세 조회 실패: ${error.message}`);
  }

  // 상태별 집계
  const byStatus = {
    pending: logs?.filter((l) => l.status === 'pending').length || 0,
    completed: logs?.filter((l) => l.status === 'completed').length || 0,
    failed: logs?.filter((l) => l.status === 'failed').length || 0,
    rolled_back: logs?.filter((l) => l.status === 'rolled_back').length || 0,
  };

  // 일별 집계
  const byDayMap = new Map<string, { count: number; totalPlans: number }>();
  
  logs?.forEach((log) => {
    const date = log.created_at.split('T')[0];
    const existing = byDayMap.get(date) || { count: 0, totalPlans: 0 };
    byDayMap.set(date, {
      count: existing.count + 1,
      totalPlans: existing.totalPlans + (log.plans_before_count || 0),
    });
  });

  const byDay = Array.from(byDayMap.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      averagePlans: data.count > 0 ? Math.round((data.totalPlans / data.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...basicStats,
    byStatus,
    byDay,
  };
}

