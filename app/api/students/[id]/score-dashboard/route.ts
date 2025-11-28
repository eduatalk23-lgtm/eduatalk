/**
 * 학생 성적 대시보드 API
 * 
 * GET /api/students/:id/score-dashboard?tenantId=...&termId=...
 * 
 * 내신 분석 + 모의고사 분석 + 수시/정시 전략 분석 결과를 반환합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
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
    semester?: number | null;
    schoolType?: string | null;
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
    const studentTermId = req.nextUrl.searchParams.get("termId") || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 인증 확인
    const currentUser = await getCurrentUser();
    console.log("[api/score-dashboard] 현재 사용자:", {
      userId: currentUser?.userId,
      role: currentUser?.role,
      email: currentUser?.email,
      tenantId: currentUser?.tenantId,
      requestedStudentId: studentId,
      userIdMatches: currentUser?.userId === studentId,
    });

    // 인증되지 않은 경우 (선택적 - RLS가 처리할 수도 있음)
    // 하지만 더 명확한 에러 메시지를 위해 확인
    if (!currentUser) {
      console.warn("[api/score-dashboard] 인증되지 않은 사용자");
      // RLS가 처리하므로 여기서는 경고만
    }

    // 학생인 경우 자신의 데이터만 조회 가능한지 확인
    if (currentUser?.role === "student" && currentUser?.userId !== studentId) {
      console.warn("[api/score-dashboard] 학생이 다른 학생의 데이터를 조회하려고 시도:", {
        currentUserId: currentUser.userId,
        requestedStudentId: studentId,
      });
      // RLS 정책이 이를 차단할 것이지만, 명확한 에러 메시지를 위해 여기서도 확인
    }

    // 1) 학생 기본 정보 조회 (디버깅: tenant_id 조건 없이 먼저 확인)
    console.log("[api/score-dashboard] 학생 조회 시작:", {
      studentId,
      tenantId,
    });

    // 디버깅: tenant_id 조건 없이 조회
    const { data: studentWithoutTenant, error: checkError } = await supabase
      .from("students")
      .select("id, name, grade, school_type, tenant_id")
      .eq("id", studentId)
      .maybeSingle();

    if (checkError) {
      console.error("[api/score-dashboard] 학생 조회 실패 (tenant_id 조건 없음)", checkError);
    } else if (studentWithoutTenant) {
      console.log("[api/score-dashboard] 학생 조회 결과 (tenant_id 조건 없음):", {
        found: true,
        studentId: studentWithoutTenant.id,
        name: studentWithoutTenant.name,
        actualTenantId: studentWithoutTenant.tenant_id,
        requestedTenantId: tenantId,
        tenantIdMatch: studentWithoutTenant.tenant_id === tenantId,
      });
    } else {
      console.log("[api/score-dashboard] 학생 조회 결과 (tenant_id 조건 없음): 학생을 찾을 수 없음");
    }

    // 실제 쿼리: tenant_id 조건 포함
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, grade, school_type, tenant_id")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (studentError) {
      console.error("[api/score-dashboard] 학생 조회 실패", studentError);
      return NextResponse.json(
        { error: "Failed to fetch student" },
        { status: 500 }
      );
    }

    if (!student) {
      // 더 자세한 에러 메시지 제공
      const errorMessage = studentWithoutTenant
        ? `Student found but tenant_id mismatch. Student tenant_id: ${studentWithoutTenant.tenant_id}, Requested tenant_id: ${tenantId}`
        : "Student not found";
      
      console.error("[api/score-dashboard] 학생 조회 실패:", {
        studentId,
        tenantId,
        errorMessage,
        studentExists: !!studentWithoutTenant,
        actualTenantId: studentWithoutTenant?.tenant_id,
      });

      return NextResponse.json(
        { 
          error: "Student not found",
          details: studentWithoutTenant
            ? `Student exists but tenant_id mismatch. Expected: ${tenantId}, Actual: ${studentWithoutTenant.tenant_id}`
            : "Student does not exist",
        },
        { status: 404 }
      );
    }

    console.log("[api/score-dashboard] 학생 조회 성공:", {
      studentId: student.id,
      name: student.name,
      tenantId: student.tenant_id,
    });

    // 2) 내신 분석
    const internal = await getInternalAnalysis(
      tenantId,
      studentId,
      studentTermId
    );

    // 2-1) student_terms에서 curriculum_revision_id 조회 (내신 환산용)
    let curriculumRevisionId: string | null = null;
    if (studentTermId) {
      const { data: termRow, error: termError } = await supabase
        .from("student_terms")
        .select("curriculum_revision_id")
        .eq("id", studentTermId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!termError && termRow) {
        curriculumRevisionId = termRow.curriculum_revision_id;
      }
    } else {
      // studentTermId가 없으면 가장 최근 학기의 curriculum_revision_id 조회
      const { data: latestTerm, error: latestTermError } = await supabase
        .from("student_terms")
        .select("curriculum_revision_id")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("grade", { ascending: false })
        .order("semester", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestTermError && latestTerm) {
        curriculumRevisionId = latestTerm.curriculum_revision_id;
      }
    }

    // 내신 백분위 환산
    const internalPct =
      internal.totalGpa != null && curriculumRevisionId
        ? await getInternalPercentile(curriculumRevisionId, internal.totalGpa)
        : null;

    // 3) 모의고사 분석
    const mock = await getMockAnalysis(tenantId, studentId);

    // 4) 유불리 전략 분석
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
        schoolType: student.school_type || null,
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

