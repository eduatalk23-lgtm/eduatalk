/**
 * 캠프 학습 진행률 서비스
 * 데이터 조회와 진행률 계산을 통합하여 제공
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import { getCampTemplate, getCampInvitationsForTemplate } from "@/lib/data/campTemplates";
import {
  buildPlanStudyTimeMap,
  calculateTotalStudyMinutes,
  calculateCompletionRate,
  countCompletedPlans,
  calculateSubjectDistribution,
  aggregateParticipantStats,
  createEmptyCampStats,
  type StudySession,
  type Plan,
} from "../utils/progressCalculation";
import type {
  CampLearningStats,
  ParticipantLearningStats,
} from "../types";

// ============================================
// 내부 데이터 조회 함수
// ============================================

interface CampPlanGroup {
  id: string;
  student_id: string;
}

interface CampPlan extends Plan {
  plan_group_id?: string;
}

/**
 * 캠프 플랜 그룹 조회
 */
async function fetchCampPlanGroups(
  templateId: string,
  studentIds: string[]
): Promise<CampPlanGroup[]> {
  if (studentIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .in("student_id", studentIds)
    .is("deleted_at", null);

  if (error) {
    logActionError(
      { domain: "camp", action: "fetchCampPlanGroups" },
      error,
      { templateId }
    );
    return [];
  }

  return data || [];
}

/**
 * 단일 학생의 캠프 플랜 그룹 조회
 */
async function fetchStudentCampPlanGroup(
  templateId: string,
  studentId: string
): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_template_id", templateId)
    .eq("plan_type", "camp")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    logActionError(
      { domain: "camp", action: "fetchStudentCampPlanGroup" },
      error,
      { templateId, studentId }
    );
    return null;
  }

  return data;
}

/**
 * 플랜 목록 조회
 */
async function fetchPlans(
  planGroupIds: string[],
  startDate: string,
  endDate: string
): Promise<CampPlan[]> {
  if (planGroupIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_plan")
    .select("id, student_id, plan_date, completed_amount, subject, status, plan_group_id")
    .in("plan_group_id", planGroupIds)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate);

  if (error) {
    logActionError(
      { domain: "camp", action: "fetchPlans" },
      error,
      { planGroupIds, startDate, endDate }
    );
    return [];
  }

  return (data || []) as CampPlan[];
}

/**
 * 학습 세션 조회
 */
async function fetchStudySessions(planIds: string[]): Promise<StudySession[]> {
  if (planIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_study_sessions")
    .select("plan_id, duration_seconds")
    .in("plan_id", planIds);

  if (error) {
    logActionError(
      { domain: "camp", action: "fetchStudySessions" },
      error,
      { planIds }
    );
    return [];
  }

  return (data || []) as StudySession[];
}

/**
 * 학생 이름 조회
 */
async function fetchStudentName(studentId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  return data?.name || "이름 없음";
}

// ============================================
// 공개 서비스 함수
// ============================================

/**
 * 캠프 전체 학습 통계 계산
 */
export async function calculateCampLearningStats(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<CampLearningStats | null> {
  // 1. 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) return null;

  // 2. 참여자(수락된 초대) 조회
  const invitations = await getCampInvitationsForTemplate(templateId);
  const acceptedInvitations = invitations.filter((inv) => inv.status === "accepted");

  if (acceptedInvitations.length === 0) {
    return createEmptyCampStats(templateId, template.name);
  }

  const participantIds = acceptedInvitations.map((inv) => inv.student_id);

  // 3. 플랜 그룹 조회
  const planGroups = await fetchCampPlanGroups(templateId, participantIds);
  if (planGroups.length === 0) {
    return createEmptyCampStats(templateId, template.name);
  }

  const planGroupIds = planGroups.map((pg) => pg.id);

  // 4. 플랜 및 학습 세션 조회
  const plans = await fetchPlans(planGroupIds, startDate, endDate);
  const planIds = plans.map((p) => p.id);
  const sessions = await fetchStudySessions(planIds);

  // 5. 플랜별 학습 시간 Map 생성
  const timeMap = buildPlanStudyTimeMap(sessions);

  // 6. 참여자별 통계 계산
  const participantStats = acceptedInvitations.map((invitation) => {
    const studentId = invitation.student_id;
    const studentPlans = plans.filter((p) => p.student_id === studentId);

    const studyMinutes = calculateTotalStudyMinutes(studentPlans, timeMap);
    const completedPlans = countCompletedPlans(studentPlans);
    const completionRate = calculateCompletionRate(studentPlans);
    const subjectDistribution = calculateSubjectDistribution(studentPlans, timeMap);

    return {
      student_id: studentId,
      student_name: invitation.student_name || "이름 없음",
      study_minutes: studyMinutes,
      plan_completion_rate: completionRate,
      subject_distribution: subjectDistribution,
      total_plans: studentPlans.length,
      completed_plans: completedPlans,
    };
  });

  // 7. 전체 통계 집계
  const aggregated = aggregateParticipantStats(participantStats);

  return {
    template_id: templateId,
    template_name: template.name,
    total_study_minutes: aggregated.totalStudyMinutes,
    average_study_minutes_per_participant: aggregated.averageStudyMinutes,
    total_plans: aggregated.totalPlans,
    completed_plans: aggregated.completedPlans,
    participant_stats: participantStats,
  };
}

/**
 * 참여자별 학습 통계 계산
 */
export async function calculateParticipantLearningStats(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<ParticipantLearningStats | null> {
  // 1. 플랜 그룹 조회
  const planGroup = await fetchStudentCampPlanGroup(templateId, studentId);
  if (!planGroup) return null;

  // 2. 플랜 조회
  const plans = await fetchPlans([planGroup.id], startDate, endDate);
  if (plans.length === 0) {
    const studentName = await fetchStudentName(studentId);
    return {
      student_id: studentId,
      student_name: studentName,
      study_minutes: 0,
      plan_completion_rate: 0,
      subject_distribution: {},
      total_plans: 0,
      completed_plans: 0,
    };
  }

  // 3. 학습 세션 조회
  const planIds = plans.map((p) => p.id);
  const sessions = await fetchStudySessions(planIds);

  // 4. 통계 계산
  const timeMap = buildPlanStudyTimeMap(sessions);
  const studyMinutes = calculateTotalStudyMinutes(plans, timeMap);
  const completedPlans = countCompletedPlans(plans);
  const completionRate = calculateCompletionRate(plans);
  const subjectDistribution = calculateSubjectDistribution(plans, timeMap);

  // 5. 학생 이름 조회
  const studentName = await fetchStudentName(studentId);

  return {
    student_id: studentId,
    student_name: studentName,
    study_minutes: studyMinutes,
    plan_completion_rate: completionRate,
    subject_distribution: subjectDistribution,
    total_plans: plans.length,
    completed_plans: completedPlans,
  };
}

/**
 * 참여자별 일별 학습 데이터 계산
 */
export async function calculateParticipantDailyProgress(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  date: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
}>> {
  // 1. 플랜 그룹 조회
  const planGroup = await fetchStudentCampPlanGroup(templateId, studentId);
  if (!planGroup) return [];

  // 2. 플랜 조회 (날짜 순 정렬)
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("student_plan")
    .select("id, plan_date, completed_amount, status")
    .eq("plan_group_id", planGroup.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true });

  if (error || !plans || plans.length === 0) return [];

  // 3. 학습 세션 조회
  const planIds = plans.map((p) => p.id);
  const sessions = await fetchStudySessions(planIds);
  const timeMap = buildPlanStudyTimeMap(sessions);

  // 4. 날짜별 그룹화 및 통계 계산
  const dailyDataMap = new Map<string, {
    study_minutes: number;
    completed_plans: number;
    total_plans: number;
  }>();

  for (const plan of plans) {
    const date = plan.plan_date;
    const existing = dailyDataMap.get(date) || {
      study_minutes: 0,
      completed_plans: 0,
      total_plans: 0,
    };

    existing.total_plans += 1;
    existing.study_minutes += timeMap.get(plan.id) || 0;

    if (
      plan.status === "completed" ||
      (plan.completed_amount !== null && plan.completed_amount > 0)
    ) {
      existing.completed_plans += 1;
    }

    dailyDataMap.set(date, existing);
  }

  // 5. 배열로 변환
  return Array.from(dailyDataMap.entries())
    .map(([date, data]) => ({
      date,
      study_minutes: data.study_minutes,
      completed_plans: data.completed_plans,
      total_plans: data.total_plans,
      completion_rate:
        data.total_plans > 0
          ? Math.round((data.completed_plans / data.total_plans) * 100)
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 참여자별 과목별 통계 계산
 */
export async function calculateParticipantSubjectProgress(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  subject: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
  average_study_minutes_per_plan: number;
}>> {
  // 1. 플랜 그룹 조회
  const planGroup = await fetchStudentCampPlanGroup(templateId, studentId);
  if (!planGroup) return [];

  // 2. 플랜 조회 (과목이 있는 것만)
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("student_plan")
    .select("id, plan_date, completed_amount, subject, status")
    .eq("plan_group_id", planGroup.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .not("subject", "is", null);

  if (error || !plans || plans.length === 0) return [];

  // 3. 학습 세션 조회
  const planIds = plans.map((p) => p.id);
  const sessions = await fetchStudySessions(planIds);
  const timeMap = buildPlanStudyTimeMap(sessions);

  // 4. 과목별 그룹화 및 통계 계산
  const subjectDataMap = new Map<string, {
    study_minutes: number;
    completed_plans: number;
    total_plans: number;
  }>();

  for (const plan of plans) {
    if (!plan.subject) continue;

    const existing = subjectDataMap.get(plan.subject) || {
      study_minutes: 0,
      completed_plans: 0,
      total_plans: 0,
    };

    existing.total_plans += 1;
    existing.study_minutes += timeMap.get(plan.id) || 0;

    if (
      plan.status === "completed" ||
      (plan.completed_amount !== null && plan.completed_amount > 0)
    ) {
      existing.completed_plans += 1;
    }

    subjectDataMap.set(plan.subject, existing);
  }

  // 5. 배열로 변환 (학습 시간 순 정렬)
  return Array.from(subjectDataMap.entries())
    .map(([subject, data]) => ({
      subject,
      study_minutes: data.study_minutes,
      completed_plans: data.completed_plans,
      total_plans: data.total_plans,
      completion_rate:
        data.total_plans > 0
          ? Math.round((data.completed_plans / data.total_plans) * 100)
          : 0,
      average_study_minutes_per_plan:
        data.total_plans > 0
          ? Math.round(data.study_minutes / data.total_plans)
          : 0,
    }))
    .sort((a, b) => b.study_minutes - a.study_minutes);
}
