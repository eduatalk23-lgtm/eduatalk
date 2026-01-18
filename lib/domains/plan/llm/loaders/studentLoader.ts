/**
 * 학생 관련 데이터 로더
 *
 * - loadStudentProfile: 학생 프로필 조회
 * - loadScoreInfo: 성적 + 위험도 분석 조회
 *
 * @module loaders/studentLoader
 */

import type { SupabaseClient } from "./types";
import type { StudentProfile, SubjectScoreInfo } from "../prompts/contentRecommendation";

/**
 * 학생 프로필 조회
 */
export async function loadStudentProfile(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentProfile | null> {
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, school_name, target_university, target_major")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    school: student.school_name ?? undefined,
    targetUniversity: student.target_university ?? undefined,
    targetMajor: student.target_major ?? undefined,
  };
}

/**
 * 성적 및 위험도 분석 데이터 조회
 */
export async function loadScoreInfo(
  supabase: SupabaseClient,
  studentId: string
): Promise<SubjectScoreInfo[]> {
  // 최근 성적 + 위험도 분석 데이터 조회
  const { data: scores } = await supabase
    .from("scores")
    .select(`
      id,
      subject,
      subject_category,
      grade,
      percentile,
      score_type,
      created_at
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!scores || scores.length === 0) return [];

  // 과목별로 그룹화하여 최신 성적 추출
  const subjectMap = new Map<string, SubjectScoreInfo>();

  scores.forEach((score) => {
    const key = `${score.subject_category}-${score.subject}`;

    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subjectId: score.id,
        subject: score.subject,
        subjectCategory: score.subject_category,
        latestGrade: score.grade ?? undefined,
        latestPercentile: score.percentile ?? undefined,
      });
    }
  });

  // 위험도 분석 데이터 조회
  const { data: riskData } = await supabase
    .from("student_risk_analysis")
    .select("subject, risk_score, recent_grade_trend")
    .eq("student_id", studentId);

  if (riskData) {
    riskData.forEach((risk) => {
      // 해당 과목 찾기
      subjectMap.forEach((info, key) => {
        if (info.subject === risk.subject || key.includes(risk.subject)) {
          info.riskScore = risk.risk_score ?? undefined;
          info.recentTrend = risk.recent_grade_trend > 0
            ? "improving"
            : risk.recent_grade_trend < 0
              ? "declining"
              : "stable";
          info.isWeak = (risk.risk_score ?? 0) >= 60;
        }
      });
    });
  }

  return Array.from(subjectMap.values());
}
