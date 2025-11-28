/**
 * 학생 성적 대시보드 API
 * 
 * GET /api/students/:id/score-dashboard?tenantId=...&termId=...
 * 
 * 내신 분석 + 모의고사 분석 + 수시/정시 전략 분석 결과를 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getInternalAnalysis } from "@/lib/scores/internalAnalysis";
import { getMockAnalysis } from "@/lib/scores/mockAnalysis";
import {
  getInternalPercentile,
  analyzeAdmissionStrategy,
} from "@/lib/scores/admissionStrategy";

/**
 * 학생 성적 대시보드 응답 타입
 */
type ScoreDashboardResponse = {
  studentProfile: {
    id: string;
    name: string;
    grade: number | null;
    class: number | null;
    schoolType: string | null;
    schoolYear: number | null;
    termGrade: number | null;
    semester: number | null;
  };
  internalAnalysis: {
    totalGpa: number | null;
    zIndex: number | null;
    subjectStrength: Record<string, number>;
  };
  mockAnalysis: {
    recentExam: { examDate: string; examTitle: string } | null;
    avgPercentile: number | null;
    totalStdScore: number | null;
    best3GradeSum: number | null;
  };
  strategyResult: {
    type: string;
    message: string;
    data: {
      internalPct: number | null;
      mockPct: number | null;
      diff: number | null;
    };
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const tenantId = req.nextUrl.searchParams.get("tenantId");
    const termId = req.nextUrl.searchParams.get("termId");

    if (!tenantId || !termId) {
      return NextResponse.json(
        { error: "tenantId and termId are required" },
        { status: 400 }
      );
    }

    // 인증 확인
    const currentUser = await getCurrentUser();
    const { role: currentRole } = await getCurrentUserRole();

    // Supabase 클라이언트 선택
    // 관리자/부모 역할이거나 개발 환경에서는 Admin Client 사용 (RLS 우회)
    // 학생은 자신의 데이터만 조회 가능하도록 Server Client 사용
    const useAdminClient =
      currentRole === "admin" ||
      currentRole === "parent" ||
      process.env.NODE_ENV === "development";

    const supabase = useAdminClient
      ? createSupabaseAdminClient() || (await createSupabaseServerClient())
      : await createSupabaseServerClient();

    // 1) 학생 + term 조인으로 존재 여부 및 기본 프로필 조회
    // students와 student_terms를 JOIN해서 한 번에 조회
    // Supabase에서는 student_terms를 기준으로 조회하는 것이 더 안전함
    const { data: termRow, error: termError } = await supabase
      .from("student_terms")
      .select(
        `
        id,
        school_year,
        grade,
        semester,
        curriculum_revision_id,
        students!inner(
          id,
          name,
          grade,
          class,
          school_type
        )
        `
      )
      .eq("id", termId)
      .eq("tenant_id", tenantId)
      .eq("students.id", studentId)
      .eq("students.tenant_id", tenantId)
      .maybeSingle();

    if (termError) {
      console.error("[api/score-dashboard] 학생/학기 조회 실패", {
        error: termError,
        code: termError.code,
        message: termError.message,
      });

      // RLS 정책 에러인 경우
      if (
        termError.code === "42501" ||
        termError.message?.includes("permission") ||
        termError.message?.includes("policy")
      ) {
        return NextResponse.json(
          {
            error: "Permission denied",
            details: "RLS policy may be blocking the query.",
            code: termError.code,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch student/term", details: termError.message },
        { status: 500 }
      );
    }

    if (!termRow) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // students는 배열로 반환될 수 있으므로 첫 번째 항목 사용
    const student =
      Array.isArray(termRow.students) && termRow.students.length > 0
        ? termRow.students[0]
        : termRow.students;

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const curriculumRevisionId =
      (termRow.curriculum_revision_id as string | null) ?? null;

    // 2) 내신 분석 (특정 term 기준)
    const internal = await getInternalAnalysis(
      tenantId,
      studentId,
      termId // studentTermId로 사용
    );

    // 2-1) 내신 백분위 환산
    const internalPct =
      internal.totalGpa != null && curriculumRevisionId
        ? await getInternalPercentile(curriculumRevisionId, internal.totalGpa)
        : null;

    // 3) 모의고사 분석 (최근 모의 기준)
    const mock = await getMockAnalysis(tenantId, studentId);

    // 4) 전략 분석
    const strategy = analyzeAdmissionStrategy(
      internalPct,
      mock.avgPercentile,
      internal.zIndex
    );

    // 5) 응답 조립
    const response: ScoreDashboardResponse = {
      studentProfile: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        class: student.class,
        schoolType: student.school_type,
        schoolYear: termRow.school_year,
        termGrade: termRow.grade,
        semester: termRow.semester,
      },
      internalAnalysis: {
        totalGpa: internal.totalGpa,
        zIndex: internal.zIndex,
        subjectStrength: internal.subjectStrength,
      },
      mockAnalysis: mock,
      strategyResult: strategy,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/score-dashboard] 에러 발생", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

