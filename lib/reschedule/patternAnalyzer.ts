/**
 * 재조정 패턴 분석
 * 
 * 재조정이 필요한 플랜 그룹을 감지하고 추천합니다.
 * 
 * @module lib/reschedule/patternAnalyzer
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdjustmentInput } from './scheduleEngine';

// ============================================
// 타입 정의
// ============================================

/**
 * 재조정 추천
 */
export interface RescheduleRecommendation {
  groupId: string;
  groupName: string | null;
  reason: string;
  suggestedAdjustments: AdjustmentInput[];
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: {
    plansAffected: number;
    datesAffected: number;
  };
}

/**
 * 패턴 분석 결과
 */
export interface PatternAnalysisResult {
  recommendations: RescheduleRecommendation[];
  totalGroups: number;
  analyzedGroups: number;
}

// ============================================
// 패턴 분석 함수
// ============================================

/**
 * 재조정이 필요한 플랜 그룹 감지
 * 
 * 다음 패턴을 감지합니다:
 * 1. 완료율이 낮은 플랜 그룹 (진행이 느림)
 * 2. 계획된 기간이 지났지만 미완료 플랜이 많은 그룹
 * 3. 최근 재조정 후에도 완료율이 개선되지 않은 그룹
 * 
 * @param supabase Supabase 클라이언트
 * @param studentId 학생 ID
 * @returns 재조정 추천 목록
 */
export async function detectRescheduleNeeds(
  supabase: SupabaseClient,
  studentId: string
): Promise<RescheduleRecommendation[]> {
  const recommendations: RescheduleRecommendation[] = [];

  try {
    // 1. 활성 플랜 그룹 조회
    const { data: groups, error: groupsError } = await supabase
      .from('plan_groups')
      .select('id, name, period_start, period_end, status')
      .eq('student_id', studentId)
      .in('status', ['saved', 'active'])
      .is('deleted_at', null);

    if (groupsError || !groups) {
      console.error('[patternAnalyzer] 플랜 그룹 조회 실패:', groupsError);
      return [];
    }

    // 2. 각 플랜 그룹 분석
    for (const group of groups) {
      // 2-1. 플랜 통계 조회
      const { data: plans, error: plansError } = await supabase
        .from('student_plan')
        .select('id, status, is_active, plan_date, actual_end_time')
        .eq('plan_group_id', group.id)
        .eq('student_id', studentId);

      if (plansError || !plans) {
        continue;
      }

      const totalPlans = plans.length;
      const completedPlans = plans.filter(
        (p) => p.status === 'completed' || p.actual_end_time !== null
      ).length;
      const activePlans = plans.filter((p) => p.is_active === true).length;
      const completionRate = totalPlans > 0 ? (completedPlans / totalPlans) * 100 : 0;

      // 2-2. 패턴 1: 완료율이 낮고 기간이 지난 경우
      const now = new Date();
      const periodEnd = new Date(group.period_end);
      const isPeriodOver = now > periodEnd;

      if (isPeriodOver && completionRate < 50 && activePlans > 0) {
        recommendations.push({
          groupId: group.id,
          groupName: group.name,
          reason: `기간이 지났지만 완료율이 ${Math.round(completionRate)}%로 낮습니다.`,
          suggestedAdjustments: [], // TODO: 실제 조정 제안 생성
          priority: 'high',
          estimatedImpact: {
            plansAffected: activePlans,
            datesAffected: 0, // TODO: 실제 영향받는 날짜 계산
          },
        });
      }

      // 2-3. 패턴 2: 진행 속도가 느린 경우 (기간 중반인데 완료율이 30% 미만)
      const periodStart = new Date(group.period_start);
      const periodDuration = periodEnd.getTime() - periodStart.getTime();
      const elapsed = now.getTime() - periodStart.getTime();
      const progressRatio = periodDuration > 0 ? elapsed / periodDuration : 0;

      if (
        progressRatio > 0.5 &&
        progressRatio < 1.0 &&
        completionRate < 30 &&
        activePlans > 0
      ) {
        recommendations.push({
          groupId: group.id,
          groupName: group.name,
          reason: `기간의 ${Math.round(progressRatio * 100)}%가 지났지만 완료율이 ${Math.round(completionRate)}%입니다.`,
          suggestedAdjustments: [],
          priority: 'medium',
          estimatedImpact: {
            plansAffected: activePlans,
            datesAffected: 0,
          },
        });
      }

      // 2-4. 패턴 3: 최근 재조정 후에도 개선되지 않은 경우
      const { data: recentLogs } = await supabase
        .from('reschedule_log')
        .select('created_at, plans_before_count, plans_after_count')
        .eq('plan_group_id', group.id)
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
        const recentLog = recentLogs[0];
        const logDate = new Date(recentLog.created_at);
        const daysSinceReschedule = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

        // 재조정 후 7일 이상 지났는데 완료율이 여전히 낮은 경우
        if (daysSinceReschedule >= 7 && completionRate < 40 && activePlans > 0) {
          recommendations.push({
            groupId: group.id,
            groupName: group.name,
            reason: `최근 재조정 후 ${Math.round(daysSinceReschedule)}일이 지났지만 완료율이 ${Math.round(completionRate)}%로 낮습니다.`,
            suggestedAdjustments: [],
            priority: 'medium',
            estimatedImpact: {
              plansAffected: activePlans,
              datesAffected: 0,
            },
          });
        }
      }
    }

    // 3. 우선순위 정렬 (high > medium > low)
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return recommendations;
  } catch (error) {
    console.error('[patternAnalyzer] 패턴 분석 실패:', error);
    return [];
  }
}

/**
 * 플랜 그룹별 재조정 필요성 점수 계산
 * 
 * @param supabase Supabase 클라이언트
 * @param groupId 플랜 그룹 ID
 * @returns 재조정 필요성 점수 (0-100)
 */
export async function calculateRescheduleScore(
  supabase: SupabaseClient,
  groupId: string
): Promise<number> {
  try {
    // 플랜 그룹 정보 조회
    const { data: group } = await supabase
      .from('plan_groups')
      .select('period_start, period_end')
      .eq('id', groupId)
      .single();

    if (!group) {
      return 0;
    }

    // 플랜 통계 조회
    const { data: plans } = await supabase
      .from('student_plan')
      .select('status, is_active, plan_date, actual_end_time')
      .eq('plan_group_id', groupId);

    if (!plans || plans.length === 0) {
      return 0;
    }

    const totalPlans = plans.length;
    const completedPlans = plans.filter(
      (p) => p.status === 'completed' || p.actual_end_time !== null
    ).length;
    const activePlans = plans.filter((p) => p.is_active === true).length;
    const completionRate = totalPlans > 0 ? (completedPlans / totalPlans) * 100 : 0;

    // 점수 계산 (0-100)
    let score = 0;

    // 완료율이 낮을수록 점수 증가
    score += (100 - completionRate) * 0.5;

    // 기간이 지났는지 확인
    const now = new Date();
    const periodEnd = new Date(group.period_end);
    if (now > periodEnd) {
      score += 30; // 기간 초과 보너스
    }

    // 활성 플랜이 많을수록 점수 증가
    if (activePlans > 0) {
      score += Math.min(activePlans / totalPlans * 20, 20);
    }

    return Math.min(Math.round(score), 100);
  } catch (error) {
    console.error('[patternAnalyzer] 점수 계산 실패:', error);
    return 0;
  }
}

