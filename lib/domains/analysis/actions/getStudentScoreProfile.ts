"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type ScoreTrend = "improving" | "stable" | "declining";

export interface SubjectScoreInfo {
  subjectId: string;
  subjectName: string;
  subjectGroup: string;
  averageGrade: number;
  recentGrade: number | null;
  trend: ScoreTrend;
  riskScore: number;
  isWeak: boolean;
}

export interface StudentScoreProfile {
  studentId: string;
  overallAverageGrade: number | null;
  mockAverageGrade: number | null;
  weakSubjects: SubjectScoreInfo[];
  allSubjects: SubjectScoreInfo[];
  totalScoreCount: number;
  lastUpdated: string | null;
}

/**
 * 학생의 성적 프로필을 조회합니다.
 * 플랜 위자드에서 성적 연동 패널에 사용됩니다.
 */
export async function getStudentScoreProfile(studentId?: string): Promise<{
  success: boolean;
  data?: StudentScoreProfile;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // 학생 ID 결정
    let targetStudentId = studentId;
    if (!targetStudentId) {
      const user = await getCurrentUser();
      if (!user) {
        return { success: false, error: "로그인이 필요합니다." };
      }
      targetStudentId = user.userId;
    }

    // 1. 내신 성적 조회
    const { data: internalScores, error: internalError } = await supabase
      .from("internal_scores")
      .select(`
        id,
        rank_grade,
        raw_score,
        subject_id,
        grade,
        semester,
        created_at,
        subjects (
          id,
          name,
          subject_groups (
            id,
            name
          )
        )
      `)
      .eq("student_id", targetStudentId)
      .order("created_at", { ascending: false });

    if (internalError) {
      console.error("Internal scores fetch error:", internalError);
    }

    // 2. 모의고사 성적 조회
    const { data: mockScores, error: mockError } = await supabase
      .from("mock_scores")
      .select(`
        id,
        grade_score,
        raw_score,
        subject_id,
        exam_date,
        created_at,
        subjects (
          id,
          name,
          subject_groups (
            id,
            name
          )
        )
      `)
      .eq("student_id", targetStudentId)
      .order("exam_date", { ascending: false });

    if (mockError) {
      console.error("Mock scores fetch error:", mockError);
    }

    // 3. 위험도 분석 조회
    const { data: riskAnalyses } = await supabase
      .from("student_risk_analysis")
      .select("*")
      .eq("student_id", targetStudentId);

    // 4. 과목별 성적 집계
    const subjectMap = new Map<string, {
      subjectId: string;
      subjectName: string;
      subjectGroup: string;
      grades: number[];
      recentGrade: number | null;
      riskScore: number;
    }>();

    // 내신 성적 처리
    for (const score of internalScores || []) {
      if (!score.subjects || !score.rank_grade) continue;

      const subject = score.subjects as unknown as { id: string; name: string; subject_groups: { id: string; name: string } | null };
      const subjectId = subject.id;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: subject.name,
          subjectGroup: subject.subject_groups?.name || "기타",
          grades: [],
          recentGrade: null,
          riskScore: 0,
        });
      }

      const entry = subjectMap.get(subjectId)!;
      entry.grades.push(score.rank_grade);
      if (entry.recentGrade === null) {
        entry.recentGrade = score.rank_grade;
      }
    }

    // 모의고사 성적 처리
    for (const score of mockScores || []) {
      if (!score.subjects || !score.grade_score) continue;

      const subject = score.subjects as unknown as { id: string; name: string; subject_groups: { id: string; name: string } | null };
      const subjectId = subject.id;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: subject.name,
          subjectGroup: subject.subject_groups?.name || "기타",
          grades: [],
          recentGrade: null,
          riskScore: 0,
        });
      }

      const entry = subjectMap.get(subjectId)!;
      entry.grades.push(score.grade_score);
      if (entry.recentGrade === null) {
        entry.recentGrade = score.grade_score;
      }
    }

    // 위험도 점수 매핑
    for (const analysis of riskAnalyses || []) {
      // subject 이름으로 매칭
      for (const [, entry] of subjectMap) {
        if (entry.subjectName === analysis.subject) {
          entry.riskScore = analysis.risk_score || 0;
        }
      }
    }

    // 5. 과목 정보 생성
    const allSubjects: SubjectScoreInfo[] = [];

    for (const [, entry] of subjectMap) {
      const avgGrade = entry.grades.length > 0
        ? entry.grades.reduce((a, b) => a + b, 0) / entry.grades.length
        : 0;

      // 트렌드 계산 (최근 3개 성적 비교)
      let trend: ScoreTrend = "stable";
      if (entry.grades.length >= 2) {
        const recent = entry.grades.slice(0, Math.min(3, entry.grades.length));
        const older = entry.grades.slice(Math.min(3, entry.grades.length));

        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

          // 등급은 낮을수록 좋음
          if (recentAvg < olderAvg - 0.5) {
            trend = "improving";
          } else if (recentAvg > olderAvg + 0.5) {
            trend = "declining";
          }
        }
      }

      allSubjects.push({
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        subjectGroup: entry.subjectGroup,
        averageGrade: Math.round(avgGrade * 10) / 10,
        recentGrade: entry.recentGrade,
        trend,
        riskScore: entry.riskScore,
        isWeak: entry.riskScore >= 60 || avgGrade >= 5, // 위험도 60 이상 또는 평균 5등급 이상
      });
    }

    // 취약 과목 필터링 (위험도 높은 순)
    const weakSubjects = allSubjects
      .filter((s) => s.isWeak)
      .sort((a, b) => b.riskScore - a.riskScore);

    // 전체 평균 계산
    const internalGrades = (internalScores || [])
      .map((s) => s.rank_grade)
      .filter((g): g is number => g !== null);

    const mockGrades = (mockScores || [])
      .map((s) => s.grade_score)
      .filter((g): g is number => g !== null);

    const overallAverageGrade = internalGrades.length > 0
      ? Math.round((internalGrades.reduce((a, b) => a + b, 0) / internalGrades.length) * 10) / 10
      : null;

    const mockAverageGrade = mockGrades.length > 0
      ? Math.round((mockGrades.reduce((a, b) => a + b, 0) / mockGrades.length) * 10) / 10
      : null;

    // 마지막 업데이트 시간
    const lastUpdated = (internalScores?.[0]?.created_at || mockScores?.[0]?.created_at) ?? null;

    return {
      success: true,
      data: {
        studentId: targetStudentId,
        overallAverageGrade,
        mockAverageGrade,
        weakSubjects,
        allSubjects: allSubjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
        totalScoreCount: (internalScores?.length || 0) + (mockScores?.length || 0),
        lastUpdated,
      },
    };
  } catch (error) {
    console.error("getStudentScoreProfile error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "성적 프로필 조회에 실패했습니다.",
    };
  }
}
